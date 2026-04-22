'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Categorias carregadas da API
import { X, Upload, ImageIcon } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type { Fabric } from '@/types';

interface QuickFabricModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (fabric: Fabric) => void;
}

export function QuickFabricModal({ open, onClose, onCreated }: QuickFabricModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetch('/api/fabric-categories')
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setCategories(data.map((c: { name: string }) => c.name)); })
        .catch(() => {});
    }
  }, [open]);

  function reset() {
    setName('');
    setCode('');
    setCategory('');
    setFile(null);
    setPreview(null);
    setSaving(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !file) {
      toast.error('Nome, código e foto são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('code', code.trim().toUpperCase());
      form.append('category', category);
      form.append('texture', file);

      const res = await fetch('/api/fabrics', { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao cadastrar');
      }
      const fabric: Fabric = await res.json();
      toast.success('Tecido cadastrado!');
      onCreated(fabric);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar');
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex items-end sm:items-center justify-center"
      onClick={handleClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground"
            style={{ fontFamily: 'var(--font-syne)' }}>
            Cadastro rápido de tecido
          </p>
          <button onClick={handleClose}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Foto */}
          <div
            className="border-2 border-dashed border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              <div className="relative">
                <img src={preview} alt="Preview" className="w-full max-h-40 object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs font-medium">Trocar foto</p>
                </div>
              </div>
            ) : (
              <div className="h-28 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageIcon className="w-8 h-8 opacity-30" />
                <p className="text-xs">Foto da textura *</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

          {/* Nome + Código */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Nome *</Label>
              <Input
                placeholder="Ex: Super 120"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background border-border focus:border-primary/50 text-sm h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Código *</Label>
              <Input
                placeholder="Ex: FAB-001"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono bg-background border-border focus:border-primary/50 text-sm h-9"
              />
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Categoria</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Selecionar</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={handleClose}
              className="flex-1 border-border text-muted-foreground hover:text-foreground text-xs h-10">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}
              className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-10">
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {saving ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
