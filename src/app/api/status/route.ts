import { NextResponse } from 'next/server';
import { getRagPipeline } from '@/lib/rag/engine';
import { EMBEDDING_MODEL, embeddingsEnabled } from '@/lib/rag/embeddings';
import { FAST_MODEL } from '@/lib/rag/llm-json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const rag = getRagPipeline();
  return NextResponse.json({
    status: 'online',
    system: 'Tex AI - Internal Financial Operations Assistant',
    provider: 'anthropic',
    model: process.env.CLAUDE_MODEL || 'claude-opus-5-5',
    retrieval: {
      strategy: embeddingsEnabled()
        ? 'query rewrite → hybrid BM25 + dense (convex fusion) → Claude rerank → evidence threshold → cited generation'
        : 'query rewrite → BM25 → Claude rerank → evidence threshold → cited generation',
      embeddingModel: embeddingsEnabled() ? EMBEDDING_MODEL : null,
      rerankModel: FAST_MODEL,
    },
    indexedDocuments: Array.from(new Set(rag.chunks.map((c) => c.sourceDoc))),
    totalChunks: rag.chunks.length,
  });
}
