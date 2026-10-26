import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { getRagPipeline } from '@/lib/rag/engine';
import { getLLMProvider } from '@/lib/llm';
import type { LLMMessage, SourceRef } from '@/lib/rag/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export async function POST(req: NextRequest) {
  // 1. Autenticación
  const session = await getSession();
  if (!session || !session.authenticated) {
    return json({ error: 'Acceso no autorizado. Ingrese el token de acceso.' }, 401);
  }

  // 2. Rate limiting
  const clientIp =
    req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const { allowed, remaining } = checkRateLimit(clientIp);
  if (!allowed) {
    return json(
      { error: 'Límite de consultas por minuto alcanzado (12 req/min). Aguarde un instante antes de continuar.' },
      429,
      { 'Retry-After': '60' }
    );
  }

  // 3. Validación de entrada
  let sanitized: LLMMessage[];
  try {
    const body = await req.json();
    const messages: LLMMessage[] = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'No se enviaron mensajes válidos.' }, 400);
    }
    sanitized = messages.slice(-20).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 3000),
    }));
    if (!sanitized[sanitized.length - 1].content.trim()) {
      return json({ error: 'La consulta no puede estar vacía.' }, 400);
    }
  } catch (err: unknown) {
    return json({ error: `Solicitud inválida: ${err instanceof Error ? err.message : String(err)}` }, 400);
  }

  const encoder = new TextEncoder();
  const rag = getRagPipeline();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      try {
        send({ type: 'status', stage: 'retrieval' });

        // 4. Recuperación: reescritura → BM25 + denso → RRF → reranking → decisión de evidencia
        const { results, trace } = await rag.retrieve(sanitized);
        const labelIds = new Set([...trace.fused.map((f) => f.id), ...trace.selected]);
        const labels: Record<string, { title: string; section: string }> = {};
        for (const id of labelIds) {
          const c = rag.getChunk(id);
          if (c) labels[id] = { title: c.title, section: c.section };
        }

        const sources: SourceRef[] = results.map((r, i) => ({
          n: i + 1,
          id: r.chunk.id,
          title: r.chunk.title,
          section: r.chunk.section,
          file: r.chunk.sourceDoc,
          snippet: r.chunk.content.slice(0, 220) + (r.chunk.content.length > 220 ? '…' : ''),
          relevance: r.relevance ?? undefined,
        }));

        // 5a. Sin evidencia suficiente: respuesta fija, sin llamar al modelo
        if (trace.decision === 'insufficient_evidence') {
          const topics = Array.from(
            new Set(rag.chunks.map((c) => c.title.replace(/^Manual (Operativo |del Colaborador: )?(de )?/i, '').split(/[,(:]/)[0].trim()))
          ).join(' · ');
          send({
            type: 'token',
            content: `No encontré información sobre eso en los manuales cargados, así que prefiero no responder antes que inventar.\n\nPuedo ayudarte con temas como: ${topics}.`,
          });
          send({ type: 'trace', trace: { ...trace, labels, generation: null } });
          send({ type: 'done', remaining });
          return;
        }

        // 5b. Generación con contexto numerado y citas obligatorias
        send({ type: 'status', stage: 'generation' });
        const context = results
          .map((r, i) => `[${i + 1}] ${r.chunk.title} > ${r.chunk.section}\n${r.chunk.content}`)
          .join('\n\n---\n\n');
        const systemPrompt = `Sos "Tex AI", el asistente de operaciones, finanzas y normativa de la firma.

REGLAS:
1. Respondé SOLO con información de las FUENTES numeradas de abajo. Nunca inventes plazos, montos, porcentajes ni normas.
2. Después de cada dato o afirmación, citá la fuente con su número entre corchetes, por ejemplo: "liquida en T+0 [1]". Podés citar varias: [1][3].
3. Si las fuentes responden solo una parte de la pregunta, respondé esa parte y aclará explícitamente qué no figura en los manuales.
4. Respondé directo, claro y en español rioplatense profesional. Usá viñetas o negritas cuando ayuden. No menciones "fragmentos", "contexto" ni códigos de archivo.

FUENTES:
${context}`;

        const provider = getLLMProvider();
        const tGen = Date.now();
        let answer = '';
        await provider.streamCompletion(sanitized, systemPrompt, (token) => {
          answer += token;
          send({ type: 'token', content: token });
        });

        // 6. Validación de citas: números válidos y fuentes efectivamente citadas
        const cited = new Set<number>();
        const invalid = new Set<number>();
        for (const m of answer.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
          for (const n of m[1].split(',').map((x) => Number(x.trim()))) {
            (n >= 1 && n <= sources.length ? cited : invalid).add(n);
          }
        }
        for (const s of sources) send({ type: 'source', source: { ...s, cited: cited.has(s.n) } });
        send({
          type: 'trace',
          trace: {
            ...trace,
            labels,
            generation: {
              ms: Date.now() - tGen,
              provider: (provider as { lastEngine?: string }).lastEngine || provider.name,
              citedSources: [...cited].sort((a, b) => a - b),
              invalidCitations: [...invalid],
              uncited: cited.size === 0,
            },
          },
        });
        send({ type: 'done', remaining });
      } catch (err: unknown) {
        send({ type: 'error', content: err instanceof Error ? err.message : 'Error en la generación' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
