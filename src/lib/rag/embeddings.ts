// Embeddings para la búsqueda densa. Claude no ofrece un modelo de embeddings: se usa
// Voyage AI, el proveedor que recomienda Anthropic para usar junto a Claude.
// Es opcional: sin VOYAGE_API_KEY el pipeline funciona solo con BM25 + reranking de Claude.

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';

export const EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL || 'voyage-3.5';
export const EMBEDDING_DIMS = Number(process.env.RAG_EMBEDDING_DIMS || 1024);

export function embeddingsEnabled(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

export type EmbedTask = 'query' | 'document';

function l2normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

export async function embedTexts(
  texts: string[],
  task: EmbedTask,
  opts: { model?: string; dims?: number; timeoutMs?: number } = {}
): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error('VOYAGE_API_KEY no configurada (búsqueda densa desactivada)');
  const model = opts.model || EMBEDDING_MODEL;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 128) {
    const batch = texts.slice(i, i + 128);
    let data: { data: { embedding: number[]; index: number }[] } | null = null;
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(VOYAGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          input: batch,
          model,
          input_type: task,
          output_dimension: opts.dims || EMBEDDING_DIMS,
        }),
        signal: AbortSignal.timeout(opts.timeoutMs || 30000),
      });
      if (res.ok) {
        data = await res.json();
        break;
      }
      // Límite por minuto: se espera y se reintenta (solo en procesos sin apuro, como la indexación)
      if (res.status === 429 && attempt < 4 && !(opts.timeoutMs && opts.timeoutMs < 15000)) {
        await new Promise((r) => setTimeout(r, 20000));
        continue;
      }
      throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    for (const row of [...data!.data].sort((a, b) => a.index - b.index)) out.push(l2normalize(row.embedding));
  }
  return out;
}

export function cosine(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
