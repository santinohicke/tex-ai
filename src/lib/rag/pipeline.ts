import crypto from 'node:crypto';
import type { DocumentChunk, LLMMessage, RagTrace } from './types.ts';
import { chunkMarkdown, DEFAULT_CHUNK_OPTIONS, type ChunkOptions } from './chunker.ts';
import { BM25Index } from './bm25.ts';
import { cosine, embedTexts, embeddingsEnabled, EMBEDDING_DIMS, EMBEDDING_MODEL } from './embeddings.ts';
import { generateJSON, FAST_MODEL } from './llm-json.ts';

export interface PipelineConfig {
  useRewrite: boolean;
  useDense: boolean;
  useBm25: boolean;
  useRerank: boolean;
  bm25K: number; // candidatos de BM25
  denseK: number; // candidatos densos
  rrfK: number; // constante de Reciprocal Rank Fusion
  fusion: 'rrf' | 'convex'; // RRF por posiciones o combinación convexa de puntajes normalizados
  bm25Weight: number; // peso de BM25 en la fusión (calibrado con scripts/eval)
  denseWeight: number; // peso de los embeddings en la fusión
  rerankCandidates: number; // cuántos fusionados pasan al reordenamiento
  finalK: number; // máximo de fragmentos que llegan al modelo
  minRelevance: number; // relevancia mínima (0-3) del reranker para usar un fragmento
  denseFloor: number; // sin reranker: similitud mínima para considerar que hay evidencia
}

export const DEFAULT_CONFIG: PipelineConfig = {
  useRewrite: true,
  useDense: true,
  useBm25: true,
  useRerank: true,
  bm25K: 20,
  denseK: 20,
  rrfK: 60,
  // Calibrado con scripts/eval/sweep.ts: con RRF (k=60) BM25 desordenaba el top de los
  // embeddings; la fusión convexa con peso bajo para BM25 nunca empeora y ayuda en términos exactos.
  fusion: 'convex',
  bm25Weight: 0.2,
  denseWeight: 1,
  rerankCandidates: 12,
  finalK: 5,
  minRelevance: 2,
  // Solo descarta lo claramente ajeno: la similitud no separa preguntas del dominio sin respuesta
  // (medido en scripts/eval); esa decisión la toma el reranking.
  denseFloor: 0.55,
};

export interface EmbeddingCache {
  load(): Record<string, number[]> | null;
  save(entries: Record<string, number[]>): void;
}

export interface Retrieved {
  chunk: DocumentChunk;
  relevance: number | null; // 0-3 del reranker
  fusedScore: number;
}

const hash = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

export class RagPipeline {
  readonly chunks: DocumentChunk[];
  private byId: Map<string, DocumentChunk>;
  private bm25: BM25Index;
  private docEmb: Map<string, number[]> | null = null;
  private embedError: string | null = null;
  private embedPromise: Promise<void> | null = null;
  private queryEmbCache = new Map<string, number[]>();
  private cache?: EmbeddingCache;
  private embeddingModel: string;

  constructor(
    docs: { file: string; text: string }[],
    opts: { chunkOptions?: ChunkOptions; cache?: EmbeddingCache; embeddingModel?: string } = {}
  ) {
    this.chunks = docs.flatMap((d) => chunkMarkdown(d.file, d.text, opts.chunkOptions || DEFAULT_CHUNK_OPTIONS));
    this.byId = new Map(this.chunks.map((c) => [c.id, c]));
    this.bm25 = new BM25Index(this.chunks);
    this.cache = opts.cache;
    this.embeddingModel = opts.embeddingModel || EMBEDDING_MODEL;
  }

  /** Calcula (o lee del caché) los embeddings de todos los fragmentos. Idempotente. */
  ensureEmbeddings(): Promise<void> {
    if (this.docEmb) return Promise.resolve();
    if (!embeddingsEnabled()) {
      this.embedError = 'búsqueda densa desactivada (sin VOYAGE_API_KEY): se usa BM25';
      return Promise.resolve();
    }
    if (!this.embedPromise) {
      this.embedPromise = (async () => {
        const prefix = `${this.embeddingModel}:${EMBEDDING_DIMS}:`;
        const stored = this.cache?.load() || {};
        const missing = this.chunks.filter((c) => !stored[prefix + hash(c.contextText)]);
        if (missing.length) {
          const vecs = await embedTexts(
            missing.map((c) => c.contextText),
            'document',
            { model: this.embeddingModel }
          );
          missing.forEach((c, i) => (stored[prefix + hash(c.contextText)] = vecs[i]));
          const keep: Record<string, number[]> = {};
          for (const c of this.chunks) keep[prefix + hash(c.contextText)] = stored[prefix + hash(c.contextText)];
          this.cache?.save(keep);
        }
        this.docEmb = new Map(this.chunks.map((c) => [c.id, stored[prefix + hash(c.contextText)]]));
        this.embedError = null;
      })().catch((e) => {
        this.embedError = e instanceof Error ? e.message : String(e);
        this.embedPromise = null; // reintentar en la próxima consulta
      });
    }
    return this.embedPromise;
  }

  private async denseSearch(query: string, k: number) {
    await this.ensureEmbeddings();
    if (!this.docEmb) throw new Error(this.embedError || 'embeddings no disponibles');
    let q = this.queryEmbCache.get(query);
    if (!q) {
      [q] = await embedTexts([query], 'query', { model: this.embeddingModel, timeoutMs: 8000 });
      if (this.queryEmbCache.size > 500) this.queryEmbCache.clear();
      this.queryEmbCache.set(query, q);
    }
    return this.chunks
      .map((c) => ({ id: c.id, score: cosine(q!, this.docEmb!.get(c.id)!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /** Convierte la última pregunta en una consulta autónoma usando la conversación. */
  private async rewrite(messages: LLMMessage[]): Promise<string> {
    const history = messages
      .slice(-7, -1)
      .map((m) => `${m.role === 'assistant' ? 'Asistente' : 'Usuario'}: ${m.content.slice(0, 600)}`)
      .join('\n');
    const last = messages[messages.length - 1].content;
    const prompt = `Reescribí la ÚLTIMA pregunta del usuario como una consulta de búsqueda autónoma en español, resolviendo referencias a la conversación previa ("eso", "y en dólares?", "el segundo"). Conservá siglas y términos técnicos. Si ya es autónoma, devolvela igual. No la respondas.

Conversación previa:
${history}

Última pregunta: ${last}`;
    const { data } = await generateJSON<{ query: string }>(
      prompt,
      { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      { timeoutMs: 5000 }
    );
    return data.query?.trim() || last;
  }

  /** Reordena candidatos con un LLM que puntúa cuánto responde cada uno a la consulta. */
  private async rerank(query: string, ids: string[]): Promise<{ id: string; relevance: number }[]> {
    const list = ids
      .map((id, i) => {
        const c = this.byId.get(id)!;
        return `[${i + 1}] ${c.title} > ${c.section}\n${c.content.slice(0, 900)}`;
      })
      .join('\n\n');
    const prompt = `Sos un evaluador de relevancia para un buscador de manuales internos. Para cada fragmento, puntuá cuánto ayuda a responder la consulta:
3 = contiene la respuesta directa
2 = contiene una parte necesaria de la respuesta
1 = mismo tema pero no responde lo preguntado
0 = no relacionado
Sé estricto: un fragmento del mismo tema que no contiene el dato pedido es 1.

Consulta: ${query}

Fragmentos:
${list}`;
    const { data } = await generateJSON<{ ratings: { n: number; relevance: number }[] }>(
      prompt,
      {
        type: 'object',
        properties: {
          ratings: {
            type: 'array',
            items: {
              type: 'object',
              properties: { n: { type: 'integer' }, relevance: { type: 'integer' } },
              required: ['n', 'relevance'],
            },
          },
        },
        required: ['ratings'],
      },
      { timeoutMs: 7000 }
    );
    const out = new Map<string, number>();
    for (const r of data.ratings || []) {
      const id = ids[r.n - 1];
      if (id) out.set(id, Math.max(0, Math.min(3, r.relevance)));
    }
    return ids.map((id) => ({ id, relevance: out.get(id) ?? 0 }));
  }

  async retrieve(
    messages: LLMMessage[],
    cfg: PipelineConfig = DEFAULT_CONFIG
  ): Promise<{ results: Retrieved[]; trace: RagTrace }> {
    const t0 = Date.now();
    const timings: Record<string, number> = {};
    const lap = (name: string, start: number) => (timings[name] = Date.now() - start);
    const query = messages[messages.length - 1].content.trim();
    const hasHistory = messages.slice(0, -1).some((m) => m.role === 'user');

    // 1. Reescritura de la consulta (solo si hay conversación previa)
    let standalone = query;
    let rewritten = false;
    if (cfg.useRewrite && hasHistory) {
      const s = Date.now();
      try {
        standalone = await this.rewrite(messages);
        rewritten = standalone !== query;
      } catch {
        // sin reescritura: se usa la última pregunta junto a la anterior del usuario
        const prevUser = [...messages.slice(0, -1)].reverse().find((m) => m.role === 'user');
        standalone = prevUser ? `${prevUser.content} ${query}` : query;
        rewritten = standalone !== query;
      }
      lap('rewrite', s);
    }

    // 2. Recuperación léxica y densa en paralelo
    let s = Date.now();
    const bm25 = cfg.useBm25 ? this.bm25.search(standalone, cfg.bm25K) : [];
    let dense: { id: string; score: number }[] | null = null;
    let denseError: string | undefined;
    if (cfg.useDense) {
      try {
        dense = await this.denseSearch(standalone, cfg.denseK);
      } catch (e) {
        denseError = e instanceof Error ? e.message : String(e);
      }
    }
    lap('retrieval', s);

    // 3. Fusión por Reciprocal Rank Fusion (robusta a escalas de puntaje distintas)
    const fusedMap = new Map<string, { score: number; bm25Rank: number | null; denseRank: number | null }>();
    const add = (list: { id: string }[], key: 'bm25Rank' | 'denseRank', weight: number) =>
      list.forEach((r, i) => {
        const e = fusedMap.get(r.id) || { score: 0, bm25Rank: null, denseRank: null };
        e.score += weight / (cfg.rrfK + i + 1);
        e[key] = i + 1;
        fusedMap.set(r.id, e);
      });
    if (cfg.fusion === 'convex' && dense) {
      // min-max por consulta y suma ponderada: conserva cuánto mejor es el primero que el segundo
      const mm = (list: { id: string; score: number }[]) => {
        const hi = Math.max(...list.map((r) => r.score), 0);
        const lo = Math.min(...list.map((r) => r.score), hi);
        return new Map(list.map((r) => [r.id, hi > lo ? (r.score - lo) / (hi - lo) : 1]));
      };
      const nb = mm(bm25);
      const nd = mm(dense);
      const w = cfg.bm25Weight / (cfg.bm25Weight + cfg.denseWeight);
      for (const id of new Set([...nb.keys(), ...nd.keys()])) {
        fusedMap.set(id, {
          score: w * (nb.get(id) || 0) + (1 - w) * (nd.get(id) || 0),
          bm25Rank: bm25.findIndex((r) => r.id === id) + 1 || null,
          denseRank: dense.findIndex((r) => r.id === id) + 1 || null,
        });
      }
    } else {
      add(bm25, 'bm25Rank', dense ? cfg.bm25Weight : 1);
      if (dense) add(dense, 'denseRank', cfg.denseWeight);
    }
    const fused = [...fusedMap.entries()]
      .map(([id, e]) => ({ id, ...e }))
      .sort((a, b) => b.score - a.score);

    // 4. Reordenamiento y decisión de evidencia
    let rerank: { id: string; relevance: number }[] | null = null;
    let rerankError: string | undefined;
    let selected: Retrieved[] = [];
    let decision: RagTrace['decision'] = 'answer';
    let decisionReason = '';
    const candidates = fused.slice(0, cfg.rerankCandidates);

    if (cfg.useRerank && candidates.length) {
      s = Date.now();
      try {
        rerank = await this.rerank(standalone, candidates.map((c) => c.id));
      } catch (e) {
        rerankError = e instanceof Error ? e.message : String(e);
      }
      lap('rerank', s);
    }

    if (rerank) {
      const rel = new Map(rerank.map((r) => [r.id, r.relevance]));
      selected = candidates
        .filter((c) => (rel.get(c.id) ?? 0) >= cfg.minRelevance)
        .sort((a, b) => (rel.get(b.id)! - rel.get(a.id)!) || b.score - a.score)
        .slice(0, cfg.finalK)
        .map((c) => ({ chunk: this.byId.get(c.id)!, relevance: rel.get(c.id)!, fusedScore: c.score }));
      decisionReason = selected.length
        ? `${selected.length} fragmentos con relevancia ≥ ${cfg.minRelevance}`
        : `ningún candidato alcanzó relevancia ${cfg.minRelevance} en el reordenamiento`;
    } else {
      selected = candidates
        .slice(0, cfg.finalK)
        .map((c) => ({ chunk: this.byId.get(c.id)!, relevance: null, fusedScore: c.score }));
      const topDense = dense?.[0]?.score ?? 0;
      const weak = dense ? topDense < cfg.denseFloor : bm25.length === 0;
      if (weak) selected = [];
      decisionReason = weak
        ? dense
          ? `similitud máxima ${topDense.toFixed(2)} < ${cfg.denseFloor} (sin reordenamiento)`
          : 'sin coincidencias léxicas (sin reordenamiento)'
        : 'top-K de la fusión (sin reordenamiento)';
    }
    if (!selected.length) decision = 'insufficient_evidence';
    timings.total = Date.now() - t0;

    const round = (x: number) => Math.round(x * 1000) / 1000;
    return {
      results: selected,
      trace: {
        query,
        standaloneQuery: standalone,
        rewritten,
        bm25: bm25.slice(0, 10).map((r) => ({ id: r.id, score: round(r.score) })),
        dense: dense ? dense.slice(0, 10).map((r) => ({ id: r.id, score: round(r.score) })) : null,
        denseError,
        fused: fused.slice(0, 10).map((f) => ({ ...f, score: round(f.score) })),
        rerank,
        rerankError,
        selected: selected.map((r) => r.chunk.id),
        decision,
        decisionReason,
        timingsMs: timings,
        config: {
          embeddingModel: this.docEmb || embeddingsEnabled() ? this.embeddingModel : 'desactivado',
          dims: EMBEDDING_DIMS,
          rerankModel: FAST_MODEL,
          finalK: cfg.finalK,
          minRelevance: cfg.minRelevance,
          rrfK: cfg.rrfK,
          fusion: cfg.fusion,
          bm25Weight: cfg.bm25Weight,
        },
      },
    };
  }

  /** Precalcula embeddings de varias consultas en un solo pedido (evaluación). */
  async warmQueryEmbeddings(queries: string[]) {
    const key = (q: string) => `q:${this.embeddingModel}:${EMBEDDING_DIMS}:${hash(q)}`;
    const stored = this.cache?.load() || {};
    for (const q of queries) if (stored[key(q)]) this.queryEmbCache.set(q, stored[key(q)]);
    const todo = Array.from(new Set(queries.filter((q) => !this.queryEmbCache.has(q))));
    if (!todo.length) return;
    const vecs = await embedTexts(todo, 'query', { model: this.embeddingModel });
    const add: Record<string, number[]> = {};
    todo.forEach((q, i) => {
      this.queryEmbCache.set(q, vecs[i]);
      add[key(q)] = vecs[i];
    });
    this.cache?.save({ ...stored, ...add });
  }

  getChunk(id: string) {
    return this.byId.get(id);
  }
}
