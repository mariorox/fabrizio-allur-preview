'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { Fabric } from '@/types';
import { Plus, ArrowLeft, Trash2, FolderPlus, Tags } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminFabricsPage() {
  const router = useRouter();
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFabrics();
  }, []);

  async function loadFabrics() {
    setLoading(true);
    const res = await fetch('/api/fabrics?all=true');
    const data = await res.json();
    setFabrics(data);
    setLoading(false);
  }

  async function toggleActive(fabric: Fabric) {
    const newVal = fabric.is_active ? 0 : 1;
    await fetch(`/api/fabrics/${fabric.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: newVal }),
    });
    setFabrics((prev) =>
      prev.map((f) => (f.id === fabric.id ? { ...f, is_active: newVal } : f))
    );
    toast.success(newVal ? 'Tecido ativado' : 'Tecido desativado');
  }

  async function deleteFabric(fabric: Fabric) {
    if (!confirm(`Excluir "${fabric.name}"? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/fabrics/${fabric.id}`, { method: 'DELETE' });
    setFabrics((prev) => prev.filter((f) => f.id !== fabric.id));
    toast.success('Tecido excluído');
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 p-2 -ml-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Início</span>
        </button>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm truncate"
            style={{ fontFamily: 'var(--font-syne)' }}>
            Catálogo de Tecidos
          </p>
          <p className="text-[10px] text-muted-foreground">
            {fabrics.length} tecido{fabrics.length !== 1 ? 's' : ''} cadastrado{fabrics.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/admin/categories')}
            className="gap-1.5 border-border text-muted-foreground hover:text-foreground hover:bg-accent text-xs h-8 px-3"
          >
            <Tags className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Categorias</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/admin/collections/new')}
            className="gap-1.5 border-border text-muted-foreground hover:text-foreground hover:bg-accent text-xs h-8 px-3"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nova coleção</span>
          </Button>
          <Button
            size="sm"
            onClick={() => router.push('/admin/fabrics/new')}
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 px-3"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tecido avulso</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-border border-t-primary rounded-full animate-spin" />
          </div>
        ) : fabrics.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🧵</p>
            <p className="font-semibold text-foreground text-lg mb-2"
              style={{ fontFamily: 'var(--font-syne)' }}>
              Nenhum tecido cadastrado
            </p>
            <p className="text-muted-foreground text-sm mb-6">Cadastre tecidos para aparecerem no catálogo</p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => router.push('/admin/collections/new')}
                className="gap-2 border-border text-muted-foreground hover:text-foreground"
              >
                <FolderPlus className="w-4 h-4" />
                Nova coleção
              </Button>
              <Button
                onClick={() => router.push('/admin/fabrics/new')}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Tecido avulso
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3"
                      style={{ fontFamily: 'var(--font-syne)' }}>Tecido</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3"
                      style={{ fontFamily: 'var(--font-syne)' }}>Código</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell"
                      style={{ fontFamily: 'var(--font-syne)' }}>Categoria</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell"
                      style={{ fontFamily: 'var(--font-syne)' }}>Coleção</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell"
                      style={{ fontFamily: 'var(--font-syne)' }}>Usos</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3"
                      style={{ fontFamily: 'var(--font-syne)' }}>Ativo</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {fabrics.map((fabric) => (
                    <tr key={fabric.id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={`/api/files/${fabric.texture_image}`}
                            alt={fabric.name}
                            className="w-10 h-10 rounded-lg object-cover border border-border shrink-0"
                          />
                          <span className="font-medium text-foreground text-sm">{fabric.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted-foreground bg-background border border-border px-2 py-1 rounded whitespace-nowrap">
                          {fabric.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {fabric.category ? (
                          <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
                            {fabric.category}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-muted-foreground text-sm">{fabric.collection || '—'}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-muted-foreground text-sm">{fabric.usage_count}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={fabric.is_active === 1}
                          onCheckedChange={() => toggleActive(fabric)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="text-muted-foreground/70 hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10"
                          onClick={() => deleteFabric(fabric)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
