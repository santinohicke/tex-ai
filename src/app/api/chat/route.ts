import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { vectorStore } from '@/lib/rag/vector-store';
import { getLLMProvider } from '@/lib/llm';
import { LLMMessage } from '@/lib/rag/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 1. Verificación de Autenticación
  const session = await getSession();
  if (!session || !session.authenticated) {
    return new Response(
      JSON.stringify({ error: 'Acceso no autorizado. Ingrese el token de acceso.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Control de Frecuencia (Rate Limiting)
  const clientIp =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1';

  const { allowed, remaining } = checkRateLimit(clientIp);
  if (!allowed) {
    return new Response(
      JSON.stringify({
        error:
          'Límite de consultas por minuto alcanzado (12 req/min). Aguarde un instante antes de continuar.',
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      }
    );
  }

  // 3. Extracción y Validación de Entrada
  try {
    const body = await req.json();
    const {
      messages,
      provider: requestedProvider,
    }: { messages: LLMMessage[]; provider?: string } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No se enviaron mensajes válidos.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Limitar longitud de mensajes para evitar desbordes
    const sanitizedMessages = messages.slice(-20).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 3000),
    }));

    const userQuery = sanitizedMessages[sanitizedMessages.length - 1].content;
    if (!userQuery.trim()) {
      return new Response(
        JSON.stringify({ error: 'La consulta no puede estar vacía.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Búsqueda Vectorial RAG (Retrieval)
    const retrievalResults = vectorStore.search(userQuery, 4);

    // Formatear contexto recuperado para el LLM
    const contextText = retrievalResults
      .map((r, i) => {
        return `[DOCUMENTO FUENTE ${i + 1}]: ${r.chunk.title} > ${r.chunk.section} (${r.chunk.sourceDoc})\n${r.chunk.content}`;
      })
      .join('\n\n---\n\n');

    // 5. System Prompt Directo y Natural de Soporte Financiero
    const systemPrompt = `Eres "Tex AI", el asistente inteligente de operaciones, finanzas y normativas.

REGLAS DE RESPUESTA:
1. RESPONDE EXCLUSIVAMENTE basándote en la información factual provista en el CONTEXTO a continuación.
2. Responde directamente a la consulta del usuario de manera fluida, natural, concisa y profesional.
3. PROHIBIDO TERMINANTEMENTE iniciar o redactar citas robóticas como "Conforme a lo establecido en el [DOCUMENTO FUENTE]", ni mencionar códigos de archivo o nombres de secciones entre paréntesis (ej. "TEX-GLOS...", "sección 1.1..."). Redacta la explicación de forma directa. La interfaz ya muestra las fuentes de manera interactiva.
4. Si la respuesta a la pregunta del usuario NO se encuentra en el contexto provisto, responde cortésmente indicando que dicha información no figura en la base de manuales cargados. NUNCA inventes regulaciones, plazos ni números.
5. PROHIBIDO TERMINANTEMENTE agregar notas al pie o cláusulas finales de "Omitido", "No verificado" o "Riesgo". Finaliza tu respuesta directamente con la explicación técnica.

CONTEXTO DE MANUALES Y NORMAS:
${contextText || 'No se encontraron documentos relevantes en la base vectorial para esta consulta.'}`;

    // 6. Preparar Streaming Response (SSE / NDJSON)
    const encoder = new TextEncoder();
    const provider = getLLMProvider(requestedProvider);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // A. Transmitir primero la respuesta de texto generada por el LLM
          await provider.streamCompletion(sanitizedMessages, systemPrompt, (token) => {
            const tokenPayload = JSON.stringify({
              type: 'token',
              content: token,
            });
            controller.enqueue(encoder.encode(`data: ${tokenPayload}\n\n`));
          });

          // B. Una vez completado el texto, transmitir las fuentes correspondientes
          for (const res of retrievalResults) {
            const sourcePayload = JSON.stringify({
              type: 'source',
              source: {
                title: res.chunk.title,
                section: res.chunk.section,
                file: res.chunk.sourceDoc,
                snippet: res.chunk.content.slice(0, 180) + '...',
              },
            });
            controller.enqueue(encoder.encode(`data: ${sourcePayload}\n\n`));
          }

          // C. Enviar evento de finalización
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', remaining })}\n\n`)
          );
        } catch (err: unknown) {
          const errMessage =
            err instanceof Error ? err.message : 'Error en la generación LLM';
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', content: errMessage })}\n\n`
            )
          );
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: `Error procesando solicitud: ${msg}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
