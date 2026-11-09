/* eslint-disable @typescript-eslint/no-explicit-any -- script de evaluación: JSON sin tipar */
// Genera el set de evaluación de recuperación: por cada fragmento, una pregunta
// realista y la cita textual que la responde. La relevancia se juzga por la cita
// (no por el id del fragmento), así el set sirve para comparar estrategias de
// fragmentación distintas.
//   node scripts/eval/build-golden.ts
import './env.ts';
import fs from 'node:fs';

const { chunkMarkdown } = await import('../../src/lib/rag/chunker.ts');
const { generateJSON } = await import('../../src/lib/rag/llm-json.ts');
const { normalize } = await import('../../src/lib/rag/text.ts');

const DIR = 'data/policies';
// Se genera con un modelo de Claude con más capacidad que el de reranking.
const GEN_MODEL = process.env.EVAL_GEN_MODEL || 'claude-opus-5-5';
async function generate(prompt: string, schema: object): Promise<{ data: any; model: string }> {
  return generateJSON<any>(prompt, schema, { model: GEN_MODEL, timeoutMs: 300000, maxTokens: 16000 });
}
const norm = (s: string) => normalize(s).replace(/\s+/g, ' ').trim();

interface Item {
  id: string;
  type: 'direct' | 'paraphrase' | 'followup' | 'unanswerable';
  history?: { role: 'user' | 'assistant'; content: string }[];
  question: string;
  evidence: string[]; // citas textuales; vacío = la respuesta no está en los manuales
  doc?: string;
}

const items: Item[] = [];
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md'));

async function processFile(file: string) {
  const text = fs.readFileSync(`${DIR}/${file}`, 'utf8');
  const chunks = chunkMarkdown(file, text);
  const listing = chunks.map((c, i) => `### Fragmento ${i + 1} (${c.section})\n${c.content}`).join('\n\n');
  const prompt = `Estás armando un set de evaluación para el buscador interno de una ALyC (agente bursátil argentino).
A partir de los fragmentos de este manual, escribí preguntas que haría un empleado real.

Para CADA fragmento devolvé:
- "direct": una pregunta clara y específica cuya respuesta esté en ese fragmento.
- "paraphrase": otra pregunta sobre un dato distinto del mismo fragmento, formulada con palabras coloquiales y SIN repetir los términos del texto (sinónimos, como lo diría alguien apurado).
- "evidence_direct" y "evidence_paraphrase": una cita TEXTUAL y EXACTA del fragmento (copiada carácter por carácter, 30 a 140 caracteres, sin el formato markdown ** ni viñetas) que contenga la respuesta.

Además, elegí 2 fragmentos y armá para cada uno una conversación de seguimiento:
- "lead": una primera pregunta general sobre el tema del manual.
- "followup": una repregunta elíptica que solo se entiende con la anterior (ej. "¿y el horario de corte?", "¿y si es en dólares?") cuya respuesta esté en el fragmento elegido.
- "evidence": cita textual exacta que la responde.

Manual: ${chunks[0]?.title}

${listing}`;
  const schema = {
    type: 'object',
    properties: {
      perChunk: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            fragment: { type: 'integer' },
            direct: { type: 'string' },
            evidence_direct: { type: 'string' },
            paraphrase: { type: 'string' },
            evidence_paraphrase: { type: 'string' },
          },
          required: ['fragment', 'direct', 'evidence_direct', 'paraphrase', 'evidence_paraphrase'],
        },
      },
      followups: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            fragment: { type: 'integer' },
            lead: { type: 'string' },
            followup: { type: 'string' },
            evidence: { type: 'string' },
          },
          required: ['fragment', 'lead', 'followup', 'evidence'],
        },
      },
    },
    required: ['perChunk', 'followups'],
  };

  const { data, model } = await generate(prompt, schema);
  const fullNorm = norm(text);
  let kept = 0;
  let dropped = 0;
  const push = (it: Item) => {
    if (it.evidence.every((e) => e.length >= 15 && fullNorm.includes(norm(e)))) {
      items.push(it);
      kept++;
    } else dropped++;
  };
  for (const p of data.perChunk || []) {
    const code = file.split('_')[0];
    push({ id: `${code}-d${p.fragment}`, type: 'direct', question: p.direct, evidence: [p.evidence_direct], doc: file });
    push({ id: `${code}-p${p.fragment}`, type: 'paraphrase', question: p.paraphrase, evidence: [p.evidence_paraphrase], doc: file });
  }
  for (const f of data.followups || []) {
    const code = file.split('_')[0];
    push({
      id: `${code}-f${f.fragment}`,
      type: 'followup',
      history: [
        { role: 'user', content: f.lead },
        { role: 'assistant', content: '(respuesta previa del asistente sobre ese tema)' },
      ],
      question: f.followup,
      evidence: [f.evidence],
      doc: file,
    });
  }
  console.log(`${file}: ${kept} ok, ${dropped} descartadas (cita no textual) [${model}]`);
}

// 3 manuales en paralelo
const queue = [...files];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      try {
        await processFile(f);
      } catch (e) {
        console.error(f, 'ERROR', e instanceof Error ? e.message.slice(0, 200) : e);
      }
    }
  })
);
items.sort((a, b) => a.id.localeCompare(b.id));

// Preguntas del dominio cuya respuesta NO está en los manuales (deben rechazarse).
const unanswerable = [
  '¿Cuál es la comisión que cobra la firma por operar opciones sobre acciones de Apple en NASDAQ?',
  '¿Cuántos días de vacaciones corresponden con 12 años de antigüedad?',
  '¿Qué rendimiento anual tuvo el FCI Money Market el año pasado?',
  '¿Se puede operar criptomonedas desde la cuenta comitente?',
  '¿Cuál es el teléfono de la mesa de operaciones para clientes del interior?',
  '¿Cómo se configura MetaTrader 5 para operar futuros de Rofex?',
  '¿Qué tasa paga hoy una caución a 7 días?',
  '¿Cuál es el procedimiento para abrir una cuenta a un menor de edad?',
  '¿La firma tiene oficinas en Córdoba o Rosario?',
  '¿Cuál es el precio objetivo del analista para YPF este trimestre?',
  '¿Se pueden comprar bonos del Tesoro de Estados Unidos (Treasuries) directamente?',
  '¿Qué pasa si me equivoco de CBU al transferir a un banco de otro país que no está en la lista?',
];
unanswerable.forEach((q, i) => items.push({ id: `none-${i + 1}`, type: 'unanswerable', question: q, evidence: [] }));

fs.writeFileSync('scripts/eval/golden.json', JSON.stringify(items, null, 2));
const by = items.reduce((m: Record<string, number>, it) => ((m[it.type] = (m[it.type] || 0) + 1), m), {});
console.log('Total', items.length, by);
