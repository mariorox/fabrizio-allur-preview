'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { SessionHeader } from '@/components/SessionHeader';
import { GarmentSelector } from '@/components/GarmentSelector';
import { FabricCatalog } from '@/components/FabricCatalog';
import { GenerationCard } from '@/components/GenerationCard';
import { AtelierBrand } from '@/components/AtelierBrand';
import { Button } from '@/components/ui/button';
import type { Session, Atelier, Fabric, Generation, GarmentType, OutfitItem } from '@/types';
import { GARMENT_LABELS } from '@/types';
import { ArrowLeft, Camera, BarChart2, Sparkles, X, Layers } from 'lucide-react';
import { toast } from 'sonner';

const GARMENT_ICONS: Record<GarmentType, string> = {
  terno: '🤵', blazer: '🧥', camisa: '👔', polo: '👕', calca: '👖', sapato: '👞',
};

/** Reconstrói um Fabric mínimo a partir do snapshot de um item do look. */
function fabricFromItem(it: OutfitItem): Fabric {
  return {
    id: it.fabric_id,
    name: it.fabric_name ?? '',
    code: it.fabric_code ?? '',
    category: null,
    collection: null,
    texture_image: it.fabric_texture ?? '',
    kind: it.garment_type === 'sapato' ? 'shoe' : 'fabric',
    is_active: 1,
    usage_count: 0,
    atelier_id: null,
    created_at: '',
  };
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function SessionPage({ params }: Props) {
  const { id: sessionId } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [atelier, setAtelier] = useState<Atelier | null>(null);
  const [currentFabric, setCurrentFabric] = useState<Fabric | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [generating, setGenerating] = useState(false);

  // ── Montador de look (multi-peça + acumulativo) ──
  const [look, setLook] = useState<{ garment_type: GarmentType; fabric: Fabric }[]>([]);
  const [activeGarment, setActiveGarment] = useState<GarmentType>('camisa');
  // Prévia da qual o look está partindo (acumulativo). A renderização é
  // SEMPRE feita a partir da foto original — isto é só a "memória" do look.
  const [baseGenId, setBaseGenId] = useState<string | null>(null);
  const [preloadedBase, setPreloadedBase] = useState<string | null>(null);

  const baseGen = baseGenId ? generations.find((g) => g.id === baseGenId) : null;

  // Pré-seleciona base vinda da tela de prévia (?base=<genId>)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('base');
    if (p) setBaseGenId(p);
  }, []);

  // Ao continuar uma prévia, pré-carrega as peças daquele look no montador
  useEffect(() => {
    if (!baseGenId || preloadedBase === baseGenId) return;
    const gen = generations.find((g) => g.id === baseGenId);
    if (!gen) return; // aguarda o histórico carregar
    setLook((gen.items ?? []).map((it) => ({ garment_type: it.garment_type, fabric: fabricFromItem(it) })));
    setPreloadedBase(baseGenId);
  }, [baseGenId, generations, preloadedBase]);

  function clearLook() {
    setLook([]);
    setBaseGenId(null);
    setPreloadedBase(null);
  }

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
    if (s.atelier_id) {
      const ar = await fetch(`/api/ateliers?id=${s.atelier_id}`);
      if (ar.ok) setAtelier(await ar.json());
    }
    if (s.current_fabric_id) {
      const fr = await fetch(`/api/fabrics/${s.current_fabric_id}`);
      if (fr.ok) setCurrentFabric(await fr.json());
    }
  }

  async function loadGenerations() {
    const res = await fetch(`/api/sessions/${sessionId}/generations`);
    if (res.ok) setGenerations(await res.json());
  }

  // Atribui o tecido/sapato escolhido à peça ativa do look.
  // Terno cobre torso+pernas (exclui outras roupas), mas o sapato (pés) coexiste.
  function handleFabricSelect(fabric: Fabric) {
    setCurrentFabric(fabric);
    setLook((prev) => {
      let next = prev.filter((it) => it.garment_type !== activeGarment);
      if (activeGarment === 'terno') {
        next = next.filter((it) => it.garment_type === 'sapato'); // mantém só o sapato
      } else if (activeGarment !== 'sapato') {
        next = next.filter((it) => it.garment_type !== 'terno');  // roupas conflitam com terno
      }
      return [...next, { garment_type: activeGarment, fabric }];
    });
  }

  function removeLookItem(garment: GarmentType) {
    setLook((prev) => prev.filter((it) => it.garment_type !== garment));
  }

  function handleGarmentChange(garment: GarmentType) {
    setActiveGarment(garment);
  }

  async function handleGenerate() {
    if (!session || look.length === 0) return;
    if (!session.current_photo) {
      router.push(`/session/${sessionId}/capture`);
      return;
    }
    // Renderiza SEMPRE a partir da foto original (pristina) — nunca de uma
    // imagem já gerada. base_generation_id fica só como linhagem do look.
    await generateLook(
      look.map((it) => ({ garment_type: it.garment_type, fabric_id: it.fabric.id })),
      session.current_photo,
      baseGenId,
    );
  }

  async function generateLook(
    items: { garment_type: GarmentType; fabric_id: string }[],
    baseImage: string,
    baseGenerationId: string | null,
  ) {
    setGenerating(true);
    try {
      const res = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          items,
          base_image: baseImage,
          base_generation_id: baseGenerationId,
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

  const activeFabricId = look.find((it) => it.garment_type === activeGarment)?.fabric.id ?? null;

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* ── Top bar — frosted glass ── */}
      <div className="sticky top-0 z-30 bg-white/55 backdrop-blur-xl backdrop-saturate-150
                      border-b border-white/60 shadow-[0_8px_24px_-18px_rgba(28,32,54,0.3)]">
        {/* Logo bar — grid 3 colunas para mobile safe */}
        <div className="grid grid-cols-3 items-center px-5 py-4">
          {/* left — back button */}
          <div className="flex justify-start">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-full hover:bg-black/5"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Início</span>
            </button>
          </div>
          {/* center — marca do ateliê (ambiente personalizado) */}
          <div className="flex justify-center min-w-0">
            <AtelierBrand atelier={atelier} size="md" />
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

          {/* Aviso de continuação — look acumulado a partir de uma prévia */}
          {baseGen && (
            <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
              {baseGen.result_image && (
                <img src={`/api/files/${baseGen.result_image}`} alt="" className="w-9 h-12 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary" /> Continuando este look
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Adicione ou troque peças — o resultado é renderizado da foto original (sem perder qualidade).
                </p>
              </div>
              <button
                onClick={clearLook}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground whitespace-nowrap shrink-0 px-2 py-1 rounded-full hover:bg-black/5 transition-colors"
              >
                Começar do zero
              </button>
            </div>
          )}

          {/* Garment selector — escolha a peça que vai receber o tecido */}
          <div>
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-3">
              1 · Escolha a peça
              <span className="ml-2 text-primary/80 normal-case tracking-normal">
                · monte quantas quiser
              </span>
            </p>
            <GarmentSelector
              value={activeGarment}
              onChange={handleGarmentChange}
              assignedGarments={look.map((it) => it.garment_type)}
            />
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

          {/* Catálogo — tecido para a peça, ou sapatos (peças únicas) */}
          <div>
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-3">
              {activeGarment === 'sapato' ? '2 · Escolha o sapato' : '2 · Tecido para'}
              {activeGarment !== 'sapato' && (
                <span className="ml-2 text-primary normal-case tracking-normal font-medium">
                  {GARMENT_ICONS[activeGarment]} {GARMENT_LABELS[activeGarment]}
                </span>
              )}
            </p>
            <FabricCatalog
              selectedFabricId={activeFabricId}
              onSelect={handleFabricSelect}
              atelierId={session.atelier_id}
              kind={activeGarment === 'sapato' ? 'shoe' : 'fabric'}
            />
          </div>

          {/* Seu look — itens atribuídos */}
          {look.length > 0 && (
            <div>
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
                <Layers className="w-3 h-3" /> Seu look · {look.length} {look.length === 1 ? 'peça' : 'peças'}
              </p>
              <div className="flex flex-wrap gap-2">
                {look.map((it) => (
                  <span
                    key={it.garment_type}
                    className="inline-flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-full glass text-xs font-medium text-foreground"
                  >
                    <span className="w-6 h-6 rounded-full overflow-hidden bg-muted shrink-0">
                      <img src={`/api/files/${it.fabric.texture_image}`} alt="" className="w-full h-full object-cover" />
                    </span>
                    <span>{GARMENT_LABELS[it.garment_type]} · {it.fabric.name}</span>
                    <button
                      onClick={() => removeLookItem(it.garment_type)}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
                      aria-label="Remover"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

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

      {/* ── Botão fixo: Gerar look ── */}
      {look.length > 0 && !generating && (
        <div className="sticky bottom-0 z-30 border-t border-white/60 bg-white/55 backdrop-blur-xl backdrop-saturate-150 px-4 py-3.5">
          <button
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl
                       bg-primary text-primary-foreground font-semibold text-sm
                       shadow-glow hover:bg-primary hover:scale-[1.01] active:scale-[0.98] transition-all"
          >
            <Sparkles className="w-4 h-4" />
            {session?.current_photo
              ? `Gerar look · ${look.length} ${look.length === 1 ? 'peça' : 'peças'}`
              : 'Capturar foto e gerar'}
            {baseGen && (
              <span className="text-primary-foreground/70 text-xs font-normal ml-1">· continuação</span>
            )}
          </button>
        </div>
      )}

      {/* ── Generating overlay ── */}
      {generating && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center z-50">
          <div className="glass-strong rounded-3xl p-8 text-center max-w-xs mx-4">
            {atelier && (
              <div className="flex justify-center mb-4">
                <AtelierBrand atelier={atelier} size="sm" showProduct={false} />
              </div>
            )}
            <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-semibold text-foreground">
              Iniciando geração...
            </p>
            <p className="text-xs text-muted-foreground mt-1">Você será redirecionado em instantes</p>
          </div>
        </div>
      )}
    </div>
  );
}
