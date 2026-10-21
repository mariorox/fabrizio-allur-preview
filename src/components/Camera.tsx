'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw, Check, AlertCircle, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GarmentType } from '@/types';

const GARMENT_HINTS: Record<GarmentType, string> = {
  terno: 'Enquadre o corpo inteiro, de cabeça a pé. Fundo neutro.',
  blazer: 'Enquadre da cabeça até a cintura/quadril. Fundo neutro.',
  camisa: 'Enquadre da cabeça até a cintura. Fundo neutro.',
  polo: 'Enquadre da cabeça até a cintura. Fundo neutro.',
  calca: 'Enquadre o corpo inteiro. Fundo neutro.',
  sapato: 'Enquadre os pés/calçados. Boa luz, fundo neutro.',
};

interface CameraProps {
  garmentType: GarmentType;
  onCapture: (blob: Blob) => void;
  className?: string;
}

type Mode  = 'camera' | 'upload';
type Phase = 'input'  | 'preview';

export function CameraCapture({ garmentType, onCapture, className }: CameraProps) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const filePhotoRef  = useRef<HTMLInputElement>(null); // captura nativa (câmera)
  const fileGalleryRef = useRef<HTMLInputElement>(null); // galeria/arquivo

  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode]               = useState<Mode>('camera');
  const [phase, setPhase]             = useState<Phase>('input');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob]       = useState<Blob | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false); // HTTP/permissão

  // ── Camera ──────────────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch {
      // HTTPS ausente ou permissão negada — cai direto no modo upload
      setCameraBlocked(true);
      setMode('upload');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => {
    if (mode === 'camera' && phase === 'input') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, phase, startCamera, stopCamera]);

  const takePhoto = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0);
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedDataUrl(dataUrl);
    canvas.toBlob((blob) => { if (blob) setCapturedBlob(blob); }, 'image/jpeg', 0.9);
    stopCamera();
    setPhase('preview');
  }, [stopCamera]);

  // ── File input ──────────────────────────────────────────────────────────────

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCapturedDataUrl(url);
    setCapturedBlob(file);
    setPhase('preview');
    e.target.value = '';
  }, []);

  // ── Shared ──────────────────────────────────────────────────────────────────

  const retake = useCallback(() => {
    if (capturedDataUrl?.startsWith('blob:')) URL.revokeObjectURL(capturedDataUrl);
    setCapturedDataUrl(null);
    setCapturedBlob(null);
    setPhase('input');
    if (mode === 'camera') startCamera();
  }, [capturedDataUrl, mode, startCamera]);

  const confirm = useCallback(() => {
    if (capturedBlob) onCapture(capturedBlob);
  }, [capturedBlob, onCapture]);

  const switchMode = useCallback((next: Mode) => {
    if (next === 'camera' && cameraBlocked) return; // sem HTTPS, não tenta
    if (capturedDataUrl?.startsWith('blob:')) URL.revokeObjectURL(capturedDataUrl);
    setCapturedDataUrl(null);
    setCapturedBlob(null);
    setPhase('input');
    setMode(next);
  }, [capturedDataUrl, cameraBlocked]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={cn('flex flex-col gap-4', className)}>

      {/* Hint */}
      <div className="bg-card border border-border rounded-2xl px-4 py-3 flex gap-2 items-start text-sm text-muted-foreground">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{GARMENT_HINTS[garmentType]}</span>
      </div>

      {/* Mode tabs — esconde a aba Câmera se bloqueada por HTTP */}
      {!cameraBlocked && (
        <div className="flex rounded-full overflow-hidden border border-border bg-secondary p-1">
          <button
            onClick={() => switchMode('camera')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-medium transition-colors',
              mode === 'camera' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Camera className="w-4 h-4" />
            Câmera
          </button>
          <button
            onClick={() => switchMode('upload')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-medium transition-colors',
              mode === 'upload' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <ImageIcon className="w-4 h-4" />
            Galeria
          </button>
        </div>
      )}

      {/* Viewport */}
      <div className="relative rounded-2xl overflow-hidden bg-neutral-900 aspect-[3/4] max-h-[60vh] w-full">

        {phase === 'preview' ? (
          <img
            src={capturedDataUrl ?? ''}
            alt="Foto selecionada"
            className="w-full h-full object-cover"
          />

        ) : mode === 'camera' ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm">Iniciando câmera...</p>
                </div>
              </div>
            )}
            {cameraReady && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-4 border-2 border-white/30 rounded-2xl" />
                <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-xs bg-black/20 px-3 py-1 rounded-full">
                  Posicione-se no centro
                </div>
              </div>
            )}
          </>

        ) : (
          /* Upload — dois botões: câmera nativa + galeria */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6">

            {/* Tirar foto agora (app de câmera nativo — funciona sem HTTPS) */}
            <button
              onClick={() => filePhotoRef.current?.click()}
              className="w-full flex items-center gap-4 bg-white/10 hover:bg-white/20 transition-colors rounded-2xl px-5 py-4 text-white text-left"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold">Tirar foto agora</p>
                <p className="text-xs text-white/75 mt-0.5">Abre a câmera do celular</p>
              </div>
            </button>

            {/* Escolher da galeria */}
            <button
              onClick={() => fileGalleryRef.current?.click()}
              className="w-full flex items-center gap-4 bg-white/10 hover:bg-white/20 transition-colors rounded-2xl px-5 py-4 text-white text-left"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold">Escolher da galeria</p>
                <p className="text-xs text-white/75 mt-0.5">Fotos e arquivos salvos</p>
              </div>
            </button>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Inputs ocultos */}
      {/* capture="user" → câmera frontal nativa no celular */}
      <input ref={filePhotoRef}   type="file" accept="image/*" capture="user"      className="hidden" onChange={handleFileChange} />
      {/* sem capture → deixa o SO escolher (galeria ou câmera) */}
      <input ref={fileGalleryRef} type="file" accept="image/*"                     className="hidden" onChange={handleFileChange} />

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        {phase === 'preview' ? (
          <>
            <Button variant="outline" size="lg" onClick={retake} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              {mode === 'camera' ? 'Refazer' : 'Trocar'}
            </Button>
            <Button size="lg" onClick={confirm} className="gap-2 px-8 rounded-full">
              <Check className="w-5 h-5" />
              Usar esta foto
            </Button>
          </>
        ) : mode === 'camera' ? (
          <Button
            size="lg"
            onClick={takePhoto}
            disabled={!cameraReady}
            className="gap-2 px-8 rounded-full"
          >
            <Camera className="w-5 h-5" />
            Tirar Foto
          </Button>
        ) : null /* botões inline no upload */}
      </div>
    </div>
  );
}
