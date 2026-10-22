import fs from 'fs';
import path from 'path';

export interface Source {
  title: string;
  section: string;
  file: string;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

export interface ChatSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatDetail extends ChatSummary {
  messages: ChatMessage[];
}

const CHATS_DIR = path.join(process.cwd(), 'data', 'chats');
const INDEX_FILE = path.join(CHATS_DIR, 'index.json');

function ensureDir() {
  if (!fs.existsSync(CHATS_DIR)) {
    fs.mkdirSync(CHATS_DIR, { recursive: true });
  }
}

function readIndex(): ChatSummary[] {
  ensureDir();
  if (!fs.existsSync(INDEX_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(INDEX_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeIndex(index: ChatSummary[]) {
  ensureDir();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
}

export function listChats(): ChatSummary[] {
  const index = readIndex();
  return index.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getChat(id: string): ChatDetail | null {
  ensureDir();
  const filePath = path.join(CHATS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveChat(chat: { id: string; title?: string; messages: ChatMessage[] }): ChatDetail {
  ensureDir();
  const now = Date.now();
  const existing = getChat(chat.id);

  // Generar título automático si no existe o si tiene título por defecto
  let title = chat.title || existing?.title;
  if (!title || title === 'Nuevo chat') {
    const firstUserMsg = chat.messages.find((m) => m.role === 'user');
    if (firstUserMsg && firstUserMsg.content) {
      title = firstUserMsg.content.slice(0, 40).trim();
      if (firstUserMsg.content.length > 40) title += '...';
    } else {
      title = 'Nueva consulta';
    }
  }

  const detail: ChatDetail = {
    id: chat.id,
    title,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    messages: chat.messages,
  };

  const filePath = path.join(CHATS_DIR, `${chat.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(detail, null, 2), 'utf-8');

  // Actualizar index
  const index = readIndex();
  const idx = index.findIndex((c) => c.id === chat.id);
  const summary: ChatSummary = {
    id: detail.id,
    title: detail.title,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };

  if (idx >= 0) {
    index[idx] = summary;
  } else {
    index.unshift(summary);
  }

  writeIndex(index);
  return detail;
}

export function deleteChat(id: string): boolean {
  ensureDir();
  const filePath = path.join(CHATS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  }

  const index = readIndex();
  const filtered = index.filter((c) => c.id !== id);
  writeIndex(filtered);
  return true;
}
