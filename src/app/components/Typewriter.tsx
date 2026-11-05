'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Revela el texto de a poco (efecto de tipeo) a ritmo constante: una respuesta larga
 * tarda como mucho ~1,5 s y una corta se escribe a ~400 caracteres por segundo.
 * Si el texto sigue llegando por streaming, el efecto lo acompaña sin adelantarse.
 */
export default function Typewriter({
  text,
  streaming,
  onProgress,
  onDone,
  children,
}: {
  text: string;
  streaming: boolean; // todavía pueden llegar más caracteres
  onProgress?: () => void;
  onDone?: () => void;
  children: (visible: string) => React.ReactNode;
}) {
  const [shown, setShown] = useState(0);
  const textRef = useRef(text);
  const streamingRef = useRef(streaming);
  const doneRef = useRef(false);
  // Las refs se actualizan después del render (el temporizador las lee en cada tick)
  useEffect(() => {
    textRef.current = text;
    streamingRef.current = streaming;
  });

  useEffect(() => {
    // Temporizador por tiempo transcurrido (no requestAnimationFrame): sigue avanzando aunque
    // la pestaña esté en segundo plano o el navegador embebido no pinte cuadros.
    let timer: ReturnType<typeof setTimeout>;
    let visible = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(1000, now - last) / 1000;
      last = now;
      const full = textRef.current.length;
      if (visible < full) {
        // ~400 caracteres/s como mínimo y nunca más de ~1,5 s para el texto completo
        const rate = Math.max(400, full / 1.5);
        visible = Math.min(full, visible + Math.max(1, rate * dt));
        setShown(Math.floor(visible));
        onProgress?.();
      } else if (!streamingRef.current && !doneRef.current) {
        doneRef.current = true;
        onDone?.();
        return;
      }
      timer = setTimeout(tick, 16);
    };
    timer = setTimeout(tick, 16);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No cortar en medio de una cita [n] ni de una marca de negrita
  let cut = text.slice(0, shown);
  const openCite = cut.lastIndexOf('[');
  if (openCite > cut.lastIndexOf(']') && cut.length < text.length) cut = cut.slice(0, openCite);
  return <>{children(cut)}</>;
}
