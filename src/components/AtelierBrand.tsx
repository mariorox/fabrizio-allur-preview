'use client';

import type { Atelier } from '@/types';

/** Deriva um monograma de 2 letras a partir do nome do ateliê.
 *  "Pedro Corulla" → "PC" · "Sartoria Lucca" → "SL" · "Merino" → "ME" */
export function atelierMonogram(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => !/^(de|da|do|e|per|&)$/i.test(w)); // ignora conectivos
  if (words.length === 0) return '··';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { badge: string; mono: string; name: string; eyebrow: string; gap: string }> = {
  sm: { badge: 'w-7 h-7 rounded-lg',  mono: 'text-[11px]', name: 'text-sm',          eyebrow: 'text-[8px]',  gap: 'gap-2' },
  md: { badge: 'w-9 h-9 rounded-xl',  mono: 'text-sm',     name: 'text-base sm:text-lg', eyebrow: 'text-[9px]',  gap: 'gap-2.5' },
  lg: { badge: 'w-12 h-12 rounded-2xl', mono: 'text-lg',   name: 'text-xl',          eyebrow: 'text-[10px]', gap: 'gap-3' },
};

interface Props {
  atelier?: Pick<Atelier, 'name' | 'avatar_image'> | null;
  size?: Size;
  /** Mostra a etiqueta "PROVADOR DIGITAL" como assinatura do produto. */
  showProduct?: boolean;
  /** Usa a foto/logo do ateliê dentro do badge (em vez do monograma). */
  useImage?: boolean;
  className?: string;
}

/**
 * Marca personalizada do ambiente: monograma + nome do ateliê.
 * Sem ateliê (marketplace/admin), cai no wordmark "Provador Digital".
 */
export function AtelierBrand({ atelier, size = 'md', showProduct = true, useImage = false, className = '' }: Props) {
  const s = SIZES[size];

  // Fallback: produto sem ateliê.
  if (!atelier) {
    return (
      <span className={`font-display ${s.name} font-semibold tracking-[0.16em] uppercase text-foreground whitespace-nowrap ${className}`}>
        Provador <span className="text-primary">Digital</span>
      </span>
    );
  }

  return (
    <div className={`flex items-center ${s.gap} min-w-0 ${className}`}>
      {/* Monograma — "logo" do ateliê */}
      <div
        className={`${s.badge} shrink-0 grid place-items-center overflow-hidden
                    bg-gradient-to-br from-primary to-primary/75 text-primary-foreground
                    ring-1 ring-white/40 shadow-[0_4px_14px_-6px_rgba(28,32,54,0.55)]`}
      >
        {useImage && atelier.avatar_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={atelier.avatar_image} alt={atelier.name} className="w-full h-full object-cover" />
        ) : (
          <span className={`font-display ${s.mono} font-bold tracking-tight leading-none`}>
            {atelierMonogram(atelier.name)}
          </span>
        )}
      </div>

      {/* Wordmark */}
      <div className="min-w-0 leading-tight">
        {showProduct && (
          <p className={`${s.eyebrow} tracking-[0.22em] uppercase text-muted-foreground/80 leading-none mb-0.5`}>
            Provador Digital
          </p>
        )}
        <p className={`font-display ${s.name} font-semibold tracking-tight text-foreground truncate`}>
          {atelier.name}
        </p>
      </div>
    </div>
  );
}
