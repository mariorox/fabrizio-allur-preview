'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Upload, X, ImageIcon, FolderPlus, CheckCircle2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface PendingFabric {
  id: string;
  name: string;
  code: string;
  file: File;
  previewUrl: string;
}

function generateCode(collectionName: string, index: number): string {
  const words = collectionName.trim().split(/\s+/);
  const prefix = words
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 4)
    .replace(/[^A-Z]/g, '') || 'COL';
  return `${prefix}-${String(index + 1).padStart(3, '0')}`;
}

function nameFromFile(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export default function NewCollectionPage() {
  const router = useRouter();
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [collectionName, setCollectionName] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [fabrics, setFabrics] = useState<PendingFabric[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);

  useEffect(() => {
    fetch('/api/fabric-categories')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCategories(data.map((c: { name: string }) => c.name)); })
      .catch(() => {});
  }, []);

  function addFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error('Selecione apenas arquivos de imagem (JPG, PNG, WEBP)');
      return;
    }
    const currentCount = fabrics.length;
    const newFabrics: PendingFabric[] = imageFiles.map((file, i) => ({
      id: `${Date.now()}-${i}`,
      name: nameFromFile(file.name),
      code: generateCode(collectionName || 'COL', currentCount + i),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setFabrics((prev) => [...prev, ...newFabrics]);
  }

  function removeFabric(id: string) {
    setFabrics((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      return updated.map((f, i) => ({ ...f, code: generateCode(collectionName || 'COL', i) }));
    });
  }

  function updateFabric(id: string, field: 'name' | 'code', value: string) {
    setFabrics((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  }

  function handleCollectionNameChange(name: string) {
    setCollectionName(name);
    setFabrics((prev) => prev.map((f, i) => ({ ...f, code: generateCode(name || 'COL', i) })));
  }

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!dropRef.current?.contains(e.relatedTarget as Node)) setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [fabrics, collectionName]); // eslint-disable-line

  async function handleSubmit() {
    if (!collectionName.trim()) { toast.error('Informe o nome da coleção'); return; }
    if (fabrics.length === 0) { toast.error('Adicione pelo menos uma textura'); return; }
    const invalid = fabrics.filter((f) => !f.name.trim() || !f.code.trim());
    if (invalid.length > 0) { toast.error('Todos os tecidos precisam de nome e código'); return; }

    setSaving(true);
    try {
      const form = new FormData();
      form.append('collection', collectionName.trim());
      if (category) form.append('category', category);
      fabrics.forEach((fabric, i) => {
        form.append(`items[${i}][name]`, fabric.name.trim());
        form.append(`items[${i}][code]`, fabric.code.trim().toUpperCase());
        form.append(`items[${i}][texture]`, fabric.file);
      });
      const res = await fetch('/api/fabrics/batch', { method: 'POST', body: form });
      const data = await res.json();
      setResult({ created: data.created?.length ?? 0, errors: data.errors ?? [] });
      if (data.created?.length > 0) {
        toast.success(`${data.created.length} tecido${data.created.length !== 1 ? 's' : ''} cadastrado${data.created.length !== 1 ? 's' : ''} com sucesso!`);
      }
      if (data.errors?.length > 0) data.errors.forEach((e: string) => toast.error(e));
    } catch {
      toast.error('Erro ao criar coleção. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  // Success state
  if (result && result.created > 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-card rounded-3xl border border-border p-10 max-w-md w-full">
          <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2"
            style={{ fontFamily: 'var(--font-syne)' }}>
            Coleção criada!
          </h2>
          <p className="text-muted-foreground mb-1">
            <span className="font-semibold text-foreground">{collectionName}</span>
          </p>
          <p className="text-muted-foreground text-sm mb-6">
            {result.created} tecido{result.created !== 1 ? 's' : ''} adicionado{result.created !== 1 ? 's' : ''} ao catálogo
          </p>
          {result.errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 mb-5 text-left">
              <p className="text-xs font-semibold text-destructive mb-1">{result.errors.length} erro(s):</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-destructive/80">{e}</p>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={() => { setResult(null); setFabrics([]); setCollectionName(''); setCategory(''); }}
            >
              Nova coleção
            </Button>
            <Button
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => router.push('/admin/fabrics')}
            >
              Ver catálogo
            </Button>
          </div>
        </div>
      </div>
    );
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
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm"
            style={{ fontFamily: 'var(--font-syne)' }}>
            Nova Coleção
          </p>
          <p className="text-[10px] text-muted-foreground">Cadastre múltiplos tecidos de uma vez</p>
        </div>
        {fabrics.length > 0 && (
          <span className="text-xs text-primary border border-primary/30 rounded-full px-2.5 py-0.5 shrink-0">
            {fabrics.length} tecido{fabrics.length !== 1 ? 's' : ''}
          </span>
        )}
      </header>

      <div className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Collection info */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <FolderPlus className="w-4 h-4 text-primary" />
            <p className="font-semibold text-foreground text-sm"
              style={{ fontFamily: 'var(--font-syne)' }}>
              Dados da Coleção
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="collection-name" className="text-xs text-muted-foreground uppercase tracking-wider">
                Nome da coleção *
              </Label>
              <Input
                id="collection-name"
                placeholder="Ex: Inverno 2025, Coleção Premium..."
                value={collectionName}
                onChange={(e) => handleCollectionNameChange(e.target.value)}
                autoFocus
                className="bg-background border-border focus:border-primary/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-xs text-muted-foreground uppercase tracking-wider">
                Categoria (aplicada a todos)
              </Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Sem categoria</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Drop zone */}
        <div
          ref={dropRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
            ${isDragging
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-border hover:border-primary/40 hover:bg-card'}
          `}
        >
          <Upload className={`w-10 h-10 mx-auto mb-3 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground/60'}`} />
          <p className="font-semibold text-foreground text-sm"
            style={{ fontFamily: 'var(--font-syne)' }}>
            {isDragging ? 'Solte as imagens aqui' : 'Arraste as fotos das texturas aqui'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
          <p className="text-[10px] text-muted-foreground mt-2">JPG, PNG, WEBP · Múltiplos arquivos permitidos</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {/* Fabric grid */}
        {fabrics.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground"
                style={{ fontFamily: 'var(--font-syne)' }}>
                Tecidos da coleção
                <span className="text-muted-foreground font-normal ml-2 text-xs">
                  — edite nome e código de cada um
                </span>
              </p>
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="w-3 h-3" />
                Adicionar mais
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {fabrics.map((fabric) => (
                <div
                  key={fabric.id}
                  className="bg-card rounded-2xl border border-border overflow-hidden group"
                >
                  <div className="relative aspect-square bg-background">
                    <img
                      src={fabric.previewUrl}
                      alt={fabric.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeFabric(fabric.id)}
                      className="absolute top-2 right-2 w-7 h-7 bg-background/90 hover:bg-destructive/10 border border-border hover:border-destructive/30 rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>

                  <div className="p-3 space-y-2">
                    <Input
                      value={fabric.name}
                      onChange={(e) => updateFabric(fabric.id, 'name', e.target.value)}
                      placeholder="Nome do tecido"
                      className="text-sm h-8 bg-background border-border focus:border-primary/50"
                    />
                    <Input
                      value={fabric.code}
                      onChange={(e) => updateFabric(fabric.id, 'code', e.target.value.toUpperCase())}
                      placeholder="CÓDIGO"
                      className="text-sm h-8 font-mono bg-background border-border focus:border-primary/50"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        {fabrics.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{fabrics.length} tecido{fabrics.length !== 1 ? 's' : ''}</span>
              {collectionName && <span> · Coleção: <span className="font-semibold text-foreground/80">{collectionName}</span></span>}
              {category && <span> · {category}</span>}
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => router.back()}
                disabled={saving}
                className="flex-1 sm:flex-none border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !collectionName.trim()}
                className="flex-1 sm:flex-none gap-2 min-w-[160px] bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-4 h-4" />
                    Criar coleção
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
