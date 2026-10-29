'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Users, ChevronRight, ImageIcon, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SessionWithStats {
  id: string;
  client_name: string | null;
  created_at: string;
  current_photo: string | null;
  generation_count: number;
  last_activity: string | null;
}

function Avatar({ name, photo }: { name: string | null; photo: string | null }) {
  const [imgError, setImgError] = useState(false);

  if (photo && !imgError) {
    return (
      <img
        src={`/api/files/${photo}`}
        alt={name || 'Cliente'}
        className="w-11 h-11 rounded-full object-cover border border-border shrink-0"
        onError={() => setImgError(true)}
      />
    );
  }

  const initials = name ? name.trim()[0].toUpperCase() : '?';
  return (
    <div className="w-11 h-11 rounded-full bg-primary/10 border border-primary/20
                    flex items-center justify-center text-sm font-semibold text-primary shrink-0"
      style={{ fontFamily: 'var(--font-syne)' }}>
      {initials}
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  if (diff < 86400 * 2) return 'ontem';
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d atrás`;
  return formatDate(dateStr);
}

export default function ClientsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const LIMIT = 40;
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSessions = useCallback(async (searchTerm: string, off: number, replace: boolean) => {
    if (off === 0) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        stats: 'true',
        limit: String(LIMIT),
        offset: String(off),
      });
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/sessions?${params}`);
      const data = await res.json();
      setSessions((prev) => replace ? data.sessions : [...prev, ...data.sessions]);
      setTotal(data.total);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchSessions('', 0, true); }, [fetchSessions]);

  function handleSearch(value: string) {
    setSearch(value);
    setOffset(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSessions(value, 0, true), 300);
  }

  function clearSearch() {
    setSearch('');
    setOffset(0);
    fetchSessions('', 0, true);
    searchRef.current?.focus();
  }

  function loadMore() {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    fetchSessions(search, newOffset, false);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setTotal((prev) => prev - 1);
      setConfirmDeleteId(null);
      toast.success('Atendimento excluído');
    } catch {
      toast.error('Erro ao excluir atendimento');
    } finally {
      setDeleting(false);
    }
  }

  const hasMore = sessions.length < total;

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <header className="bar-surface border-b border-border px-3 sm:px-5 py-3 flex items-center gap-2 sm:gap-4 sticky top-0 z-10">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 p-2 -ml-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Início</span>
        </button>
        <div className="flex-1">
          <h1 className="font-display text-[20px] leading-tight text-foreground">
            Clientes
          </h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            {loading ? '…' : `${total} atendimento${total !== 1 ? 's' : ''} no total`}
          </p>
        </div>
        <Users className="w-4 h-4 text-muted-foreground shrink-0" />
      </header>

      {/* Search bar */}
      <div className="px-4 py-3 border-b border-border bg-card sticky top-[61px] z-10">
        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Buscar por nome do cliente..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm bg-background border border-border rounded-lg
                       text-foreground placeholder:text-muted-foreground/70
                       focus:outline-none focus:border-primary/50 transition-colors"
          />
          {search && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 max-w-3xl mx-auto w-full">

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 animate-pulse">
                <div className="w-11 h-11 rounded-full bg-accent shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-accent rounded w-32" />
                  <div className="h-2.5 bg-accent/60 rounded w-20" />
                </div>
                <div className="h-3 bg-accent rounded w-16" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-primary/40" />
            </div>
            <p className="text-foreground font-semibold mb-1" style={{ fontFamily: 'var(--font-syne)' }}>
              {search ? 'Nenhum cliente encontrado' : 'Nenhum atendimento ainda'}
            </p>
            <p className="text-muted-foreground text-sm">
              {search ? `Nenhum resultado para "${search}"` : 'Inicie um atendimento na tela principal'}
            </p>
            {search && (
              <button onClick={clearSearch} className="mt-4 text-sm text-primary hover:text-primary/80 transition-colors">
                Limpar busca
              </button>
            )}
          </div>
        )}

        {/* Session list */}
        {!loading && sessions.length > 0 && (
          <>
            {search && (
              <p className="text-xs text-muted-foreground mb-3">
                {total} resultado{total !== 1 ? 's' : ''} para <span className="text-foreground">"{search}"</span>
              </p>
            )}

            <div className="space-y-2">
              {sessions.map((session) => (
                <div key={session.id} className="relative group">

                  {/* Confirm delete overlay */}
                  {confirmDeleteId === session.id && (
                    <div className="absolute inset-0 z-10 bg-destructive/10 border border-destructive/30
                                    rounded-xl flex items-center justify-between px-4 gap-3 backdrop-blur-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground" style={{ fontFamily: 'var(--font-syne)' }}>
                          Excluir atendimento?
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {session.generation_count > 0
                            ? `${session.generation_count} prévia${session.generation_count !== 1 ? 's' : ''} serão apagadas`
                            : 'Esta ação não pode ser desfeita'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-muted-foreground hover:text-foreground border border-border
                                     rounded-full px-3 py-1.5 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleDelete(session.id)}
                          disabled={deleting}
                          className="text-xs text-white bg-destructive hover:bg-destructive/90
                                     rounded-full px-3 py-1.5 transition-colors disabled:opacity-50 font-medium"
                        >
                          {deleting ? '…' : 'Excluir'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Session row */}
                  <div className={`bg-card border border-border rounded-xl px-4 py-3.5
                                   flex items-center gap-3 hover:border-primary/30 hover:bg-accent/30
                                   transition-all ${confirmDeleteId === session.id ? 'opacity-0 pointer-events-none' : ''}`}>

                    {/* Clickable area → navigate */}
                    <button
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      onClick={() => router.push(`/session/${session.id}`)}
                    >
                      <Avatar name={session.client_name} photo={session.current_photo} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {session.client_name || <span className="text-muted-foreground italic">Sem nome</span>}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(session.created_at)} às {formatTime(session.created_at)}
                        </span>
                      </div>
                    </button>

                    {/* Stats */}
                    <div className="flex items-center gap-3 shrink-0">
                      {session.generation_count > 0 ? (
                        <div className="text-right hidden sm:block">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                            <ImageIcon className="w-3 h-3" />
                            <span>{session.generation_count} prévia{session.generation_count !== 1 ? 's' : ''}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(session.last_activity)}</p>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground hidden sm:block">sem prévias</span>
                      )}

                      {/* Delete button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(session.id); }}
                        className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive
                                   hover:bg-destructive/10 transition-colors"
                        title="Excluir atendimento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => router.push(`/session/${session.id}`)}
                        className="text-muted-foreground/70 hover:text-primary transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-sm text-muted-foreground hover:text-foreground border border-border
                             rounded-full px-6 py-2 hover:border-primary/30 transition-all disabled:opacity-50"
                >
                  {loadingMore ? 'Carregando...' : `Ver mais (${total - sessions.length} restantes)`}
                </button>
              </div>
            )}

            <p className="text-center text-[11px] text-muted-foreground mt-6">
              {sessions.length} de {total} atendimentos
            </p>
          </>
        )}
      </div>
    </div>
  );
}
