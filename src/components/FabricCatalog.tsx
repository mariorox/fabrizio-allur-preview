'use client';

import { useState, useEffect, useRef } from 'react';
import { FabricCard } from './FabricCard';
import { Input } from '@/components/ui/input';
import type { Fabric, FabricKind } from '@/types';
import { Search, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuickFabricModal } from './QuickFabricModal';

interface FabricCatalogProps {
  selectedFabricId?: string | null;
  onSelect: (fabric: Fabric) => void;
  atelierId?: string | null;
  /** 'fabric' = catálogo de tecidos · 'shoe' = catálogo de sapatos (peças únicas). */
  kind?: FabricKind;
  className?: string;
}

export function FabricCatalog({ selectedFabricId, onSelect, atelierId, kind = 'fabric', className }: FabricCatalogProps) {
  const isShoe = kind === 'shoe';
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  // Sequencia as requisições: só a resposta mais recente atualiza o estado
  // (evita que um fetch antigo/vazio sobrescreva o correto ao trocar de catálogo).
  const reqIdRef = useRef(0);

  // Categorias só se aplicam a tecidos (Lã, Linho, etc.) — sapatos não usam.
  useEffect(() => {
    if (isShoe) return;
    fetch('/api/fabric-categories')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCategories(data.map((c: { name: string }) => c.name)); })
      .catch(() => {});
  }, [isShoe]);

  // Ao alternar entre tecido/sapato, zera busca e filtro (contextos distintos).
  useEffect(() => { setSearch(''); setCategory(null); }, [isShoe]);

  useEffect(() => {
    fetchFabrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, atelierId, kind]);

  async function fetchFabrics() {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    const params = new URLSearchParams();
    params.set('kind', kind);
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (atelierId) params.set('atelier', atelierId);
    try {
      const res = await fetch(`/api/fabrics?${params}`);
      const data = await res.json();
      if (reqId !== reqIdRef.current) return; // resposta obsoleta — ignora
      setFabrics(data);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>

      {/* Search + Add button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder={isShoe ? 'Buscar sapato por nome ou código...' : 'Buscar por nome ou código...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 bg-card border-border text-foreground placeholder:text-muted-foreground
                       focus:border-primary/50 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-primary/30
                     text-primary hover:bg-primary/10 hover:border-primary/60 transition-all"
          title={isShoe ? 'Cadastrar sapato' : 'Cadastrar tecido'}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Category filters — só para tecidos */}
      {!isShoe && (
      <div className="flex gap-1.5 flex-wrap">
        {[null, ...categories].map((cat) => (
          <button
            key={cat ?? '__all'}
            onClick={() => setCategory(cat === category ? null : cat)}
            className={cn(
              'text-[10px] tracking-wider uppercase px-3 py-1 rounded-full border transition-all',
              category === cat
                ? 'border-primary text-primary bg-primary/10'
                : 'border-border text-muted-foreground hover:border-border hover:text-foreground hover:bg-accent',
            )}
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            {cat ?? 'Todos'}
          </button>
        ))}
      </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-border animate-pulse">
              <div className="aspect-square bg-accent" />
              <div className="p-2.5 space-y-1.5 bg-card">
                <div className="h-3 bg-accent rounded w-3/4" />
                <div className="h-2.5 bg-accent rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : fabrics.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-3xl mb-3">{isShoe ? '👞' : '🧵'}</p>
          <p className="text-sm" style={{ fontFamily: 'var(--font-syne)' }}>
            {isShoe ? 'Nenhum sapato encontrado' : 'Nenhum tecido encontrado'}
          </p>
          <p className="text-xs mt-1">{isShoe ? 'Cadastre um sapato ou ajuste a busca' : 'Ajuste a busca ou os filtros'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {fabrics.map((fabric) => (
            <FabricCard
              key={fabric.id}
              fabric={fabric}
              selected={fabric.id === selectedFabricId}
              onClick={() => onSelect(fabric)}
            />
          ))}
        </div>
      )}

      {/* Modal de cadastro rápido */}
      <QuickFabricModal
        open={showAddModal}
        atelierId={atelierId}
        kind={kind}
        onClose={() => setShowAddModal(false)}
        onCreated={(fabric) => {
          // Adiciona o novo tecido no topo da lista e seleciona
          setFabrics((prev) => [fabric, ...prev]);
          onSelect(fabric);
        }}
      />
    </div>
  );
}
