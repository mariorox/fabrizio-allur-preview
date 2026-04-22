'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { SessionHeader } from '@/components/SessionHeader';
import { GarmentSelector } from '@/components/GarmentSelector';
import { FabricCatalog } from '@/components/FabricCatalog';
import { GenerationCard } from '@/components/GenerationCard';
import { Button } from '@/components/ui/button';
import type { Session, Fabric, Generation, GarmentType } from '@/types';
import { ArrowLeft, Camera, BarChart2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  params: Promise<{ id: string }>;
}

export default function SessionPage({ params }: Props) {
  const { id: sessionId } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [currentFabric, setCurrentFabric] = useState<Fabric | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadSession();
    loadGenerations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    const pending = generations.filter((g) => g.status === 'pending' || g.status === 'processing');
    if (pending.length === 0) return;
    const interval = setInterval(() => loadGenerations(), 2000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generations]);

  async function loadSession() {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) { router.push('/'); return; }
    const s: Session = await res.json();
    setSession(s);
    if (s.current_fabric_id) {
      const fr = await fetch(`/api/fabrics/${s.current_fabric_id}`);
      if (fr.ok) setCurrentFabric(await fr.json());
    }
  }

  async function loadGenerations() {
    const res = await fetch(`/api/sessions/${sessionId}/generations`);
    if (res.ok) setGenerations(await res.json());
  }

  async function handleFabricSelect(fabric: Fabric) {
    if (!session) return;
    setCurrentFabric(fabric);
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_fabric_id: fabric.id }),
    });
  }

  async function handleGenerate() {
    if (!session || !currentFabric) return;
    if (!session.current_photo) {
      router.push(`/session/${sessionId}/capture`);
      return;
    }
    await generatePreview(currentFabric.id, session.current_garment, session.current_photo);
  }

  async function handleGarmentChange(garment: GarmentType) {
    if (!session) return;
    setSession({ ...session, current_garment: garment });
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_garment: garment }),
    });
  }

  async function generatePreview(fabricId: string, garmentType: GarmentType, clientPhoto: string) {
    setGenerating(true);
    try {
      const res = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          fabric_id: fabricId,
          garment_type: garmentType,
          client_photo: clientPhoto,
        }),
      });
      const gen = await res.json();
      setGenerations((prev) => [gen, ...prev]);
      router.push(`/session/${sessionId}/preview/${gen.id}`);
    } catch {
      toast.error('Falha ao gerar prévia. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* ── Top bar ── */}
      <div className="bg-card border-b border-border">
        {/* Logo bar — grid 3 colunas para mobile safe */}
        <div className="grid grid-cols-3 items-center px-5 py-6">
          {/* left — back button */}
          <div className="flex justify-start">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Início</span>
            </button>
          </div>
          {/* center — logo */}
          <div className="flex justify-center">
            <img
              src="https://img1.wsimg.com/isteam/ip/42736041-0c4b-482d-bb3e-03f79e8f52ca/fabrizio_logo_horiz_branco.png/:/rs=h:99,cg:true,m/qt=q:95"
              alt="Fabrizio Allur"
              className="h-8 w-auto max-w-[150px] object-contain"
            />
          </div>
          {/* right — spacer */}
          <span />
        </div>
        <SessionHeader
          session={session}
          currentFabric={currentFabric}
          photoCount={generations.length}
        />
      </div>

      <div className="flex-1 flex flex-col lg:flex-row">

        {/* ── Main content ── */}
        <div className="flex-1 p-4 md:p-6 space-y-6 min-w-0">

          {/* Garment selector */}
          <div>
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-3"
              style={{ fontFamily: 'var(--font-syne)' }}>
              Tipo de peça
            </p>
            <GarmentSelector value={session.current_garment} onChange={handleGarmentChange} />
          </div>

          <div className="h-px bg-border" />

          {/* No photo prompt */}
          {!session.current_photo && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground"
                  style={{ fontFamily: 'var(--font-syne)' }}>
                  Nenhuma foto capturada ainda
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Selecione um tecido para ir à câmera, ou capture agora.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/60 rounded-full text-xs"
                onClick={() => router.push(`/session/${sessionId}/capture`)}
              >
                <Camera className="w-3.5 h-3.5 mr-1.5" />
                Capturar foto
              </Button>
            </div>
          )}

          {/* Fabric catalog */}
          <div>
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-3"
              style={{ fontFamily: 'var(--font-syne)' }}>
              Catálogo de tecidos
              <span className="ml-2 text-primary/80 normal-case tracking-normal">
                · selecione o tecido desejado
              </span>
            </p>
            <FabricCatalog selectedFabricId={currentFabric?.id ?? session.current_fabric_id} onSelect={handleFabricSelect} />
          </div>
        </div>

        {/* ── History sidebar ── */}
        {generations.length > 0 && (
          <aside className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground"
                style={{ fontFamily: 'var(--font-syne)' }}>
                Histórico
              </p>
              {generations.filter((g) => g.status === 'success').length >= 2 && (
                <button
                  onClick={() => router.push(`/session/${sessionId}/compare`)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <BarChart2 className="w-3 h-3" />
                  Comparar
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {generations.map((gen) => (
                <GenerationCard
                  key={gen.id}
                  generation={gen}
                  onClick={() => router.push(`/session/${sessionId}/preview/${gen.id}`)}
                  onDelete={async (g) => {
                    if (!confirm('Excluir esta prévia?')) return;
                    await fetch(`/api/generations/${g.id}`, { method: 'DELETE' });
                    setGenerations((prev) => prev.filter((x) => x.id !== g.id));
                    toast.info('Prévia excluída');
                  }}
                />
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* ── Botão fixo: Gerar Prévia ── */}
      {currentFabric && !generating && (
        <div className="sticky bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md px-4 py-3">
          <button
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl
                       bg-primary text-primary-foreground font-semibold text-sm
                       hover:bg-primary/90 active:scale-[0.98] transition-all"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            <Sparkles className="w-4 h-4" />
            {session?.current_photo ? 'Gerar prévia' : 'Capturar foto e gerar'}
            <span className="text-primary-foreground/70 text-xs font-normal ml-1">
              · {currentFabric.name}
            </span>
          </button>
        </div>
      )}

      {/* ── Generating overlay ── */}
      {generating && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-xs mx-4 shadow-2xl">
            <div className="w-10 h-10 border-2 border-border border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-semibold text-foreground" style={{ fontFamily: 'var(--font-syne)' }}>
              Iniciando geração...
            </p>
            <p className="text-xs text-muted-foreground mt-1">Você será redirecionado em instantes</p>
          </div>
        </div>
      )}
    </div>
  );
}
