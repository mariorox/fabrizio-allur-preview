'use client';

import Link from 'next/link';
import type { Session, Fabric } from '@/types';
import { GARMENT_LABELS } from '@/types';
import { Clock, Camera } from 'lucide-react';

interface SessionHeaderProps {
  session: Session;
  currentFabric?: Fabric | null;
  photoCount?: number;
}

export function SessionHeader({ session, currentFabric, photoCount }: SessionHeaderProps) {
  const timeStr = new Date(session.created_at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const garmentEmoji =
    session.current_garment === 'terno' ? '🤵' :
    session.current_garment === 'blazer' ? '🧥' :
    session.current_garment === 'camisa' ? '👔' :
    session.current_garment === 'polo' ? '👕' : '👖';

  return (
    <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-4 flex-wrap">

      {/* Client info */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20
                        flex items-center justify-center shrink-0 text-xs font-bold text-primary"
          style={{ fontFamily: 'var(--font-syne)' }}>
          {session.client_name ? session.client_name[0].toUpperCase() : '?'}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate"
            style={{ fontFamily: 'var(--font-syne)' }}>
            {session.client_name || 'Cliente sem nome'}
          </p>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="w-2.5 h-2.5" />
            <span>{timeStr}</span>
          </div>
        </div>
      </div>

      {/* Right: garment + fabric + photo + count */}
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">

        {/* Garment badge — hide label on very small screens */}
        <div className="flex items-center gap-1 border border-border rounded-md px-2 py-1 text-xs text-muted-foreground">
          <span className="text-sm leading-none">{garmentEmoji}</span>
          <span className="hidden sm:inline">{GARMENT_LABELS[session.current_garment]}</span>
        </div>

        {/* Current fabric — thumbnail only on mobile, name on sm+ */}
        {currentFabric && (
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2 py-1">
            <img
              src={`/api/files/${currentFabric.texture_image}`}
              alt={currentFabric.name}
              className="w-5 h-5 rounded object-cover border border-border shrink-0"
            />
            <div className="hidden sm:block text-xs min-w-0">
              <p className="text-foreground leading-none max-w-[80px] truncate">{currentFabric.name}</p>
              <p className="text-muted-foreground font-mono mt-0.5">{currentFabric.code}</p>
            </div>
          </div>
        )}

        {/* Preview count — hidden on mobile */}
        {typeof photoCount === 'number' && photoCount > 0 && (
          <div className="hidden sm:block text-[10px] tracking-wider text-muted-foreground border border-border rounded-md px-2 py-1"
            style={{ fontFamily: 'var(--font-syne)' }}>
            {photoCount}
          </div>
        )}

        {/* Client photo — always visible, clickable */}
        <Link
          href={`/session/${session.id}/capture`}
          className="relative group shrink-0"
          title="Trocar foto"
        >
          {session.current_photo ? (
            <img
              src={`/api/files/${session.current_photo}`}
              alt="Foto do cliente"
              className="w-9 h-9 rounded-full object-cover border-2 border-border
                         group-hover:border-primary/60 transition-colors"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-background border-2 border-dashed border-border
                            group-hover:border-primary/50 flex items-center justify-center transition-colors">
              <Camera className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          )}
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center
                          opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-3.5 h-3.5 text-white" />
          </div>
        </Link>
      </div>
    </div>
  );
}
