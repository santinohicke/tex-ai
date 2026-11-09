/* eslint-disable @typescript-eslint/no-explicit-any -- script de evaluación: JSON sin tipar */
// Barrido de hiperparámetros de la fusión (sin LLM: usa embeddings cacheados).
//   node scripts/eval/sweep.ts
import './env.ts';
import fs from 'node:fs';
const { RagPipeline, DEFAULT_CONFIG } = await import('../../src/lib/rag/pipeline.ts');
const { normalize } = await import('../../src/lib/rag/text.ts');
const golden = JSON.parse(fs.readFileSync('scripts/eval/golden.json', 'utf8')).filter((g: any) => g.evidence.length);
const norm = (s: string) => normalize(s).replace(/\s+/g, ' ').trim();
const DIR = 'data/policies';
const docs = fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => ({ file: f, text: fs.readFileSync(`${DIR}/${f}`, 'utf8') }));
const CACHE = 'scripts/eval/.embeddings-cache.json';
const cache = { load: () => JSON.parse(fs.readFileSync(CACHE, 'utf8')), save: (e: any) => fs.writeFileSync(CACHE, JSON.stringify({ ...JSON.parse(fs.readFileSync(CACHE, 'utf8')), ...e })) };
const { EMBEDDING_MODEL, embeddingsEnabled } = await import('../../src/lib/rag/embeddings.ts');
if (!embeddingsEnabled()) {
  console.log('El barrido de la fusión necesita VOYAGE_API_KEY (embeddings).');
  process.exit(0);
}
for (const model of [EMBEDDING_MODEL]) {
  const p = new RagPipeline(docs, { cache, embeddingModel: model });
  await p.ensureEmbeddings();
  await p.warmQueryEmbeddings(golden.map((g: any) => g.question));
  const rows: string[] = [];
  const grid: any[] = [{ fusion: 'rrf', bm25Weight: 0, bm25K: 20, rrfK: 60 }];
  for (const rrfK of [2, 5, 10, 20]) for (const bm25Weight of [0.2, 0.35, 0.5]) for (const bm25K of [5, 10]) grid.push({ fusion: 'rrf', rrfK, bm25Weight, bm25K });
  for (const bm25Weight of [0.1, 0.2, 0.3, 0.4, 0.5]) for (const bm25K of [10, 20]) grid.push({ fusion: 'convex', rrfK: 60, bm25Weight, bm25K, denseK: 20 });
  for (const g of grid) {
    {
      const { bm25Weight, bm25K } = g;
      let r1 = 0, r5 = 0, r10 = 0, mrr = 0;
      const byType: Record<string, number[]> = {};
      for (const it of golden) {
        const { trace } = await p.retrieve([{ role: 'user', content: it.question }], { ...DEFAULT_CONFIG, ...g, useRewrite: false, useRerank: false, useBm25: bm25Weight > 0 });
        const rel = trace.fused.map((f: any) => it.evidence.some((e: string) => norm(p.getChunk(f.id)!.content).includes(norm(e))));
        const first = rel.indexOf(true);
        if (first === 0) r1++;
        if (first >= 0 && first < 5) r5++;
        if (first >= 0 && first < 10) r10++;
        if (first >= 0) mrr += 1 / (first + 1);
        (byType[it.type] ||= []).push(first >= 0 && first < 5 ? 1 : 0);
      }
      const n = golden.length;
      const t = (k: string) => ((byType[k].reduce((a, b) => a + b, 0) / byType[k].length) * 100).toFixed(0);
      rows.push(`${g.fusion.padEnd(6)} rrfK=${String(g.rrfK).padStart(2)} w=${bm25Weight.toFixed(2)} k=${String(bm25K).padStart(2)}  R@1 ${(r1 / n * 100).toFixed(1)}  R@5 ${(r5 / n * 100).toFixed(1)}  R@10 ${(r10 / n * 100).toFixed(1)}  MRR ${(mrr / n).toFixed(3)}  [dir ${t('direct')} par ${t('paraphrase')} rep ${t('followup')}]`);
    }
  }
  console.log(`\n== ${model}\n` + rows.join('\n'));
}
