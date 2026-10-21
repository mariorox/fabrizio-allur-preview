'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Category {
  id: number;
  name: string;
  sort_order: number;
}


export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch('/api/fabric-categories');
    const data = await res.json();
    if (Array.isArray(data)) setCategories(data);
    setLoading(false);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    const res = await fetch('/api/fabric-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      toast.success('Categoria criada');
      setNewName('');
      load();
    } else {
      const err = await res.json();
      toast.error(err.error || 'Erro ao criar');
    }
  }

  async function handleUpdate(id: number) {
    if (!editingName.trim()) return;
    const res = await fetch(`/api/fabric-categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingName.trim() }),
    });
    if (res.ok) {
      toast.success('Categoria atualizada');
      setEditingId(null);
      load();
    } else {
      const err = await res.json();
      toast.error(err.error || 'Erro ao atualizar');
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Excluir a categoria "${name}"?\nTecidos dessa categoria ficarão sem categoria.`)) return;
    const res = await fetch(`/api/fabric-categories/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Categoria excluída');
      load();
    } else {
      toast.error('Erro ao excluir');
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/admin/fabrics')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex justify-center">
          <span className="font-display text-sm sm:text-base font-semibold tracking-[0.18em] uppercase text-foreground whitespace-nowrap">Provador Digital</span>
        </div>
        <div className="w-9" />
      </header>

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6">
        <div>
          <p className="text-[10px] tracking-widest uppercase text-primary mb-1"
            style={{ fontFamily: 'var(--font-syne)' }}>
            Configurações
          </p>
          <h1 className="text-xl font-bold text-foreground"
            style={{ fontFamily: 'var(--font-syne)' }}>
            Categorias de Tecidos
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Crie, edite ou exclua categorias do catálogo
          </p>
        </div>

        {/* Criar nova */}
        <div className="flex gap-2">
          <Input
            placeholder="Nova categoria..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="bg-card border-border focus:border-primary/50 text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-primary text-primary-foreground
                       hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <div key={i} className="h-12 animate-pulse bg-border/30 rounded-xl" />)}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma categoria cadastrada</p>
        ) : (
          <div className="space-y-1.5">
            {categories.map((cat) => (
              <div key={cat.id}
                className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 group">
                {editingId === cat.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdate(cat.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 bg-background border-border text-sm h-8"
                      autoFocus
                    />
                    <button onClick={() => handleUpdate(cat.id)}
                      className="p-1.5 text-emerald-400 hover:text-emerald-300 transition-colors">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-foreground">{cat.name}</span>
                    <button
                      onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }}
                      className="p-1.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      className="p-1.5 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
