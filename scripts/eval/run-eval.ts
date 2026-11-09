/* eslint-disable @typescript-eslint/no-explicit-any -- script de evaluación: JSON sin tipar */
// Evalúa la recuperación con el set de scripts/eval/golden.json.
//   node scripts/eval/run-eval.ts            -> todas las configuraciones
//   node scripts/eval/run-eval.ts --no-llm   -> sin reescritura ni reordenamiento (no usa cuota de generación)
// Un fragmento es relevante si contiene la cita textual que responde la pregunta,
// así se pueden comparar fragmentaciones distintas con el mismo set.
import './env.ts';
import fs from 'node:fs';

const { RagPipeline, DEFAULT_CONFIG } = await import('../../src/lib/rag/pipeline.ts');
const { normalize } = await import('../../src/lib/rag/text.ts');
const { EMBEDDING_MODEL, embeddingsEnabled } = await import('../../src/lib/rag/embeddings.ts');
const { LegacyStore } = await import('./legacy.ts');

type Msg = { role: 'user' | 'assistant'; content: string };
interface Item {
  id: string;
  type: string;
  history?: Msg[];
  question: string;
  evidence: string[];
}

const NO_LLM = process.argv.includes('--no-llm');
const errorLog: string[] = [];
const golden: Item[] = JSON.parse(fs.readFileSync('scripts/eval/golden.json', 'utf8'));
const answerable = golden.filter((g) => g.evidence.length);
const unanswerable = golden.filter((g) => !g.evidence.length);
const norm = (s: string) => normalize(s).replace(/\s+/g, ' ').trim();
const DIR = 'data/policies';
const docs = fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => ({ file: f, text: fs.readFileSync(`${DIR}/${f}`, 'utf8') }));

const CACHE = 'scripts/eval/.embeddings-cache.json';
const cache = {
  load: () => (fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : null),
  save: (e: Record<string, number[]>) => {
    const prev = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
    fs.writeFileSync(CACHE, JSON.stringify({ ...prev, ...e }));
  },
};

// ---------- métricas ----------
function isRelevant(content: string, item: Item) {
  const c = norm(content);
  return item.evidence.some((e) => c.includes(norm(e)));
}
function rankMetrics(rels: boolean[]) {
  const first = rels.indexOf(true);
  const dcg = rels.slice(0, 10).reduce((s, r, i) => s + (r ? 1 / Math.log2(i + 2) : 0), 0);
  const idealCount = Math.min(10, Math.max(1, rels.filter(Boolean).length));
  let idcg = 0;
  for (let i = 0; i < idealCount; i++) idcg += 1 / Math.log2(i + 2);
  return {
    r1: first === 0 ? 1 : 0,
    r3: first >= 0 && first < 3 ? 1 : 0,
    r5: first >= 0 && first < 5 ? 1 : 0,
    mrr: first >= 0 && first < 10 ? 1 / (first + 1) : 0,
    ndcg: idcg ? dcg / idcg : 0,
  };
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

interface Row {
  name: string;
  byType: Record<string, ReturnType<typeof rankMetrics>[]>;
  all: ReturnType<typeof rankMetrics>[];
  selRecall?: number;
  falseReject?: number;
  correctReject?: number;
  latency: number[];
  errors: number;
}
const rows: Row[] = [];

async function evaluate(
  name: string,
  rank: (it: Item) => Promise<{ ranked: string[]; selected?: string[]; rejected?: boolean; ms: number; error?: boolean }>,
  getContent: (id: string) => string,
  concurrency = 4
) {
  const row: Row = { name, byType: {}, all: [], latency: [], errors: 0 };
  const sel: number[] = [];
  const fr: number[] = [];
  const cr: number[] = [];
  const queue = [...golden];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (let it = queue.shift(); it; it = queue.shift()) {
        const out = await rank(it);
        row.latency.push(out.ms);
        if (out.error) row.errors++;
        if (!it.evidence.length) {
          if (out.rejected !== undefined) cr.push(out.rejected ? 1 : 0);
          continue;
        }
        const m = rankMetrics(out.ranked.map((id) => isRelevant(getContent(id), it)));
        row.all.push(m);
        (row.byType[it.type] ||= []).push(m);
        if (out.selected) sel.push(out.selected.some((id) => isRelevant(getContent(id), it)) ? 1 : 0);
        if (out.rejected !== undefined) fr.push(out.rejected ? 1 : 0);
      }
    })
  );
  if (sel.length) row.selRecall = mean(sel);
  if (fr.length) row.falseReject = mean(fr);
  if (cr.length) row.correctReject = mean(cr);
  rows.push(row);
  const a = row.all;
  console.log(
    `${name.padEnd(34)} R@1 ${pct(mean(a.map((m) => m.r1)))}  R@5 ${pct(mean(a.map((m) => m.r5)))}  MRR ${mean(a.map((m) => m.mrr)).toFixed(3)}  nDCG ${mean(a.map((m) => m.ndcg)).toFixed(3)}` +
      (row.selRecall !== undefined ? `  sel ${pct(row.selRecall)}` : '') +
      (row.correctReject !== undefined ? `  rechazo-ok ${pct(row.correctReject)} rechazo-mal ${pct(row.falseReject || 0)}` : '') +
      (row.errors ? `  errores ${row.errors}` : '')
  );
}

// ---------- 0. buscador anterior ----------
{
  const legacy = new LegacyStore();
  legacy.init(DIR);
  const content = new Map<string, string>();
  await evaluate(
    'Anterior (léxico casero)',
    async (it) => {
      const t = Date.now();
      const res = legacy.search(it.question, 10);
      res.forEach((r: any) => content.set(r.chunk.id, r.chunk.content));
      return { ranked: res.map((r: any) => r.chunk.id), ms: Date.now() - t };
    },
    (id) => content.get(id) || ''
  );
}

// ---------- configuraciones del pipeline nuevo ----------
const allQueries = golden.map((g) => g.question);
for (const model of [EMBEDDING_MODEL, ...(process.env.EVAL_ALT_EMBEDDING_MODEL ? [process.env.EVAL_ALT_EMBEDDING_MODEL] : [])]) {
  const p = new RagPipeline(docs, { cache, embeddingModel: model });
  const dense = embeddingsEnabled();
  if (dense) {
    await p.ensureEmbeddings();
    await p.warmQueryEmbeddings(allQueries);
  } else {
    console.log('Sin VOYAGE_API_KEY: se omiten las configuraciones con embeddings.');
  }
  const content = (id: string) => p.getChunk(id)?.content || '';
  const run = (cfg: Partial<typeof DEFAULT_CONFIG>) => async (it: Item) => {
    const t = Date.now();
    const messages = [...(it.history || []), { role: 'user' as const, content: it.question }];
    const full = { ...DEFAULT_CONFIG, ...cfg };
    let { results, trace } = await p.retrieve(messages, full);
    // en evaluación, un 429 de cuota por minuto se reintenta en vez de caer al plan B
    for (let i = 0; i < 3 && full.useRerank && trace.rerankError?.includes(' 429:'); i++) {
      await new Promise((r) => setTimeout(r, 20000));
      ({ results, trace } = await p.retrieve(messages, full));
    }
    if (trace.rerankError || trace.denseError) errorLog.push(`${it.id}: ${(trace.rerankError || trace.denseError)!.slice(0, 160)}`);
    const selected = results.map((r) => r.chunk.id);
    const ranked = [...selected, ...trace.fused.map((f) => f.id).filter((id) => !selected.includes(id))];
    return {
      ranked: full.useRerank ? ranked : trace.fused.map((f) => f.id),
      selected,
      rejected: trace.decision === 'insufficient_evidence',
      ms: Date.now() - t,
      error: Boolean(trace.denseError || trace.rerankError),
    };
  };
  const off = { useRewrite: false, useRerank: false };
  if (model === EMBEDDING_MODEL) {
    await evaluate('BM25', run({ ...off, useDense: false }), content);
  }
  if (dense) {
    await evaluate(`Denso (${model})`, run({ ...off, useBm25: false }), content);
    await evaluate(`Híbrido RRF k=60 (${model})`, run({ ...off, fusion: 'rrf', bm25Weight: 1 }), content);
    await evaluate(`Híbrido convexo w=0.2 (${model})`, run(off), content);
  }
  if (!NO_LLM && model === EMBEDDING_MODEL) {
    await evaluate(`Híbrido + reescritura`, run({ useRerank: false }), content, 1);
    await evaluate(`Completo (+ reranking)`, run({}), content, 1);
  }
}

// ---------- informe ----------
const types = ['direct', 'paraphrase', 'followup'];
const typeName: Record<string, string> = { direct: 'directas', paraphrase: 'parafraseadas', followup: 'repreguntas' };
let md = `# Evaluación de la recuperación\n\nGenerado por \`node scripts/eval/run-eval.ts\` el ${new Date().toISOString().slice(0, 10)}.\n\n`;
md += `Set: ${answerable.length} preguntas con respuesta (${types.map((t) => `${answerable.filter((g) => g.type === t).length} ${typeName[t]}`).join(', ')}) y ${unanswerable.length} sin respuesta en los manuales.\n`;
md += `Un fragmento cuenta como relevante si contiene la cita textual que responde la pregunta.\n\n`;
md += `| Configuración | Recall@1 | Recall@3 | Recall@5 | MRR@10 | nDCG@10 | Latencia media |\n|---|---|---|---|---|---|---|\n`;
for (const r of rows) {
  const a = r.all;
  md += `| ${r.name} | ${pct(mean(a.map((m) => m.r1)))} | ${pct(mean(a.map((m) => m.r3)))} | ${pct(mean(a.map((m) => m.r5)))} | ${mean(a.map((m) => m.mrr)).toFixed(3)} | ${mean(a.map((m) => m.ndcg)).toFixed(3)} | ${Math.round(mean(r.latency))} ms |\n`;
}
md += `\n### Recall@5 por tipo de pregunta\n\n| Configuración | ${types.map((t) => typeName[t]).join(' | ')} |\n|---|${types.map(() => '---').join('|')}|\n`;
for (const r of rows) md += `| ${r.name} | ${types.map((t) => pct(mean((r.byType[t] || []).map((m) => m.r5)))).join(' | ')} |\n`;
const decided = rows.filter((r) => r.selRecall !== undefined && r.name.startsWith('Completo'));
if (decided.length) {
  md += `\n### Decisión de evidencia (pipeline completo)\n\n| Métrica | Valor |\n|---|---|\n`;
  for (const r of decided) {
    md += `| Fragmento correcto entre los enviados al modelo | ${pct(r.selRecall!)} |\n`;
    md += `| Preguntas sin respuesta rechazadas correctamente | ${pct(r.correctReject || 0)} |\n`;
    md += `| Preguntas con respuesta rechazadas por error | ${pct(r.falseReject || 0)} |\n`;
  }
}
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/EVALUATION.md', md);
console.log('\nInforme: docs/EVALUATION.md');
