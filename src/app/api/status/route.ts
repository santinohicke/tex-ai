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

  const provider = 'claude';
  const model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';

  return NextResponse.json({
    status: 'online',
    system: 'Tex AI - Internal Financial Operations Assistant',
    provider,
    model,
    indexedDocuments: stats.documents,
    totalChunks: stats.chunksCount,
  });
}
