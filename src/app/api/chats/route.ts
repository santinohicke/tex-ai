import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { listChats, saveChat } from '@/lib/storage/chat-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session || !session.authenticated) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const chats = listChats();
  return NextResponse.json({ chats });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.authenticated) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, title, messages } = body;

    if (!id || !messages) {
      return NextResponse.json({ error: 'Faltan parámetros id o messages' }, { status: 400 });
    }

    const saved = saveChat({ id, title, messages });
    return NextResponse.json({ chat: saved });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Error guardando chat: ${msg}` }, { status: 500 });
  }
}
