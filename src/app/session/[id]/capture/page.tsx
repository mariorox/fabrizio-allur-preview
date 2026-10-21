'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CameraCapture } from '@/components/Camera';
import { AtelierBrand } from '@/components/AtelierBrand';
import { Button } from '@/components/ui/button';
import type { Session, Atelier } from '@/types';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  params: Promise<{ id: string }>;
}

export default function CapturePage({ params }: Props) {
  const { id: sessionId } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [atelier, setAtelier] = useState<Atelier | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((s: Session) => {
        setSession(s);
        if (s.atelier_id) {
          fetch(`/api/ateliers?id=${s.atelier_id}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((a) => a && setAtelier(a))
            .catch(() => {});
        }
      })
      .catch(() => router.push('/'));
  }, [sessionId, router]);

  async function handleCapture(blob: Blob) {
    setUploading(true);
    try {
      // Upload photo
      const form = new FormData();
      form.append('file', blob, 'photo.jpg');
      form.append('type', 'client-photo');
      form.append('session_id', sessionId);

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: form });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { path: photoPath } = await uploadRes.json();

      // Update session with new photo
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_photo: photoPath }),
      });

      // If fabric already selected, generate immediately
      if (session?.current_fabric_id) {
        const genRes = await fetch('/api/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            fabric_id: session.current_fabric_id,
            garment_type: session.current_garment,
            client_photo: photoPath,
          }),
        });
        const gen = await genRes.json();
        router.push(`/session/${sessionId}/preview/${gen.id}`);
      } else {
        toast.success('Foto salva! Agora selecione um tecido.');
        router.push(`/session/${sessionId}`);
      }
    } catch {
      toast.error('Falha ao salvar foto. Tente novamente.');
      setUploading(false);
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <div className="text-foreground">
          <p className="font-semibold text-sm">Capturar foto</p>
          <p className="text-xs text-muted-foreground">{session.client_name || 'Cliente'}</p>
        </div>
        {atelier && (
          <div className="ml-auto">
            <AtelierBrand atelier={atelier} size="sm" showProduct={false} />
          </div>
        )}
      </div>

      {/* Camera */}
      <div className="flex-1 p-4">
        {uploading ? (
          <div className="h-full flex flex-col items-center justify-center text-foreground text-center gap-4">
            <div className="w-12 h-12 border-2 border-border border-t-foreground rounded-full animate-spin" />
            <div>
              <p className="font-semibold">Salvando foto...</p>
              <p className="text-sm text-muted-foreground mt-1">Aguarde um momento</p>
            </div>
          </div>
        ) : (
          <CameraCapture
            garmentType={session.current_garment}
            onCapture={handleCapture}
            className="max-w-lg mx-auto"
          />
        )}
      </div>
    </div>
  );
}
