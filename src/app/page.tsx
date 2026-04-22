'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Session } from '@/types';
import { Plus, Clock, ChevronRight, Settings, Users, BarChart2 } from 'lucide-react';

const LOGO_URL =
  'https://img1.wsimg.com/isteam/ip/42736041-0c4b-482d-bb3e-03f79e8f52ca/fabrizio_logo_horiz_branco.png/:/rs=h:99,cg:true,m/qt=q:95';

export default function HomePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/sessions').then((r) => r.json()).then(setSessions).catch(() => {});
  }, []);

  async function createSession() {
    setLoading(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: clientName.trim() || undefined }),
      });
      const session = await res.json();
      router.push(`/session/${session.id}`);
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">

      {/* ── Background image ─────────────────────────────────────── */}
      <Image
        src="/img%20bg%20home.webp"
        alt=""
        fill
        className="object-cover object-[70%_center] sm:object-center"
        priority
        unoptimized
      />
      {/* Overlay 80% */}
      <div className="absolute inset-0 bg-[#0A0A0A]/85 z-[1]" />

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="relative z-10 bg-card/60 backdrop-blur-md border-b border-border/50 px-5 py-7 grid grid-cols-3 items-center">
        {/* left — espaço reservado para simetria */}
        <span />
        {/* center — logo centralizado */}
        <div className="flex justify-center">
          <img src={LOGO_URL} alt="Fabrizio Allur" className="h-9 w-auto max-w-[170px] object-contain" />
        </div>
        {/* right — botão Catálogo */}
        <div className="flex justify-end">
          <button
            onClick={() => router.push('/admin/fabrics')}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-2 -mr-2"
          >
            <Settings className="w-5 h-5" />
            <span className="hidden sm:inline">Catálogo</span>
          </button>
          <button
            onClick={() => router.push('/admin/stats')}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors p-2"
          >
            <BarChart2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16 gap-10">

        <div className="text-center max-w-sm">
          {/* Decorative rule */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className="h-px w-12 bg-border" />
            <span className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground"
              style={{ fontFamily: 'var(--font-syne)' }}>
              Virtual Preview
            </span>
            <span className="h-px w-12 bg-border" />
          </div>

          <h1
            className="text-4xl font-bold tracking-tight text-foreground mb-4 leading-tight"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            Novo<br />
            <span className="text-primary">Atendimento</span>
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Mostre ao cliente como ficará vestindo a peça<br />
            com o tecido escolhido — antes de produzir.
          </p>
        </div>

        {/* ── CTA button ── */}
        <Button
          size="lg"
          onClick={() => setShowDialog(true)}
          className="gap-2 px-10 py-6 text-sm font-semibold rounded-full shadow-lg
                     bg-primary text-primary-foreground hover:bg-primary/90
                     transition-all duration-200 hover:scale-[1.02]"
          style={{ fontFamily: 'var(--font-syne)' }}
        >
          <Plus className="w-4 h-4" />
          Iniciar Atendimento
        </Button>

        {/* ── Recent sessions ── */}
        {sessions.length > 0 && (
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs tracking-wider uppercase text-muted-foreground"
                  style={{ fontFamily: 'var(--font-syne)' }}>
                  Recentes
                </p>
              </div>
              <button
                onClick={() => router.push('/clients')}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                <Users className="w-3 h-3" />
                Ver todos
              </button>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {sessions.slice(0, 6).map((session) => (
                <button
                  key={session.id}
                  onClick={() => router.push(`/session/${session.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3.5
                             hover:bg-accent transition-colors text-left group"
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20
                                  flex items-center justify-center text-xs font-semibold text-primary shrink-0"
                    style={{ fontFamily: 'var(--font-syne)' }}>
                    {session.client_name ? session.client_name[0].toUpperCase() : '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {session.client_name || 'Cliente sem nome'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(session.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ornament ── */}
      <footer className="relative z-10 px-6 pb-6 flex justify-center">
        <p className="text-[10px] tracking-widest uppercase text-muted-foreground/70"
          style={{ fontFamily: 'var(--font-syne)' }}>
          Alfaiataria sob medida
        </p>
      </footer>

      {/* ── Create session dialog ── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-syne)' }}>
              Novo Atendimento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                Nome do cliente (opcional)
              </Label>
              <Input
                placeholder="Ex: João Silva"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createSession()}
                autoFocus
                className="bg-background border-border focus:border-primary/50"
              />
            </div>
            <Button
              className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={createSession}
              disabled={loading}
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              {loading ? 'Criando...' : 'Iniciar →'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
