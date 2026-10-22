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
} from 'lucide-react';

interface Source {
  title: string;
  section: string;
  file: string;
  snippet: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
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

  // Estado del Sidebar e Historial de Chats
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  const initialGreeting: Message = {
    id: 'welcome',
    role: 'assistant',
    content:
      '¡Hola! Soy **Tex AI**, tu asistente inteligente para la consulta de operaciones financieras, fondos comunes (FCI), obligaciones negociables (ONs), cauciones, derivados Matba Rofex, transferencias bancarias, cumplimiento AML/KYC y seguridad corporativa.\n\n¿En qué consulta operativa o normativa puedo asistirte hoy?',
  };

  const [messages, setMessages] = useState<Message[]>([initialGreeting]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    fetch('/api/auth')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then((data) => {
        if (data.authenticated) {
          setIsAuthenticated(true);
          loadChats();
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

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
        setIsAuthenticated(true);
        loadChats();
      } else {
        const data = await res.json();
        setLoginError(data.error || 'PIN incorrecto.');
      }
    } catch {
      setLoginError('Error de conexión con el servidor.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    setIsAuthenticated(false);
    setMessages([initialGreeting]);
    setChats([]);
    setCurrentChatId(null);
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
    setMessages(newMessages);
    setIsStreaming(true);

    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      sources: [],
    };

    const updatedWithAssistant = [...newMessages, assistantMessage];
    setMessages(updatedWithAssistant);

    let streamAccumulatedContent = '';
    let streamAccumulatedSources: Source[] = [];

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
          setIsAuthenticated(false);
          return;
        }
        const errJson = await res.json().catch(() => ({}));
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

            if (data.type === 'token') {
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
      };
      const finalMessagesList = [...newMessages, finalAssistantMsg];
      await persistChat(activeChatId, finalMessagesList);
    } catch (err: unknown) {
      const msgText = err instanceof Error ? err.message : 'Error en la conexión';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: `Error al procesar la respuesta: ${msgText}` }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const sampleSuggestions = [
    {
      title: 'Fondos Comunes de Inversión (FCI)',
      prompt: '¿Cuáles son los plazos de liquidación y horarios de corte (cut-off) para Money Market, T+1 y T+2?',
    },
    {
      title: 'Obligaciones Negociables (ONs)',
      prompt: '¿Cómo es la operatoria de ONs Hard Dollar en mercado primario y secundario, y qué covenants aplican?',
    },
    {
      title: 'Futuros y Coberturas Rofex',
      prompt: '¿Cómo funciona la liquidación diaria (mark-to-market) y las garantías en futuros de Dólar Oficial?',
    },
    {
      title: 'Transferencias y Cuentas Espejo',
      prompt: '¿Cuáles son las reglas de titularidad espejo y plazos de acreditación de depósitos y extracciones?',
    },
  ];

  if (isAuthenticated === null) {
    return (
      <main className="min-h-screen bg-[#f4efe6] flex items-center justify-center p-4">
        <div className="flex items-center space-x-3 text-[#6c6860] text-sm">
          <RefreshCw className="h-5 w-5 animate-spin text-[#cc785c]" />
          <span>Iniciando Tex AI...</span>
        </div>
      </main>
    );
  }

  // Pantalla de Login
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#f4efe6] text-[#141413] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-sm bg-[#f4efe6] border border-[#ded5c6] rounded-2xl p-8 shadow-[0_4px_20px_rgba(20,20,19,0.04)]">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#ece5d8] border border-[#ded5c6] flex items-center justify-center p-2 shadow-xs">
              <img
                src="/tex-mark-transparent.png"
                alt="Tex AI"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="font-serif-display text-2xl font-normal tracking-tight text-[#141413]">
              Tex AI
            </h1>
            <p className="text-xs text-[#8e887e] tracking-wide mt-0.5">
              Tu asistente financiero
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
                placeholder="Ingresa tu token de acceso"
                autoFocus
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
              className="w-full py-2.5 px-4 bg-[#cc785c] hover:bg-[#a9583e] active:bg-[#a9583e] text-white font-medium rounded-xl text-sm transition-all shadow-sm flex items-center justify-center space-x-2"
            >
              <Lock className="h-4 w-4" />
              <span>Entrar</span>
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Interfaz Principal con Historial Lateral
  return (
    <div className="min-h-screen bg-[#f4efe6] text-[#141413] flex font-sans overflow-hidden">
      {/* Sidebar Lateral de Historial de Chats */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-0'
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

          {chats.length === 0 ? (
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
          <span className="text-[11px]">Tex AI v1.0</span>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="flex items-center space-x-1 p-1.5 rounded-lg hover:bg-[#ded5c6] text-[#6c6860] hover:text-[#141413] transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="text-[11px]">Salir</span>
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-[#ded5c6] bg-[#f4efe6]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Ocultar historial' : 'Ver historial'}
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
        </header>

        {/* Scrollable Chat Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 pb-28">
          <div className="max-w-3xl w-full mx-auto space-y-6">
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
                    className={`rounded-2xl px-5 py-4 ${
                      m.role === 'user'
                        ? 'max-w-[85%] bg-[#ece5d8] border border-[#ded5c6] text-[#141413]'
                        : 'flex-1 max-w-[90%] bg-[#f4efe6] text-[#32312e]'
                    }`}
                  >
                    {/* Contenido Markdown Sanitizado */}
                    {m.content && (
                      <div className="editorial-prose">
                        <ReactMarkdown>{cleanMessageContent(m.content)}</ReactMarkdown>
                      </div>
                    )}

                    {/* Fuentes Consultadas (Desplegable y Compacto) */}
                    {m.sources && m.sources.length > 0 && m.content && (
                      <div className="mt-3.5 pt-2.5 border-t border-[#ded5c6]">
                        <button
                          onClick={() => toggleSources(m.id)}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#ece5d8] hover:bg-[#e7dfd1] border border-[#ded5c6] text-xs font-medium text-[#6c6860] hover:text-[#141413] transition-colors"
                        >
                          <Layers className="h-3.5 w-3.5 text-[#cc785c]" />
                          <span>Fuentes consultadas ({m.sources.length})</span>
                          {expandedSources[m.id] ? (
                            <ChevronUp className="h-3 w-3 ml-0.5" />
                          ) : (
                            <ChevronDown className="h-3 w-3 ml-0.5" />
                          )}
                        </button>

                      {/* Lista Desplegable Compacta */}
                      {expandedSources[m.id] && (
                        <div className="mt-2.5 space-y-1.5 animate-fadeIn max-h-60 overflow-y-auto pr-1">
                          {m.sources.map((s, idx) => (
                            <div
                              key={idx}
                              className="bg-[#ece5d8] p-2.5 rounded-xl border border-[#ded5c6] text-xs"
                            >
                              <div className="flex items-center justify-between font-medium text-[#141413]">
                                <span className="truncate">{s.title}</span>
                                <span className="text-[10px] text-[#cc785c] font-mono ml-2 flex-shrink-0">
                                  § {s.section}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#6c6860] italic mt-1 leading-snug line-clamp-2">
                                &quot;{s.snippet}&quot;
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Botón de Copiar */}
                  {m.role === 'assistant' && m.id !== 'welcome' && m.content && (
                    <div className="mt-2.5 pt-2 flex items-center justify-end">
                      <button
                        onClick={() => handleCopy(m.id, m.content)}
                        className="text-xs text-[#8e887e] hover:text-[#141413] transition-colors flex items-center space-x-1"
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
                  )}
                </div>
              </div>
            ))}

            {/* Indicador de Streaming */}
            {isStreaming && (
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
                  <span>Tex AI está respondiendo...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Consultas Frecuentes Iniciales */}
          {messages.length === 1 && (
            <div className="max-w-3xl w-full mx-auto mt-8 mb-4">
              <h3 className="font-serif-display text-lg text-[#141413] mb-3">
                Consultas frecuentes
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sampleSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(item.prompt)}
                    className="text-left p-3.5 rounded-xl bg-[#ece5d8] hover:bg-[#e7dfd1] border border-[#ded5c6] transition-colors group flex items-start justify-between"
                  >
                    <div>
                      <div className="text-xs font-semibold text-[#141413] mb-1">
                        {item.title}
                      </div>
                      <div className="text-xs text-[#6c6860] line-clamp-2 leading-relaxed">
                        {item.prompt}
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-[#8e887e] group-hover:text-[#cc785c] flex-shrink-0 ml-2 mt-0.5 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Floating Input Dock */}
        <div className="fixed bottom-0 right-0 left-0 md:left-auto md:w-[calc(100%-16rem)] z-10 bg-gradient-to-t from-[#f4efe6] via-[#f4efe6] to-transparent pt-4 pb-5 px-4 sm:px-6">
          <div className="max-w-3xl w-full mx-auto">
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
          </div>
        </div>
      </div>
    </div>
  );
}
