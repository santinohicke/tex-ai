export interface DocumentChunk {
  id: string; // estable por documento: "TEX-FCI-001#3"
  docCode: string;
  sourceDoc: string;
  title: string;
  section: string;
  content: string;
  contextText: string; // título + sección + contenido: lo que se indexa y se embebe
  tokensApprox: number;
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SourceRef {
  n: number; // número de cita [n]
  id: string;
  title: string;
  section: string;
  file: string;
  snippet: string;
  relevance?: number;
}

// Traza completa de una consulta, para depurar cada etapa del pipeline.
export interface RagTrace {
  query: string;
  standaloneQuery: string;
  rewritten: boolean;
  bm25: { id: string; score: number }[];
  dense: { id: string; score: number }[] | null;
  denseError?: string;
  fused: { id: string; score: number; bm25Rank: number | null; denseRank: number | null }[];
  rerank: { id: string; relevance: number }[] | null;
  rerankError?: string;
  selected: string[];
  decision: 'answer' | 'insufficient_evidence';
  decisionReason: string;
  timingsMs: Record<string, number>;
  config: Record<string, string | number | boolean>;
}
