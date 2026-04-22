'use client';

import { cn } from '@/lib/utils';
import type { GarmentType } from '@/types';
import { GARMENT_LABELS } from '@/types';

const GARMENT_ICONS: Record<GarmentType, string> = {
  terno:  '🤵',
  blazer: '🧥',
  camisa: '👔',
  polo:   '👕',
  calca:  '👖',
};

interface GarmentSelectorProps {
  value: GarmentType;
  onChange: (value: GarmentType) => void;
  className?: string;
}

const GARMENTS: GarmentType[] = ['terno', 'blazer', 'camisa', 'polo', 'calca'];

export function GarmentSelector({ value, onChange, className }: GarmentSelectorProps) {
  return (
    <div className={cn('flex gap-2 flex-wrap', className)}>
      {GARMENTS.map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          className={cn(
            'flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition-all text-xs min-w-[72px]',
            value === g
              ? 'border-primary bg-primary/10 text-primary shadow-sm'
              : 'border-border bg-card text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground',
          )}
          style={{ fontFamily: 'var(--font-syne)' }}
        >
          <span className="text-xl">{GARMENT_ICONS[g]}</span>
          <span className="tracking-wide uppercase text-[10px]">{GARMENT_LABELS[g]}</span>
        </button>
      ))}
    </div>
  );
}
