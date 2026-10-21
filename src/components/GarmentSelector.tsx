'use client';

import { cn } from '@/lib/utils';
import type { GarmentType } from '@/types';
import { GARMENT_LABELS } from '@/types';
import { Check } from 'lucide-react';

const GARMENT_ICONS: Record<GarmentType, string> = {
  terno:  '🤵',
  blazer: '🧥',
  camisa: '👔',
  polo:   '👕',
  calca:  '👖',
  sapato: '👞',
};

interface GarmentSelectorProps {
  value: GarmentType;
  onChange: (value: GarmentType) => void;
  /** Peças que já têm um tecido atribuído no look (mostra selo de check). */
  assignedGarments?: GarmentType[];
  className?: string;
}

const GARMENTS: GarmentType[] = ['terno', 'blazer', 'camisa', 'polo', 'calca', 'sapato'];

export function GarmentSelector({ value, onChange, assignedGarments = [], className }: GarmentSelectorProps) {
  return (
    <div className={cn('flex gap-2 flex-wrap', className)}>
      {GARMENTS.map((g) => {
        const assigned = assignedGarments.includes(g);
        const active = value === g;
        return (
          <button
            key={g}
            onClick={() => onChange(g)}
            className={cn(
              'relative flex flex-col items-center gap-1 px-4 py-3 rounded-2xl border transition-all text-xs min-w-[72px]',
              active
                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                : assigned
                ? 'border-primary/40 bg-primary/5 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground',
            )}
          >
            {assigned && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <Check className="w-2.5 h-2.5" strokeWidth={3} />
              </span>
            )}
            <span className="text-xl">{GARMENT_ICONS[g]}</span>
            <span className="tracking-wide uppercase text-[10px]">{GARMENT_LABELS[g]}</span>
          </button>
        );
      })}
    </div>
  );
}
