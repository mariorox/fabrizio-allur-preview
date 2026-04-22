'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc:  string;
  className?: string;
}

export function BeforeAfterSlider({ beforeSrc, afterSrc, className }: BeforeAfterSliderProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const [fullscreen, setFullscreen] = useState(false);
  const dragging = useRef(false);

  // Animação de dica na montagem
  useEffect(() => {
    const t = setTimeout(() => {
      const steps = [50, 32, 68, 50];
      let i = 0;
      const iv = setInterval(() => {
        setPos(steps[i]);
        i++;
        if (i >= steps.length) clearInterval(iv);
      }, 220);
    }, 600);
    return () => clearTimeout(t);
  }, []);

  // Fullscreen API
  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Posição do slider
  const getPos = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct  = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(95, Math.max(5, pct)));
  }, []);

  // Mouse
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    getPos(e.clientX);
  }, [getPos]);

  useEffect(() => {
    const move = (e: MouseEvent) => { if (dragging.current) getPos(e.clientX); };
    const up   = () => { dragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup',   up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [getPos]);

  // Touch
  const onTouchStart = useCallback((e: React.TouchEvent) => { getPos(e.touches[0].clientX); }, [getPos]);
  const onTouchMove  = useCallback((e: React.TouchEvent) => { getPos(e.touches[0].clientX); }, [getPos]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden rounded-2xl select-none cursor-ew-resize touch-none shadow-2xl border border-zinc-200',
        fullscreen && 'rounded-none border-0 w-screen h-screen',
        className,
      )}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
    >
      {/* Depois (gerado) — define as dimensões do container no seu AR natural */}
      <img
        src={afterSrc}
        alt="Depois"
        draggable={false}
        className={cn('block w-full h-auto', fullscreen && 'h-screen w-auto mx-auto')}
      />

      {/* Antes (original) — sobreposto, clipado à direita do divisor, com contain para não esticar */}
      <div
        className="absolute inset-0 overflow-hidden bg-black"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      >
        <img
          src={beforeSrc}
          alt="Antes"
          draggable={false}
          className="block w-full h-full object-contain"
        />
      </div>

      {/* Linha divisória */}
      <div
        className="absolute top-0 bottom-0 w-[2px] bg-white/90 shadow-[0_0_8px_rgba(0,0,0,0.4)] pointer-events-none"
        style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
      />

      {/* Handle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 rounded-full bg-white shadow-[0_2px_16px_rgba(0,0,0,0.35)] flex items-center justify-center pointer-events-none z-10"
        style={{ left: `${pos}%` }}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-zinc-700" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="8 18 2 12 8 6" />
          <polyline points="16 6 22 12 16 18" />
        </svg>
      </div>

      {/* Labels */}
      <span className="absolute bottom-3 left-3 bg-black/55 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full pointer-events-none z-10">
        Depois
      </span>
      <span className="absolute bottom-3 right-3 bg-black/55 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full pointer-events-none z-10">
        Antes
      </span>

      {/* Botão fullscreen */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 flex items-center justify-center text-white transition-colors"
        title={fullscreen ? 'Sair do fullscreen' : 'Fullscreen'}
      >
        {fullscreen
          ? <Minimize2 className="w-4 h-4" />
          : <Maximize2 className="w-4 h-4" />
        }
      </button>
    </div>
  );
}
