import { NextResponse } from 'next/server';
import { vectorStore } from '@/lib/rag/vector-store';
import path from 'path';

export async function GET() {
  let stats = vectorStore.getStats();
  if (stats.chunksCount === 0) {
    const policiesDir = path.join(process.cwd(), 'data', 'policies');
    vectorStore.init(policiesDir);
    stats = vectorStore.getStats();
  }

  const provider = process.env.LLM_PROVIDER || 'hybrid';
  const model =
    provider === 'claude'
      ? process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'
      : provider === 'hybrid'
      ? 'Gemini 3.8 Flash (High) via PC Bridge (Fallback: Gemini Flash-Lite Latest)'
      : process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  return NextResponse.json({
    status: 'online',
    system: 'Tex AI - Internal Financial Operations Assistant',
    provider,
    model,
    indexedDocuments: stats.documents,
    totalChunks: stats.chunksCount,
  });
}
