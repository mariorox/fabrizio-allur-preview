'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GenerationCard } from '@/components/GenerationCard';
import type { Generation } from '@/types';
import { GARMENT_LABELS } from '@/types';
import { ArrowLeft, BarChart2 } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ComparePage({ params }: Props) {
  const { id: sessionId } = use(params);
  const router = useRouter();

  const [generations, setGenerations] = useState<Generation[]>([]);
  const [selected, setSelected] = useState<Generation[]>([]);
  const [viewMode, setViewMode] = useState<'select' | 'compare'>('select');

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/generations`)
      .then((r) => r.json())
      .then((gens: Generation[]) => setGenerations(gens.filter((g) => g.status === 'success')))
      .catch(() => {});
  }, [sessionId]);

  function toggleSelect(gen: Generation) {
    setSelected((prev) => {
      const exists = prev.find((g) => g.id === gen.id);
      if (exists) return prev.filter((g) => g.id !== gen.id);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, gen];
    });
  }

  function startCompare() {
    if (selected.length >= 2) setViewMode('compare');
  }

  if (viewMode === 'compare') {
    return (
      <div className="min-h-screen bg-zinc-900 flex flex-col">
        <header className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('select')}
            className="gap-1 text-zinc-300 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
            Selecionar
          </Button>
          <p className="text-white font-semibold text-sm">Comparação lado a lado</p>
        </header>

        <div className={`flex-1 grid gap-2 p-3 ${selected.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {selected.map((gen) => (
            <div key={gen.id} className="flex flex-col gap-2">
              <div className="flex-1 rounded-xl overflow-hidden bg-zinc-800">
                <img
                  src={`/api/files/${gen.result_image}`}
                  alt="Prévia"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="bg-zinc-800 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  {gen.fabric_texture && (
                    <img
                      src={`/api/files/${gen.fabric_texture}`}
                      alt=""
                      className="w-6 h-6 rounded object-cover"
                    />
                  )}
                  <p className="font-semibold text-white text-sm truncate">{gen.fabric_name}</p>
                </div>
                <p className="text-xs text-zinc-400 font-mono">{gen.fabric_code}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{GARMENT_LABELS[gen.garment_type]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/session/${sessionId}`)}
          className="gap-1 text-zinc-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Sessão
        </Button>
        <div className="flex-1">
          <p className="font-semibold text-zinc-900 text-sm">Comparar prévias</p>
          <p className="text-xs text-zinc-400">Selecione 2 ou 3 prévias para comparar</p>
        </div>
        <Button
          size="sm"
          onClick={startCompare}
          disabled={selected.length < 2}
          className="gap-2"
        >
          <BarChart2 className="w-4 h-4" />
          Comparar ({selected.length})
        </Button>
      </header>

      <div className="flex-1 p-4">
        {generations.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <p className="text-4xl mb-3">📸</p>
            <p className="font-medium">Nenhuma prévia disponível</p>
            <p className="text-sm mt-1">Gere pelo menos 2 prévias para comparar</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-500 mb-4">
              {selected.length === 0
                ? 'Selecione as prévias que deseja comparar'
                : selected.length === 1
                ? 'Selecione mais uma prévia'
                : `${selected.length} prévias selecionadas`}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {generations.map((gen) => (
                <GenerationCard
                  key={gen.id}
                  generation={gen}
                  selectable
                  selected={selected.some((s) => s.id === gen.id)}
                  onSelect={toggleSelect}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
