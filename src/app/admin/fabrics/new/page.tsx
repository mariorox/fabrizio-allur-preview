'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Upload, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function NewFabricPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [collection, setCollection] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isShoe, setIsShoe] = useState(false);

  useEffect(() => {
    setIsShoe(new URLSearchParams(window.location.search).get('kind') === 'shoe');
  }, []);

  useEffect(() => {
    if (isShoe) return;
    fetch('/api/fabric-categories')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCategories(data.map((c: { name: string }) => c.name)); })
      .catch(() => {});
  }, [isShoe]);

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
      toast.error(isShoe ? 'Nome, código e foto do sapato são obrigatórios' : 'Nome, código e foto da textura são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('code', code.trim().toUpperCase());
      form.append('category', isShoe ? '' : category);
      form.append('collection', isShoe ? '' : collection);
      form.append('kind', isShoe ? 'shoe' : 'fabric');
      form.append('texture', file);

      const res = await fetch('/api/fabrics', { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao cadastrar');
      }
      toast.success(isShoe ? 'Sapato cadastrado com sucesso!' : 'Tecido cadastrado com sucesso!');
      router.push(`/admin/fabrics${isShoe ? '?kind=shoe' : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (isShoe ? 'Erro ao cadastrar sapato' : 'Erro ao cadastrar tecido'));
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 p-2 -ml-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>
        <p className="font-semibold text-foreground text-sm"
          style={{ fontFamily: 'var(--font-syne)' }}>
          {isShoe ? 'Cadastrar Sapato' : 'Cadastrar Tecido'}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full">
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
          {/* Texture photo */}
          <div>
            <Label className="mb-2 block text-muted-foreground text-xs uppercase tracking-wider">
              {isShoe ? 'Foto do sapato *' : 'Foto da textura *'}
            </Label>
            <div
              className="border-2 border-dashed border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="Preview" className="w-full max-h-64 object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <p className="text-white text-sm font-medium">Clique para trocar</p>
                  </div>
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <ImageIcon className="w-12 h-12 opacity-30" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Clique para adicionar foto</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {isShoe ? 'Ideal: sapato em fundo neutro, bem iluminado' : 'Ideal: macro do tecido em alta resolução'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WEBP</p>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs text-muted-foreground uppercase tracking-wider">
                {isShoe ? 'Nome do sapato *' : 'Nome do tecido *'}
              </Label>
              <Input
                id="name"
                placeholder={isShoe ? 'Ex: Oxford Preto Cap Toe' : 'Ex: Super 120 Charcoal'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background border-border focus:border-primary/50"
              />
            </div>

            {/* Code */}
            <div className="space-y-2">
              <Label htmlFor="code" className="text-xs text-muted-foreground uppercase tracking-wider">
                Código *
              </Label>
              <Input
                id="code"
                placeholder={isShoe ? 'Ex: SAP-001' : 'Ex: FAB-001'}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                className="font-mono bg-background border-border focus:border-primary/50"
              />
            </div>

            {/* Category — só tecidos */}
            {!isShoe && (
              <div className="space-y-2">
                <Label htmlFor="category" className="text-xs text-muted-foreground uppercase tracking-wider">
                  Categoria
                </Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Selecionar categoria</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Collection — só tecidos */}
            {!isShoe && (
              <div className="space-y-2">
                <Label htmlFor="collection" className="text-xs text-muted-foreground uppercase tracking-wider">
                  Coleção
                </Label>
                <Input
                  id="collection"
                  placeholder="Ex: Inverno 2025"
                  value={collection}
                  onChange={(e) => setCollection(e.target.value)}
                  className="bg-background border-border focus:border-primary/50"
                />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="flex-1 border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {isShoe ? 'Cadastrar sapato' : 'Cadastrar tecido'}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
