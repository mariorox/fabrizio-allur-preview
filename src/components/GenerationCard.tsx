'use client';

import { cn } from '@/lib/utils';
import type { Generation } from '@/types';
import { GARMENT_LABELS } from '@/types';
import { Loader2, XCircle, Trash2 } from 'lucide-react';

interface GenerationCardProps {
  generation: Generation;
  selected?: boolean;
  selectable?: boolean;
  onSelect?: (gen: Generation) => void;
  onClick?: () => void;
  onDelete?: (gen: Generation) => void;
}

export function GenerationCard({ generation, selected, selectable, onSelect, onClick, onDelete }: GenerationCardProps) {
  const isReady = generation.status === 'success';
  const isFailed = generation.status === 'failed';
  const isPending = !isReady && !isFailed;

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden border transition-all cursor-pointer group',
        'hover:scale-[1.02] active:scale-[0.99]',
        selected
          ? 'border-primary ring-1 ring-primary/40 shadow-[0_0_12px_rgba(197,165,90,0.15)]'
          : 'border-border hover:border-primary/40',
      )}
      onClick={() => {
        if (selectable) onSelect?.(generation);
        else onClick?.();
      }}
    >
      {/* Thumbnail */}
      <div className="aspect-[3/4] bg-background relative overflow-hidden">
        {isReady && generation.result_image ? (
          <img
            src={`/api/files/${generation.result_image}`}
            alt="Resultado"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-card">
            {isFailed
              ? <XCircle className="w-7 h-7 text-destructive" />
              : <Loader2 className="w-7 h-7 text-primary animate-spin" />
            }
          </div>
        )}

        {/* Checkbox for selectable mode */}
        {selectable && (
          <div className={cn(
            'absolute top-2 left-2 w-5 h-5 rounded border-2 transition-all flex items-center justify-center',
            selected ? 'bg-primary border-primary' : 'bg-black/40 border-white/50',
          )}>
            {selected && (
              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}

        {/* Status pill */}
        {isPending && (
          <div className="absolute bottom-2 left-2 right-2">
            <div className="bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 text-primary animate-spin" />
              <span className="text-[9px] text-white tracking-wider uppercase"
                style={{ fontFamily: 'var(--font-syne)' }}>
                gerando
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2 bg-card border-t border-border flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-foreground truncate"
            style={{ fontFamily: 'var(--font-syne)' }}>
            {generation.fabric_name ?? '—'}
          </p>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            {GARMENT_LABELS[generation.garment_type]}
            {' · '}
            {new Date(generation.created_at).toLocaleTimeString('pt-BR', {
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
          {isFailed && (
            <p className="text-[9px] text-destructive mt-0.5">Erro na geração</p>
          )}
        </div>
        {onDelete && !isPending && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(generation); }}
            className="shrink-0 p-1 text-muted-foreground hover:text-red-400 transition-colors rounded"
            title="Excluir"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
