'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { Generation, Session } from '@/types';
import { GARMENT_LABELS } from '@/types';
import {
  ArrowLeft, RefreshCw, Shirt, BarChart2,
  Download, Share2, RotateCcw, AlertCircle, Trash2
} from 'lucide-react';
import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import { toast } from 'sonner';

interface Props {
  params: Promise<{ id: string; genId: string }>;
}

export default function PreviewPage({ params }: Props) {
  const { id: sessionId, genId } = use(params);
  const router = useRouter();

  const [generation, setGeneration] = useState<Generation | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [polling, setPolling] = useState(true);

  /* ── Progresso simulado ── */
  const [startTime] = useState(() => Date.now());
  const [progress, setProgress] = useState(0);

  const loadGeneration = useCallback(async () => {
    const res = await fetch(`/api/generations/${genId}`);
    if (!res.ok) return;
    const gen: Generation = await res.json();
    setGeneration(gen);
    if (gen.status === 'success' || gen.status === 'failed') setPolling(false);
  }, [genId]);

  useEffect(() => {
    loadGeneration();
    fetch(`/api/sessions/${sessionId}`).then((r) => r.json()).then(setSession).catch(() => {});
  }, [sessionId, loadGeneration]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(loadGeneration, 2000);
    return () => clearInterval(interval);
  }, [polling, loadGeneration]);

  /* Progresso simulado: sobe rápido no início, desacelera depois */
  useEffect(() => {
    if (!polling) { setProgress(100); return; }
    const tick = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000; // segundos
      // assintótico: chega a ~95% em ~45s sem nunca travar
      const sim = Math.min(95, Math.round(95 * (1 - Math.exp(-elapsed / 25))));
      setProgress(sim);
    }, 400);
    return () => clearInterval(tick);
  }, [polling, startTime]);

  async function retryGeneration() {
    if (!generation || !session) return;
    try {
      const res = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          fabric_id: generation.fabric_id,
          garment_type: generation.garment_type,
          client_photo: generation.client_photo,
        }),
      });
      const newGen = await res.json();
      router.replace(`/session/${sessionId}/preview/${newGen.id}`);
    } catch {
      toast.error('Falha ao tentar novamente.');
    }
  }

  function downloadImage() {
    if (!generation?.result_image) return;
    const a = document.createElement('a');
    a.href = `/api/files/${generation.result_image}`;
    a.download = `preview-${generation.fabric_code ?? generation.fabric_id}-${generation.garment_type}.jpg`;
    a.click();
  }

  async function sharePreview() {
    if (!generation?.result_image) return;

    const shareText =
      `Prévia da sua peça — Fabrizio Allur\n` +
      `Peça: ${GARMENT_LABELS[generation.garment_type]}\n` +
      `Tecido: ${generation.fabric_name} (${generation.fabric_code})`;

    // ── Web Share API com arquivo (iOS/Android) ──
    if (navigator.share) {
      try {
        const response = await fetch(`/api/files/${generation.result_image}`);
        const blob = await response.blob();
        const ext = blob.type.includes('png') ? 'png' : 'jpg';
        const file = new File(
          [blob],
          `preview-${generation.fabric_code ?? 'fabrizio'}.${ext}`,
          { type: blob.type }
        );

        if (navigator.canShare?.({ files: [file] })) {
          // Copia o texto pro clipboard antes de abrir o share
          // (WhatsApp ignora o campo text quando há arquivos)
          try { await navigator.clipboard.writeText(shareText); } catch {}
          toast.info('Texto copiado! Cole a mensagem no WhatsApp após enviar a imagem.', {
            duration: 6000,
          });
          await navigator.share({
            title: 'Fabrizio Allur — Virtual Preview',
            files: [file],
          });
          return;
        }

        // Suporta share mas não arquivos — envia só texto
        await navigator.share({ title: 'Fabrizio Allur', text: shareText });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // ── Fallback desktop: WhatsApp Web com texto ──
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  }

  const isLoading = !generation || generation.status === 'pending' || generation.status === 'processing';
  const isFailed  = generation?.status === 'failed';
  const isSuccess = generation?.status === 'success';

  const garmentEmoji =
    generation?.garment_type === 'terno' ? '🤵' :
    generation?.garment_type === 'blazer' ? '🧥' :
    generation?.garment_type === 'camisa' ? '👔' :
    generation?.garment_type === 'polo'   ? '👕' : '👖';

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ── */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push(`/session/${sessionId}`)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 p-2 -ml-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Sessão
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate"
            style={{ fontFamily: 'var(--font-syne)' }}>
            {generation
              ? `${GARMENT_LABELS[generation.garment_type]} — ${generation.fabric_name}`
              : 'Carregando...'}
          </p>
          {generation?.fabric_code && (
            <p className="text-[10px] text-muted-foreground font-mono">{generation.fabric_code}</p>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">

        {/* ── Image area ── */}
        <div className="flex-1 p-4 flex items-start justify-center">
          <div className="w-full max-w-2xl space-y-4">

            {isLoading ? (
              <div className="space-y-4">
                {/* Skeleton com shimmer */}
                <div className="aspect-[3/4] rounded-2xl bg-card border border-border overflow-hidden relative">
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-card via-background to-card" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
                    <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <div className="w-7 h-7 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                    </div>
                    <p className="text-4xl font-bold text-primary tabular-nums"
                      style={{ fontFamily: 'var(--font-syne)' }}>
                      {progress}%
                    </p>
                    <p className="text-xs text-muted-foreground text-center">
                      {progress < 15 ? 'Enviando imagem para a IA...' :
                       progress < 35 ? 'Analisando foto do cliente...' :
                       progress < 55 ? 'Identificando silhueta...' :
                       progress < 72 ? 'Aplicando o tecido na peça...' :
                       progress < 88 ? 'Refinando detalhes...' :
                       'Finalizando, quase pronto...'}
                    </p>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground"
                      style={{ fontFamily: 'var(--font-syne)' }}>
                      Gerando prévia com IA
                    </p>
                    <span className="text-xs font-bold text-primary tabular-nums"
                      style={{ fontFamily: 'var(--font-syne)' }}>
                      {progress}%
                    </span>
                  </div>
                  {/* Track */}
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    ✦ Isso pode levar de 30s a 2 minutos
                  </p>
                </div>
              </div>

            ) : isFailed ? (
              <div className="aspect-[3/4] rounded-2xl bg-destructive/5 border border-destructive/20
                              flex flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground"
                    style={{ fontFamily: 'var(--font-syne)' }}>
                    Não foi possível gerar
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {generation?.error_message || 'Ocorreu um erro na geração.'}
                  </p>
                </div>
              </div>

            ) : (
              <BeforeAfterSlider
                beforeSrc={`/api/files/${generation?.client_photo}`}
                afterSrc={`/api/files/${generation?.result_image}`}
                className="w-full"
              />
            )}

            {/* Fabric info strip */}
            {generation && !isLoading && (
              <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                {generation.fabric_texture && (
                  <img
                    src={`/api/files/${generation.fabric_texture}`}
                    alt={generation.fabric_name ?? ''}
                    className="w-9 h-9 rounded-lg object-cover border border-border shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate"
                    style={{ fontFamily: 'var(--font-syne)' }}>
                    {generation.fabric_name}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{generation.fabric_code}</p>
                </div>
                <span className="text-xl shrink-0">{garmentEmoji}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Action panel ── */}
        <aside className="w-full md:w-64 border-t md:border-t-0 md:border-l border-border bg-card p-4 space-y-2">
          <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-3"
            style={{ fontFamily: 'var(--font-syne)' }}>
            Ações
          </p>

          {isFailed ? (
            <>
              <ActionBtn icon={<RefreshCw className="w-3.5 h-3.5" />} primary onClick={retryGeneration}>
                Tentar novamente
              </ActionBtn>
              <ActionBtn icon={<Shirt className="w-3.5 h-3.5" />} onClick={() => router.push(`/session/${sessionId}`)}>
                Trocar tecido
              </ActionBtn>
              <ActionBtn icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={() => router.push(`/session/${sessionId}/capture`)}>
                Refazer foto
              </ActionBtn>
            </>
          ) : (
            <>
              <ActionBtn icon={<Shirt className="w-3.5 h-3.5" />} disabled={isLoading}
                onClick={() => router.push(`/session/${sessionId}`)}>
                Trocar tecido
              </ActionBtn>
              <ActionBtn icon={<span className="text-sm">🔄</span>} disabled={isLoading}
                onClick={() => router.push(`/session/${sessionId}`)}>
                Trocar peça
              </ActionBtn>
              <ActionBtn icon={<BarChart2 className="w-3.5 h-3.5" />} disabled={isLoading}
                onClick={() => router.push(`/session/${sessionId}/compare`)}>
                Comparar prévias
              </ActionBtn>
              <ActionBtn icon={<RotateCcw className="w-3.5 h-3.5" />} disabled={isLoading}
                onClick={() => router.push(`/session/${sessionId}/capture`)}>
                Refazer foto
              </ActionBtn>

              <div className="h-px bg-border my-3" />
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-2"
                style={{ fontFamily: 'var(--font-syne)' }}>
                Compartilhar
              </p>
              <ActionBtn icon={<Download className="w-3.5 h-3.5" />} primary disabled={!isSuccess} onClick={downloadImage}>
                Salvar imagem
              </ActionBtn>
              <ActionBtn
                icon={<Share2 className="w-3.5 h-3.5" />}
                disabled={!isSuccess}
                onClick={sharePreview}
              >
                Compartilhar
              </ActionBtn>

              <div className="h-px bg-border my-3" />
              <ActionBtn
                icon={<Trash2 className="w-3.5 h-3.5" />}
                disabled={isLoading}
                onClick={async () => {
                  if (!confirm('Excluir esta prévia?')) return;
                  try {
                    await fetch(`/api/generations/${genId}`, { method: 'DELETE' });
                    toast.success('Prévia excluída');
                    router.push(`/session/${sessionId}`);
                  } catch {
                    toast.error('Erro ao excluir');
                  }
                }}
              >
                Excluir prévia
              </ActionBtn>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── Reusable action button ── */
function ActionBtn({
  children,
  icon,
  primary,
  disabled,
  onClick,
  className,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Button
      variant={primary ? 'default' : 'outline'}
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={`w-full justify-start gap-2 rounded-lg text-xs h-9 ${
        primary
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border-border text-foreground hover:bg-accent hover:border-border'
      } ${className ?? ''}`}
      style={{ fontFamily: 'var(--font-syne)' }}
    >
      {icon}
      {children}
    </Button>
  );
}
