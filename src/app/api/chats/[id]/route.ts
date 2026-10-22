import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getChat, deleteChat } from '@/lib/storage/chat-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !session.authenticated) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const chat = getChat(id);
  if (!chat) {
    return NextResponse.json({ error: 'Chat no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ chat });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !session.authenticated) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const deleted = deleteChat(id);
  return NextResponse.json({ success: deleted });
}
