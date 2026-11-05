'use client';

import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Eye, MessageSquare, LogIn, Share2 } from 'lucide-react';

interface ActivityEvent {
  t: number;
  type: 'visit' | 'faq' | 'login' | 'chat' | 'preview';
  vid?: string;
  faq?: string;
  bot?: string;
  offline?: number;
  logged?: number;
  country?: string;
  city?: string;
  region?: string;
  device?: string;
  browser?: string;
  referer?: string;
}

interface Visit {
  vid: string;
  start: number;
  end: number;
  place: string;
  device: string;
  referer: string;
  faqs: string[];
  logins: number;
  chats: number;
  logged: boolean;
  offline: boolean;
}

const fmt = (t: number) =>
  new Date(t).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const place = (e: ActivityEvent) => [e.city, e.region, e.country].filter(Boolean).join(', ') || 'Ubicación desconocida';

function groupVisits(events: ActivityEvent[]): { visits: Visit[]; previews: ActivityEvent[] } {
  const visits = new Map<string, Visit>();
  const previews: ActivityEvent[] = [];
  for (const e of [...events].sort((a, b) => a.t - b.t)) {
    if (e.type === 'preview') {
      previews.push(e);
      continue;
    }
    const key = e.vid || `${e.t}`;
    const v =
      visits.get(key) ||
      ({
        vid: key,
        start: e.t,
        end: e.t,
        place: place(e),
        device: [e.device, e.browser].filter(Boolean).join(' · '),
        referer: e.referer || '',
        faqs: [],
        logins: 0,
        chats: 0,
        logged: false,
        offline: false,
      } as Visit);
    v.end = Math.max(v.end, e.t);
    if (e.type === 'faq' && e.faq) v.faqs.push(e.faq);
    if (e.type === 'login') v.logins++;
    if (e.type === 'chat') v.chats++;
    if (e.logged) v.logged = true;
    if (e.offline) v.offline = true;
    if (!v.referer && e.referer) v.referer = e.referer;
    visits.set(key, v);
  }
  return { visits: [...visits.values()].sort((a, b) => b.start - a.start), previews: previews.reverse() };
}

/** Actividad de visitantes (solo con sesión iniciada). Sin cookies ni IPs: ciudad, país y dispositivo. */
export default function ActivityPanel({ onClose }: { onClose: () => void }) {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState('');

  const fetchEvents = async (): Promise<{ events: ActivityEvent[]; error: string }> => {
    try {
      const res = await fetch('/api/_activity');
      if (!res.ok) throw new Error(res.status === 401 ? 'Sesión vencida.' : `HTTP ${res.status}`);
      return { events: (await res.json()).events || [], error: '' };
    } catch (e) {
      return { events: [], error: e instanceof Error ? e.message : 'No se pudo cargar la actividad.' };
    }
  };

  const load = async () => {
    setEvents(null);
    const r = await fetchEvents();
    setEvents(r.events);
    setError(r.error);
  };

  useEffect(() => {
    let alive = true;
    fetchEvents().then((r) => {
      if (!alive) return;
      setEvents(r.events);
      setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, []);

  const { visits, previews } = groupVisits(events || []);
  const guestVisits = visits.filter((v) => !v.logged || v.logins > 0);

  return (
    <div className="fixed inset-0 z-50 bg-[#141413]/30 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[85dvh] flex flex-col bg-[#f4efe6] border border-[#ded5c6] rounded-2xl shadow-[0_8px_32px_rgba(20,20,19,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ded5c6]">
          <div>
            <h2 className="font-serif-display text-lg text-[#141413]">Actividad</h2>
            <p className="text-[11px] text-[#8e887e]">Visitas, consultas frecuentes y vistas previas del link (últimos 120 días).</p>
          </div>
          <div className="flex items-center space-x-1">
            <button onClick={load} title="Actualizar" className="p-1.5 rounded-lg text-[#8e887e] hover:text-[#141413] hover:bg-[#ece5d8]">
              <RefreshCw className={`h-4 w-4 ${events === null ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} title="Cerrar" className="p-1.5 rounded-lg text-[#8e887e] hover:text-[#141413] hover:bg-[#ece5d8]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5 text-xs text-[#32312e]">
          {error && <div className="text-[#c64545]">{error}</div>}

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Visitas', value: guestVisits.length, icon: Eye },
              { label: 'Consultas probadas', value: visits.reduce((n, v) => n + v.faqs.length, 0), icon: MessageSquare },
              { label: 'Vistas previas', value: previews.length, icon: Share2 },
            ].map((k) => (
              <div key={k.label} className="rounded-xl bg-[#ece5d8] border border-[#ded5c6] p-3">
                <div className="flex items-center text-[#8e887e] text-[11px]">
                  <k.icon className="h-3.5 w-3.5 mr-1 text-[#cc785c]" />
                  {k.label}
                </div>
                <div className="font-serif-display text-xl text-[#141413] mt-0.5">{k.value}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="font-semibold text-[#141413] mb-2">Visitas</div>
            {events !== null && visits.length === 0 && <div className="text-[#8e887e]">Todavía no hay visitas registradas.</div>}
            <div className="space-y-1.5">
              {visits.map((v) => (
                <div key={v.vid} className="rounded-xl border border-[#ded5c6] bg-[#ece5d8]/60 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-medium text-[#141413]">{v.place}</span>
                    <span className="text-[#8e887e] font-mono text-[10px]">
                      {fmt(v.start)}
                      {v.end - v.start > 60000 ? ` → ${fmt(v.end).slice(-5)}` : ''}
                    </span>
                  </div>
                  <div className="text-[#8e887e] mt-0.5">
                    {v.device}
                    {v.referer ? ` · llegó desde ${v.referer}` : ''}
                    {v.offline ? ' · server caído (vio la copia)' : ''}
                    {v.logged && !v.logins ? ' · con sesión' : ''}
                  </div>
                  {(v.faqs.length > 0 || v.logins > 0 || v.chats > 0) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {v.faqs.map((f, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded-md bg-[#f4efe6] border border-[#ded5c6] text-[10px]">
                          {f}
                        </span>
                      ))}
                      {v.logins > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-[#cc785c]/15 text-[#a9583e] text-[10px] inline-flex items-center">
                          <LogIn className="h-3 w-3 mr-0.5" /> inició sesión
                        </span>
                      )}
                      {v.chats > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-[#cc785c]/15 text-[#a9583e] text-[10px]">
                          {v.chats} {v.chats === 1 ? 'consulta propia' : 'consultas propias'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {previews.length > 0 && (
            <div>
              <div className="font-semibold text-[#141413] mb-2">Vistas previas del link</div>
              <div className="space-y-1">
                {previews.map((p, i) => (
                  <div key={i} className="flex justify-between text-[#6c6860]">
                    <span>
                      {p.bot} · {place(p)}
                    </span>
                    <span className="font-mono text-[10px] text-[#8e887e]">{fmt(p.t)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
