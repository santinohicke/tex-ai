import type { DocumentChunk } from './types.ts';
import { tokenize } from './text.ts';

/**
 * BM25 (Okapi) sobre los fragmentos. El título y la sección se indexan con un
 * peso extra (repetición de términos, una forma simple de BM25F) porque en
 * manuales operativos el encabezado resume de qué trata el fragmento.
 */
export class BM25Index {
  private docs: { id: string; tf: Map<string, number>; len: number }[] = [];
  private df = new Map<string, number>();
  private avgLen = 0;
  private k1: number;
  private b: number;

  constructor(chunks: DocumentChunk[], k1 = 1.2, b = 0.75, headingBoost = 2) {
    this.k1 = k1;
    this.b = b;
    for (const c of chunks) {
      const terms = [
        ...Array(headingBoost).fill(tokenize(`${c.title} ${c.section}`)).flat(),
        ...tokenize(c.content),
      ];
      const tf = new Map<string, number>();
      for (const t of terms) tf.set(t, (tf.get(t) || 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
      this.docs.push({ id: c.id, tf, len: terms.length });
    }
    this.avgLen = this.docs.reduce((n, d) => n + d.len, 0) / Math.max(1, this.docs.length);
  }

  private idf(term: string): number {
    const n = this.docs.length;
    const df = this.df.get(term) || 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  search(query: string, topK = 20): { id: string; score: number }[] {
    const qTerms = Array.from(new Set(tokenize(query, { expandAcronyms: true })));
    if (!qTerms.length) return [];
    const scored = this.docs.map((d) => {
      let score = 0;
      for (const t of qTerms) {
        const f = d.tf.get(t);
        if (!f) continue;
        score += (this.idf(t) * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.len) / this.avgLen));
      }
      return { id: d.id, score };
    });
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
