'use client';

import { cn } from '@/lib/utils';
import type { Fabric } from '@/types';

interface FabricCardProps {
  fabric: Fabric;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function FabricCard({ fabric, selected, onClick, className }: FabricCardProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'group relative rounded-xl overflow-hidden border transition-colors text-left w-full bg-card',
        'active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary',
        selected
          ? 'border-primary ring-1 ring-primary/50'
          : 'border-border hover:border-primary/40',
        className,
      )}
    >
      {/* Amostra cortada na tesoura de picotar */}
      <div className="pinked aspect-square bg-background overflow-hidden">
        <img
          src={`/api/files/${fabric.texture_image}`}
          alt={fabric.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>

      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow">
          <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div className="px-2.5 pt-1.5 pb-2.5">
        <p className="font-display text-[14px] leading-snug text-foreground line-clamp-2">
          {fabric.name}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {fabric.code}{fabric.category ? ` · ${fabric.category}` : ''}
        </p>
      </div>
    </button>
  );
}
