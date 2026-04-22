'use client';

import { useState, useEffect } from 'react';
import { FabricCard } from './FabricCard';
import { Input } from '@/components/ui/input';
import type { Fabric } from '@/types';
import { Search, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuickFabricModal } from './QuickFabricModal';

interface FabricCatalogProps {
  selectedFabricId?: string | null;
  onSelect: (fabric: Fabric) => void;
  className?: string;
}

export function FabricCatalog({ selectedFabricId, onSelect, className }: FabricCatalogProps) {
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetch('/api/fabric-categories')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCategories(data.map((c: { name: string }) => c.name)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchFabrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

  async function fetchFabrics() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    const res = await fetch(`/api/fabrics?${params}`);
    const data = await res.json();
    setFabrics(data);
    setLoading(false);
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>

      {/* Search + Add button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
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
          title="Cadastrar tecido"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Category filters */}
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
          <p className="text-3xl mb-3">🧵</p>
          <p className="text-sm" style={{ fontFamily: 'var(--font-syne)' }}>Nenhum tecido encontrado</p>
          <p className="text-xs mt-1">Ajuste a busca ou os filtros</p>
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
