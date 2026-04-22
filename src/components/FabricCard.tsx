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
      className={cn(
        'group relative rounded-xl overflow-hidden border transition-all text-left w-full',
        'hover:scale-[1.02] active:scale-[0.98]',
        selected
          ? 'border-primary ring-1 ring-primary/40 shadow-[0_0_16px_rgba(197,165,90,0.15)]'
          : 'border-border hover:border-primary/40 bg-card',
        className,
      )}
    >
      {/* Texture image */}
      <div className="aspect-square bg-background overflow-hidden">
        <img
          src={`/api/files/${fabric.texture_image}`}
          alt={fabric.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>

      {/* Selected badge */}
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow">
          <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Info */}
      <div className="p-2.5 bg-card border-t border-border">
        <p className="text-xs font-semibold text-foreground truncate"
          style={{ fontFamily: 'var(--font-syne)' }}>
          {fabric.name}
        </p>
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{fabric.code}</p>
        {fabric.category && (
          <p className="text-[10px] text-primary/70 mt-1 truncate">{fabric.category}</p>
        )}
      </div>
    </button>
  );
}
