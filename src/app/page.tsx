'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Lock,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  Layers,
  ArrowUpRight,
  Trash2,
  Plus,
  PanelLeft,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  LogIn,
  X,
  Activity,
  BarChart3,
} from 'lucide-react';
import { DEMO_FAQS } from '@/lib/demo/faqs';
import RagInspector, { type InspectorTrace } from './components/RagInspector';
import ActivityPanel from './components/ActivityPanel';
import Typewriter from './components/Typewriter';

interface Source {
  n?: number;
  id?: string;
  title: string;
  section: string;
  file: string;
  snippet: string;
  relevance?: number;
  cited?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  trace?: InspectorTrace;
  typing?: boolean; // se está mostrando con el efecto de tipeo
}

// Registro de actividad anónimo (lo guarda el worker de Cloudflare: sin cookies ni IPs).
function visitId(): string {
  try {
    let v = sessionStorage.getItem('tex_vid');
    if (!v) {
      v = Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem('tex_vid', v);
    }
    return v;
  } catch {
    return 'anon';
  }
}

function track(type: 'visit' | 'faq' | 'login' | 'chat', extra: Record<string, unknown> = {}) {
  try {
    fetch('/api/_evt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, vid: visitId(), ...extra }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

const MAINTENANCE_MSG =
  'El servidor está en mantenimiento, probá en unos minutos. Mientras tanto podés ver las consultas frecuentes.';

// Convierte las citas [1] / [1, 2] en enlaces internos que se renderizan como insignias.
function linkCitations(text: string): string {
  return text.replace(/\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g, (_m, nums: string) =>
    nums
      .split(',')
      .map((n) => `[${n.trim()}](#cite-${n.trim()})`)
      .join('')
  );
}

interface ChatSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

// Limpia citas robóticas del inicio y notas de riesgo/omitido del final
function cleanMessageContent(text: string): string {
  if (!text) return '';
  return text
    .replace(/^Conforme a lo (establecido|detallado|indicado) en (el|los)?\s*\[DOCUMENTO FUENTE \d+\][^\n:]*[:.]?\s*/i, '')
    .replace(/^De acuerdo (con|a) lo (establecido|detallado|indicado) en (el|los)?\s*\[DOCUMENTO FUENTE \d+\][^\n:]*[:.]?\s*/i, '')
    .replace(/^Según lo establecido en [^\n:]*[:.]?\s*/i, '')
    .replace(/\[DOCUMENTO FUENTE \d+\]/gi, '')
    .replace(/---\s*\n\s*\*?(No se verificaron|Omitido|No verificado|Riesgo)[\s\S]*$/gi, '')
    .replace(/\n\s*\*?(Omitido|No verificado|Riesgo):[\s\S]*$/gi, '')
    .trim();
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  // Estado del Sidebar e Historial de Chats
  // null = por defecto según el ancho (lo resuelve CSS, sin parpadeo): abierto en escritorio, cerrado en celular
  const [sidebarOpen, setSidebarOpen] = useState<boolean | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [expandedInspector, setExpandedInspector] = useState<Record<string, boolean>>({});
  const [highlightSource, setHighlightSource] = useState<{ msgId: string; n: number } | null>(null);
  const [streamStage, setStreamStage] = useState<'retrieval' | 'generation' | null>(null);

  const initialGreeting: Message = {
    id: 'welcome',
    role: 'assistant',
    content:
      '¡Hola! Soy **Tex AI**, tu asistente de operaciones financieras y normativa: fondos, ONs, futuros, transferencias y compliance. ¿En qué te ayudo?',
  };

  const [messages, setMessages] = useState<Message[]>([initialGreeting]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Scroll estilo lector: al preguntar, la vista sigue la respuesta solo hasta que la
  // pregunta llega arriba; desde ahí se queda quieta para leer desde el principio.
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorIdRef = useRef<string | null>(null);
  const followRef = useRef(false);


  // Cargar lista de chats desde el servidor
  const loadChats = async () => {
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        const data = await res.json();
        if (data.chats) {
          setChats(data.chats);
        }
      }
    } catch {
      // Ignorar errores de red temporales
    }
  };

  // 1. Cargar estado de sesión
  useEffect(() => {
    let offline = false;
    fetch('/api/auth')
      .then((res) => {
        if (res.ok) return res.json();
        offline = res.status >= 502;
        throw new Error('Not authenticated');
      })
      .then((data) => {
        if (data.authenticated) {
          setIsAuthenticated(true);
          loadChats();
          track('visit', { logged: true });
        } else {
          setIsAuthenticated(false);
          track('visit');
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        track('visit', { offline });
      });
  }, []);

  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = isStreaming || messages.some((m) => m.typing);
  });

  const followAnchor = () => {
    const c = scrollRef.current;
    if (!c) return;
    if (!anchorIdRef.current) {
      c.scrollTop = 0;
      return;
    }
    if (!followRef.current) return;
    const el = document.getElementById(`msg-${anchorIdRef.current}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - 12;
    c.scrollTop = Math.max(0, Math.min(top, c.scrollHeight - c.clientHeight));
    if (!busyRef.current && top <= c.scrollTop + 1) followRef.current = false;
  };

  useEffect(() => {
    followAnchor();
  }, [messages, isStreaming]);

  const finishTyping = (id: string) =>
    setMessages((prev) => prev.map((x) => (x.id === id ? { ...x, typing: false } : x)));

  // Si el usuario se desplaza a mano durante la respuesta, se deja de seguir
  const stopFollowing = () => {
    if (busyRef.current) followRef.current = false;
  };

  const anchorOn = (userMsgId: string | null) => {
    anchorIdRef.current = userMsgId;
    followRef.current = Boolean(userMsgId);
  };

  // Guardar chat actual en el servidor
  const persistChat = async (chatId: string, updatedMessages: Message[], customTitle?: string) => {
    try {
      await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: chatId,
          title: customTitle,
          messages: updatedMessages,
        }),
      });
      loadChats();
    } catch {
      // ignore
    }
  };

  // Iniciar un nuevo chat
  const handleNewChat = () => {
    anchorOn(null);
    setCurrentChatId(null);
    setMessages([initialGreeting]);
    setExpandedSources({});
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  // Seleccionar un chat existente del historial
  const handleSelectChat = async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.chat && data.chat.messages) {
          setCurrentChatId(data.chat.id);
          const lastUser = [...data.chat.messages].reverse().find((x: Message) => x.role === 'user');
          anchorOn(lastUser ? lastUser.id : null);
          setMessages(data.chat.messages);
          setExpandedSources({});
          if (window.innerWidth < 768) {
            setSidebarOpen(false);
          }
        }
      }
    } catch {
      // ignore
    }
  };

  // Eliminar un chat del historial
  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
      if (res.ok) {
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        if (currentChatId === chatId) {
          handleNewChat();
        }
      }
    } catch {
      // ignore
    }
  };

  const handleLogin = async (e?: React.FormEvent, customPin?: string) => {
    if (e) e.preventDefault();
    setLoginError('');
    const enteredPin = customPin || pin;

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin }),
      });
      if (res.ok) {
        track('login');
        setIsAuthenticated(true);
        setShowLogin(false);
        setPin('');
        setCurrentChatId(null);
        setMessages([initialGreeting]);
        setExpandedSources({});
        loadChats();
      } else {
        const data = await res.json().catch(() => ({}));
        setLoginError(
          data.maintenance || res.status >= 502
            ? MAINTENANCE_MSG
            : data.error || 'Token incorrecto.'
        );
      }
    } catch {
      setLoginError(MAINTENANCE_MSG);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    setIsAuthenticated(false);
    setMessages([initialGreeting]);
    setChats([]);
    setCurrentChatId(null);
    setExpandedSources({});
    anchorOn(null);
  };

  const openLogin = () => {
    setLoginError('');
    setShowLogin(true);
  };

  // Modo público: solo las consultas frecuentes, con respuestas pre-generadas.
  // No llama a la IA ni guarda nada en el servidor.
  const handleDemoQuestion = (faqId: string) => {
    const faq = DEMO_FAQS.find((f) => f.id === faqId);
    if (!faq || isStreaming) return;
    track('faq', { faq: faq.title });
    const now = Date.now();
    const userMessage: Message = { id: `${now}-q`, role: 'user', content: faq.prompt };
    const answerId = `${now}-a`;
    anchorOn(userMessage.id);
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: answerId, role: 'assistant', content: faq.answer, sources: faq.sources, typing: true },
      ]);
      setIsStreaming(false);
    }, 350);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(cleanMessageContent(text));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSources = (msgId: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || isStreaming) return;
    if (!isAuthenticated) {
      openLogin();
      return;
    }
    track('chat', { logged: true });

    setInput('');

    // Determinar o crear el ID del chat
    const activeChatId = currentChatId || Date.now().toString();
    if (!currentChatId) {
      setCurrentChatId(activeChatId);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
    };

    const newMessages = [...messages, userMessage];
    anchorOn(userMessage.id);
    setMessages(newMessages);
    setIsStreaming(true);

    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      sources: [],
      typing: true,
    };

    const updatedWithAssistant = [...newMessages, assistantMessage];
    setMessages(updatedWithAssistant);

    let streamAccumulatedContent = '';
    let streamAccumulatedSources: Source[] = [];
    let streamTrace: InspectorTrace | undefined;
    setStreamStage('retrieval');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setMessages(newMessages);
          setIsAuthenticated(false);
          setChats([]);
          openLogin();
          return;
        }
        const errJson = await res.json().catch(() => ({}));
        if (errJson.maintenance || res.status >= 502) throw new Error(MAINTENANCE_MSG);
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No se pudo inicializar la respuesta.');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.replace('data: ', '').trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'status') {
              setStreamStage(data.stage);
            } else if (data.type === 'trace') {
              streamTrace = data.trace;
              setMessages((prev) =>
                prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, trace: streamTrace } : msg))
              );
            } else if (data.type === 'token') {
              streamAccumulatedContent += data.content;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: streamAccumulatedContent }
                    : msg
                )
              );
            } else if (data.type === 'source') {
              streamAccumulatedSources = [...streamAccumulatedSources, data.source];
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, sources: streamAccumulatedSources }
                    : msg
                )
              );
            } else if (data.type === 'error') {
              streamAccumulatedContent += `\n\n*Aviso:* ${data.content}`;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: streamAccumulatedContent }
                    : msg
                )
              );
            }
          } catch {
            // Manejo tolerante
          }
        }
      }

      // Guardar conversación final en la base de datos del servidor
      const finalAssistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: streamAccumulatedContent,
        sources: streamAccumulatedSources,
        trace: streamTrace,
      };
      const finalMessagesList = [...newMessages, finalAssistantMsg];
      // la respuesta ya está completa: se apaga el indicador antes de guardar en el historial
      setIsStreaming(false);
      setStreamStage(null);
      persistChat(
        activeChatId,
        finalMessagesList.map((msg) => {
          const clean = { ...msg };
          delete clean.typing;
          return clean;
        })
      );
    } catch (err: unknown) {
      const msgText = err instanceof Error ? err.message : 'Error en la conexión';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: msgText === MAINTENANCE_MSG ? msgText : `Error al procesar la respuesta: ${msgText}` }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      setStreamStage(null);
    }
  };

  const showSource = (msgId: string, n: number) => {
    setExpandedSources((prev) => ({ ...prev, [msgId]: true }));
    setHighlightSource({ msgId, n });
    setTimeout(() => {
      document.getElementById(`src-${msgId}-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
    setTimeout(() => setHighlightSource(null), 2200);
  };

  // Mientras se verifica la sesión se muestra el modo público (sin pantalla de carga).
  const isGuest = isAuthenticated !== true;

  // Ventana de inicio de sesión (solo token)
  const loginModal = showLogin && (
    <div
      className="fixed inset-0 z-50 bg-[#141413]/30 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={() => setShowLogin(false)}
    >
      <div
        className="relative w-full max-w-sm bg-[#f4efe6] border border-[#ded5c6] rounded-2xl p-8 shadow-[0_8px_32px_rgba(20,20,19,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setShowLogin(false)}
          title="Cerrar"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-[#8e887e] hover:text-[#141413] hover:bg-[#ece5d8] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#ece5d8] border border-[#ded5c6] flex items-center justify-center p-2 shadow-xs">
            <img src="/tex-mark-transparent.png" alt="Tex AI" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-serif-display text-2xl font-normal tracking-tight text-[#141413]">
            Iniciar sesión
          </h1>
          <p className="text-xs text-[#8e887e] tracking-wide mt-1">
            Con tu token podés escribir consultas propias y ver tu historial.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#6c6860] mb-1.5">
              Token de acceso
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Ingresá tu token de acceso"
              autoFocus
              autoComplete="current-password"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4efe6] border border-[#ded5c6] text-[#141413] placeholder-[#8e887e] text-sm focus:outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15 transition-all"
            />
          </div>

          {loginError && (
            <div className="text-xs text-[#c64545] bg-[#c64545]/10 border border-[#c64545]/20 p-2.5 rounded-xl">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={!pin.trim()}
            className="w-full py-2.5 px-4 bg-[#cc785c] hover:bg-[#a9583e] active:bg-[#a9583e] disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all shadow-sm flex items-center justify-center space-x-2"
          >
            <LogIn className="h-4 w-4" />
            <span>Entrar</span>
          </button>
        </form>
      </div>
    </div>
  );

  // Interfaz Principal con Historial Lateral
  return (
    <div className="h-dvh bg-[#f4efe6] text-[#141413] flex font-sans overflow-hidden">
      {loginModal}
      {showActivity && !isGuest && <ActivityPanel onClose={() => setShowActivity(false)} />}
      {/* Sidebar Lateral de Historial de Chats */}
      <aside
        className={`${
          sidebarOpen === null
            ? '-translate-x-full w-0 md:translate-x-0 md:w-64'
            : sidebarOpen
            ? 'translate-x-0 w-64'
            : '-translate-x-full w-0'
        } transition-all duration-300 ease-in-out bg-[#ece5d8] border-r border-[#ded5c6] flex flex-col z-30 fixed inset-y-0 left-0 md:static overflow-hidden flex-shrink-0 shadow-sm md:shadow-none`}
      >
        <div className="p-4 border-b border-[#ded5c6] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded-lg overflow-hidden bg-[#f4efe6] border border-[#ded5c6] flex items-center justify-center p-1">
              <img
                src="/tex-mark-transparent.png"
                alt="Tex AI"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-serif-display text-base font-normal tracking-tight text-[#141413]">
              Tex AI
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-[#6c6860] hover:text-[#141413] hover:bg-[#ded5c6]"
          >
            ✕
          </button>
        </div>

        {/* Botón "+ Nuevo chat" Arriba de todo */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full py-2.5 px-3.5 bg-[#f4efe6] hover:bg-[#e7dfd1] active:bg-[#ded5c6] border border-[#ded5c6] text-[#141413] rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs transition-all group"
          >
            <div className="flex items-center space-x-2">
              <Plus className="h-4 w-4 text-[#cc785c]" />
              <span>Nuevo chat</span>
            </div>
            <span className="text-[10px] text-[#8e887e] group-hover:text-[#cc785c]">↵</span>
          </button>
        </div>

        {/* Lista de Chats en Servidor */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8e887e]">
            Historial de chats
          </div>

          {isGuest ? (
            <div className="px-3 py-6 text-center text-xs text-[#8e887e]">
              El historial se guarda con sesión iniciada.
            </div>
          ) : chats.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-[#8e887e]">
              No hay chats previos guardados.
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => handleSelectChat(chat.id)}
                className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-colors ${
                  currentChatId === chat.id
                    ? 'bg-[#f4efe6] text-[#141413] font-medium border border-[#ded5c6] shadow-xs'
                    : 'text-[#6c6860] hover:bg-[#e7dfd1] hover:text-[#141413]'
                }`}
              >
                <div className="flex items-center space-x-2 truncate pr-1">
                  <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-[#8e887e] group-hover:text-[#cc785c]" />
                  <span className="truncate">{chat.title}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteChat(e, chat.id)}
                  title="Eliminar chat"
                  className="opacity-0 group-hover:opacity-100 p-1 text-[#8e887e] hover:text-[#c64545] transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer del Sidebar */}
        <div className="p-3 border-t border-[#ded5c6] flex items-center justify-between text-xs text-[#8e887e]">
          <span className="text-[11px]">{isGuest ? 'Modo público' : 'Tex AI v1.0'}</span>
          {!isGuest && (
            <div className="flex items-center">
            <button
              onClick={() => setShowActivity(true)}
              title="Visitas y consultas de quienes abrieron el link"
              className="flex items-center space-x-1 p-1.5 rounded-lg hover:bg-[#ded5c6] text-[#6c6860] hover:text-[#141413] transition-colors"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="text-[11px]">Actividad</span>
            </button>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex items-center space-x-1 p-1.5 rounded-lg hover:bg-[#ded5c6] text-[#6c6860] hover:text-[#141413] transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="text-[11px]">Salir</span>
            </button>
            </div>
          )}
        </div>
      </aside>

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-[#ded5c6] bg-[#f4efe6]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={() => setSidebarOpen((prev) => !(prev ?? window.innerWidth >= 768))}
              title="Mostrar u ocultar historial"
              className="p-2 rounded-xl text-[#6c6860] hover:text-[#141413] hover:bg-[#ece5d8] transition-colors flex-shrink-0"
            >
              <PanelLeft className="h-4 w-4" />
            </button>

            <div className="flex flex-col min-w-0">
              <span className="font-serif-display text-base leading-tight tracking-tight text-[#141413] truncate">
                {chats.find((c) => c.id === currentChatId)?.title || 'Nueva consulta'}
              </span>
              <span className="text-[10px] text-[#8e887e] tracking-wider truncate">
                Operaciones Bursátiles y Normativas
              </span>
            </div>
          </div>

          {isGuest ? (
            <button
              onClick={openLogin}
              className="flex items-center space-x-2 py-2 px-3.5 rounded-xl bg-[#cc785c] hover:bg-[#a9583e] active:bg-[#a9583e] text-white text-xs font-medium shadow-xs transition-colors flex-shrink-0"
            >
              <LogIn className="h-4 w-4" />
              <span>Iniciar sesión</span>
            </button>
          ) : (
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex items-center space-x-1.5 py-2 px-3 rounded-xl text-[#6c6860] hover:text-[#141413] hover:bg-[#ece5d8] text-xs transition-colors flex-shrink-0"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          )}
        </header>

        {/* Scrollable Chat Area */}
        <div
          ref={scrollRef}
          onWheel={stopFollowing}
          onTouchMove={stopFollowing}
          className="flex-1 overflow-y-auto px-4 sm:px-6 pt-5 pb-3"
        >
          {/* Pantalla inicial centrada verticalmente hasta que se pregunta algo */}
          <div className={messages.length === 1 ? 'min-h-full flex flex-col justify-center pb-4' : ''}>
          <div className="max-w-3xl w-full mx-auto space-y-5">
            {messages
              .filter(
                (m) =>
                  !(
                    m.role === 'assistant' &&
                    !m.content.trim() &&
                    isStreaming
                  )
              )
              .map((m) => (
                <div
                  key={m.id}
                  id={`msg-${m.id}`}
                  className={`flex ${
                    m.role === 'user' ? 'justify-end' : 'justify-start items-start space-x-3'
                  }`}
                >
                  {/* Logo de Tex pequeño en el lado de la IA */}
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 mt-1 bg-[#ece5d8] border border-[#ded5c6] flex items-center justify-center p-1 shadow-xs">
                      <img
                        src="/tex-mark-transparent.png"
                        alt="Tex"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  {/* Burbuja de Mensaje */}
                  <div
                    className={`rounded-2xl ${
                      m.role === 'user'
                        ? 'px-5 py-3.5 max-w-[85%] bg-[#ece5d8] border border-[#ded5c6] text-[#141413]'
                        : 'px-2 pt-1 flex-1 max-w-[90%] text-[#32312e]'
                    }`}
                  >
                    {/* Contenido Markdown Sanitizado */}
                    {m.content && (
                      <div className="editorial-prose">
                        {(() => {
                          const md = (text: string) => (
                        <ReactMarkdown
                          components={{
                            a: ({ href, children }) => {
                              const cite = href?.match(/^#cite-(\d+)$/);
                              if (cite) {
                                const n = Number(cite[1]);
                                const src = m.sources?.find((s) => s.n === n);
                                return (
                                  <button
                                    type="button"
                                    onClick={() => showSource(m.id, n)}
                                    title={src ? `${src.title} > ${src.section}` : `Fuente ${n}`}
                                    className="inline-flex items-center justify-center align-super mx-[1px] min-w-[16px] h-[16px] px-1 rounded-[5px] bg-[#cc785c]/15 hover:bg-[#cc785c]/30 text-[#a9583e] text-[10px] font-semibold leading-none no-underline transition-colors"
                                  >
                                    {n}
                                  </button>
                                );
                              }
                              return (
                                <a href={href} target="_blank" rel="noreferrer">
                                  {children}
                                </a>
                              );
                            },
                          }}
                        >
                          {linkCitations(cleanMessageContent(text))}
                        </ReactMarkdown>
                          );
                          return m.typing ? (
                            <Typewriter
                              text={m.content}
                              streaming={isStreaming && m.id === messages[messages.length - 1]?.id}
                              onProgress={followAnchor}
                              onDone={() => finishTyping(m.id)}
                            >
                              {md}
                            </Typewriter>
                          ) : (
                            md(m.content)
                          );
                        })()}
                      </div>
                    )}

                    {/* Pie de la respuesta: fuentes e inspector a la izquierda, copiar a la derecha */}
                    {m.role === 'assistant' && m.id !== 'welcome' && m.content && !m.typing && (
                      <div className="mt-3 pt-2 border-t border-[#ded5c6] animate-fadeIn">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1.5">
                            {m.sources && m.sources.length > 0 && (
                              <button
                                onClick={() => toggleSources(m.id)}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#ece5d8] hover:bg-[#e7dfd1] border border-[#ded5c6] text-xs font-medium text-[#6c6860] hover:text-[#141413] transition-colors"
                              >
                                <Layers className="h-3.5 w-3.5 text-[#cc785c]" />
                                <span>Fuentes ({m.sources.length})</span>
                                {expandedSources[m.id] ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
                              </button>
                            )}
                            {m.trace && !isGuest && (
                              <button
                                onClick={() => setExpandedInspector((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                                title="Ver cada etapa de la búsqueda: reescritura, BM25, embeddings, fusión, reranking y decisión"
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#ece5d8] hover:bg-[#e7dfd1] border border-[#ded5c6] text-xs font-medium text-[#6c6860] hover:text-[#141413] transition-colors"
                              >
                                <Activity className="h-3.5 w-3.5 text-[#cc785c]" />
                                <span>Inspector</span>
                                <span className="text-[10px] text-[#8e887e] font-mono">
                                  {m.trace.timingsMs.total + (m.trace.generation?.ms || 0)} ms
                                </span>
                                {expandedInspector[m.id] ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
                              </button>
                            )}
                          </div>
                          <button
                            onClick={() => handleCopy(m.id, m.content)}
                            className="text-xs text-[#8e887e] hover:text-[#141413] transition-colors flex items-center space-x-1 py-1 flex-shrink-0"
                            title="Copiar respuesta"
                          >
                            {copiedId === m.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-[#5db872]" />
                                <span className="text-[#5db872] text-[11px]">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span className="text-[11px]">Copiar</span>
                              </>
                            )}
                          </button>
                        </div>

                        {expandedSources[m.id] && m.sources && (
                          <div className="mt-2.5 space-y-1.5 animate-fadeIn max-h-72 overflow-y-auto pr-1">
                            {[...m.sources]
                              .sort((x, y) => Number(Boolean(y.cited)) - Number(Boolean(x.cited)) || (x.n || 0) - (y.n || 0))
                              .map((src, idx) => (
                                <div
                                  key={src.id || idx}
                                  id={src.n ? `src-${m.id}-${src.n}` : undefined}
                                  className={`p-2.5 rounded-xl border text-xs transition-colors ${
                                    highlightSource?.msgId === m.id && highlightSource.n === src.n
                                      ? 'bg-[#cc785c]/10 border-[#cc785c]/50'
                                      : 'bg-[#ece5d8] border-[#ded5c6]'
                                  } ${src.cited === false ? 'opacity-60' : ''}`}
                                >
                                  <div className="flex items-center justify-between font-medium text-[#141413] gap-2">
                                    <span className="flex items-center min-w-0">
                                      {src.n && (
                                        <span className="mr-1.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-[5px] bg-[#cc785c]/15 text-[#a9583e] text-[10px] font-semibold flex-shrink-0">
                                          {src.n}
                                        </span>
                                      )}
                                      <span className="truncate">{src.title}</span>
                                    </span>
                                    <span className="text-[10px] text-[#8e887e] flex-shrink-0">{src.cited === false ? 'no citada' : ''}</span>
                                  </div>
                                  <div className="text-[10px] text-[#cc785c] font-mono mt-0.5 truncate">§ {src.section}</div>
                                  <p className="text-[11px] text-[#6c6860] italic mt-1 leading-snug line-clamp-3">&quot;{src.snippet}&quot;</p>
                                </div>
                              ))}
                          </div>
                        )}

                        {expandedInspector[m.id] && m.trace && !isGuest && <RagInspector trace={m.trace} />}
                      </div>
                    )}
                </div>
              </div>
            ))}

            {/* Indicador de Streaming */}
            {isStreaming && !(messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content.trim()) && (
              <div className="flex items-center space-x-3 text-xs text-[#6c6860] pt-2">
                <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 bg-[#ece5d8] border border-[#ded5c6] flex items-center justify-center p-1">
                  <img
                    src="/tex-mark-transparent.png"
                    alt="Tex"
                    className="w-full h-full object-contain animate-pulse"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#cc785c]" />
                  <span>{streamStage === 'generation' ? 'Redactando la respuesta…' : 'Buscando en los manuales…'}</span>
                </div>
              </div>
            )}

          </div>

          {/* Consultas frecuentes: solo al entrar o en un chat nuevo */}
          {messages.length === 1 && (
            <div className="max-w-3xl w-full mx-auto mt-5">
              <h3 className="font-serif-display text-base sm:text-lg text-[#141413] mb-2.5">Consultas frecuentes</h3>
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                {DEMO_FAQS.map((item) => (
                  <button
                    key={item.id}
                    disabled={isStreaming}
                    onClick={() => (isGuest ? handleDemoQuestion(item.id) : handleSend(item.prompt))}
                    className="text-left p-3 sm:p-3.5 rounded-xl bg-[#ece5d8] hover:bg-[#e7dfd1] border border-[#ded5c6] transition-colors group flex items-start justify-between"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#141413] sm:mb-1">{item.title}</div>
                      <div className="hidden sm:block text-xs text-[#6c6860] line-clamp-2 leading-relaxed">{item.prompt}</div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-[#8e887e] group-hover:text-[#cc785c] flex-shrink-0 ml-2 mt-0.5 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Floating Input Dock */}
        <div className="flex-shrink-0 bg-[#f4efe6] pt-2 pb-4 px-4 sm:px-6">
          <div className="max-w-3xl w-full mx-auto">
            {isGuest ? (
              <div
                aria-disabled="true"
                className="w-full flex items-center space-x-3 bg-[#ece5d8] border border-[#ded5c6] rounded-2xl p-2 pl-4 cursor-not-allowed select-none"
              >
                <Lock className="h-4 w-4 text-[#8e887e] flex-shrink-0" />
                <span className="flex-1 py-2 text-sm text-[#8e887e] truncate">
                  Iniciá sesión para escribir tus propias consultas
                </span>
              </div>
            ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center space-x-2 bg-[#f4efe6] border border-[#ded5c6] focus-within:border-[#cc785c] focus-within:ring-2 focus-within:ring-[#cc785c]/15 rounded-2xl p-2 shadow-[0_2px_12px_rgba(20,20,19,0.04)] transition-all"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu consulta aquí..."
                disabled={isStreaming}
                className="flex-1 bg-transparent px-3 py-2 text-sm text-[#141413] placeholder-[#8e887e] focus:outline-none"
              />

              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="h-9 w-9 rounded-xl bg-[#cc785c] hover:bg-[#a9583e] active:bg-[#a9583e] disabled:opacity-40 disabled:hover:bg-[#cc785c] text-white flex items-center justify-center transition-colors flex-shrink-0 shadow-xs"
                title="Enviar mensaje"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
