'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AtelierBrand } from '@/components/AtelierBrand';
import type { Atelier, Fabric } from '@/types';
import { ArrowLeft, MapPin, Plus, Sparkles, Loader2 } from 'lucide-react';

interface Props { params: Promise<{ slug: string }>; }
type AtelierFull = Atelier & { fabrics: Fabric[] };

export default function AtelierStorefront({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();

  const [atelier, setAtelier] = useState<AtelierFull | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound'>('loading');
  const [showDialog, setShowDialog] = useState(false);
  const [clientName, setClientName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch(`/api/ateliers/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((a: AtelierFull) => { setAtelier(a); setStatus('ready'); })
      .catch(() => setStatus('notfound'));
  }, [slug]);

  async function startSession() {
    if (!atelier) return;
    setCreating(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: clientName.trim() || undefined, atelier_id: atelier.id }),
      });
      const session = await res.json();
      router.push(`/session/${session.id}`);
    } catch {
      setCreating(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === 'notfound' || !atelier) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">Ateliê não encontrado.</p>
        <Button onClick={() => router.push('/')} className="rounded-full">Voltar ao marketplace</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3
                         bg-white/55 backdrop-blur-xl backdrop-saturate-150 border-b border-white/60
                         shadow-[0_8px_24px_-18px_rgba(28,32,54,0.3)]">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-2 -ml-1 rounded-full hover:bg-black/5"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Ateliês</span>
        </button>
        <div className="flex-1 flex justify-center min-w-0">
          <AtelierBrand atelier={atelier} size="sm" />
        </div>
        <span className="w-9" />
      </header>

      <main className="relative z-10 flex-1 w-full max-w-3xl mx-auto px-5 sm:px-6 py-6 sm:py-8 space-y-7">

        {/* ── Hero do ateliê ── */}
        <section className="animate-rise glass glass-sheen rounded-3xl overflow-hidden" style={{ animationDelay: '40ms' }}>
          <div className="relative h-40 sm:h-52 overflow-hidden">
            {atelier.cover_image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={atelier.cover_image} alt="" className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
          </div>
          <div className="px-5 pb-5">
            <div className="relative z-10 -mt-12">
              <div className="w-[80px] h-[80px] rounded-2xl overflow-hidden ring-4 ring-white/85 shadow-lg bg-white">
                {atelier.avatar_image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={atelier.avatar_image} alt={atelier.name} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="mt-3 min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-foreground leading-tight">{atelier.name}</h1>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{[atelier.neighborhood, atelier.city].filter(Boolean).join(' · ')}</span>
                </div>
              </div>
            </div>

            {atelier.tagline && (
              <p className="text-sm font-medium text-foreground/90 mt-4">{atelier.tagline}</p>
            )}
            {atelier.bio && (
              <p className="text-[13px] text-muted-foreground leading-relaxed mt-2">{atelier.bio}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-4">
              {atelier.specialty && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-black/[0.04] border border-white/60 text-foreground/80">
                  {atelier.specialty}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium">
                <Sparkles className="w-3 h-3" />
                {atelier.fabrics.length} tecidos
              </span>
            </div>

            <Button
              onClick={() => setShowDialog(true)}
              className="w-full h-12 mt-5 rounded-full bg-primary text-primary-foreground hover:bg-primary
                         shadow-glow hover:scale-[1.01] transition-transform gap-2"
            >
              <Plus className="w-[18px] h-[18px]" />
              Iniciar Atendimento
            </Button>
          </div>
        </section>

        {/* ── Prévia do catálogo ── */}
        <section className="animate-rise" style={{ animationDelay: '160ms' }}>
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-[11px] tracking-[0.12em] font-medium uppercase text-muted-foreground">
              Catálogo de tecidos
            </p>
            <span className="text-[11px] text-muted-foreground">{atelier.fabrics.length} peças</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {atelier.fabrics.map((f) => (
              <div key={f.id} className="glass rounded-2xl overflow-hidden">
                <div className="aspect-square overflow-hidden bg-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/files/${f.texture_image}`} alt={f.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="px-2 py-1.5">
                  <p className="text-[11px] font-medium text-foreground truncate leading-tight">{f.name}</p>
                  <p className="text-[9px] text-muted-foreground font-mono mt-0.5">{f.code}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── Dialog: iniciar atendimento ── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm rounded-3xl glass-strong border-0 shadow-float">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">Iniciar Atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-1">
            <p className="text-[13px] text-muted-foreground -mt-2">
              Atendimento em <span className="text-foreground font-medium">{atelier.name}</span>.
            </p>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-[11px] uppercase tracking-[0.1em] font-medium">
                Nome do cliente (opcional)
              </Label>
              <Input
                placeholder="Ex: João Silva"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startSession()}
                autoFocus
                className="h-11 rounded-xl bg-white/70 border-white/70 focus-visible:border-primary/60 focus-visible:ring-primary/20"
              />
            </div>
            <Button
              className="w-full h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary
                         shadow-glow hover:scale-[1.02] transition-transform"
              onClick={startSession}
              disabled={creating}
            >
              {creating ? 'Criando...' : 'Começar prova →'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
