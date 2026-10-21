'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, ArrowRight, Scissors, Eye, EyeOff } from 'lucide-react';
import { safeNext } from '@/lib/site-auth';

function EntrarForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError('');
    const res = await fetch('/api/entrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (res?.ok) {
      // navegação completa para o proxy já enxergar o cookie novo
      window.location.replace(safeNext(params.get('next')));
      return;
    }
    setLoading(false);
    setPassword('');
    setError(res?.status === 401 ? 'Senha incorreta. Tente novamente.' : 'Não foi possível entrar. Verifique a conexão.');
  }

  return (
    <form
      onSubmit={submit}
      className="animate-rise glass-strong glass-sheen w-full max-w-sm rounded-3xl p-7 sm:p-8 shadow-float"
      style={{ animationDelay: '120ms' }}
    >
      <div className="mx-auto mb-5 w-12 h-12 rounded-2xl glass flex items-center justify-center">
        <Lock className="w-5 h-5 text-primary" />
      </div>
      <h1 className="text-center text-xl font-semibold tracking-tight text-foreground">
        Acesso restrito
      </h1>
      <p className="text-center text-[13px] text-muted-foreground mt-1.5 mb-6">
        Digite a senha para entrar no provador.
      </p>

      <label htmlFor="senha" className="sr-only">Senha</label>
      <div className="relative">
        <input
          id="senha"
          type={showPassword ? 'text' : 'password'}
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          placeholder="Senha"
          className="w-full h-12 rounded-2xl bg-white/70 border border-white/80 pl-4 pr-12 text-[15px] text-foreground
                     placeholder:text-muted-foreground/70 outline-none transition
                     focus:bg-white focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
          aria-invalid={!!error}
          aria-describedby={error ? 'senha-erro' : undefined}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={showPassword}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl inline-flex items-center justify-center
                     text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
        >
          {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
        </button>
      </div>
      <p id="senha-erro" role="alert" className="min-h-5 mt-2 text-[12.5px] text-destructive text-center">
        {error}
      </p>

      <button
        type="submit"
        disabled={!password || loading}
        className="mt-2 w-full h-12 rounded-2xl bg-primary text-primary-foreground text-[15px] font-medium
                   inline-flex items-center justify-center gap-2 transition
                   hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
      >
        {loading ? 'Entrando…' : (<>Entrar <ArrowRight className="w-4 h-4" /></>)}
      </button>
    </form>
  );
}

export default function EntrarPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-12 relative">
      <div className="animate-rise mb-8 text-center" style={{ animationDelay: '40ms' }}>
        <div className="font-display text-lg sm:text-xl font-semibold tracking-[0.16em] uppercase text-foreground whitespace-nowrap">
          Provador <span className="text-primary">Digital</span>
        </div>
        <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass
                        text-[11px] font-medium tracking-[0.14em] uppercase text-muted-foreground">
          <Scissors className="w-3 h-3 text-primary" />
          Alfaiatarias high-ticket
        </div>
      </div>

      <Suspense>
        <EntrarForm />
      </Suspense>
    </div>
  );
}
