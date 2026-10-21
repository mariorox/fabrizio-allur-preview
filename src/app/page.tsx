'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { AtelierWithStats } from '@/types';
import { Settings, BarChart2, MapPin, ArrowRight, Scissors, Sparkles } from 'lucide-react';

export default function MarketplacePage() {
  const router = useRouter();
  const [ateliers, setAteliers] = useState<AtelierWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ateliers')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAteliers(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative">

      {/* ── Top bar — frosted glass ─────────────────────────────── */}
      <header className="sticky top-0 z-30 px-5 py-4 grid grid-cols-3 items-center
                         bg-white/55 backdrop-blur-xl backdrop-saturate-150
                         border-b border-white/60 shadow-[0_1px_0_0_rgba(255,255,255,0.6),0_8px_24px_-16px_rgba(28,32,54,0.25)]">
        <span />
        <div className="flex justify-center">
          <span className="font-display text-base sm:text-lg font-semibold tracking-[0.16em] uppercase text-foreground whitespace-nowrap">
            Provador <span className="text-primary">Digital</span>
          </span>
        </div>
        <div className="flex justify-end items-center">
          <button
            onClick={() => router.push('/admin/fabrics')}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-2 -mr-1 rounded-full hover:bg-black/5"
            title="Catálogo (admin)"
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={() => router.push('/admin/stats')}
            className="flex items-center text-muted-foreground hover:text-primary transition-colors p-2 rounded-full hover:bg-black/5"
            title="Estatísticas"
          >
            <BarChart2 className="w-[18px] h-[18px]" />
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto px-5 sm:px-6 py-10 sm:py-14">

        {/* ── Hero ── */}
        <div className="text-center max-w-xl mx-auto mb-10 sm:mb-14">
          <div className="animate-rise inline-flex items-center gap-2 mb-6 px-3.5 py-1.5 rounded-full
                          glass text-[11px] font-medium tracking-[0.14em] uppercase text-muted-foreground"
            style={{ animationDelay: '40ms' }}>
            <Scissors className="w-3 h-3 text-primary" />
            Alfaiatarias high-ticket
          </div>
          <h1 className="animate-rise text-[2.4rem] sm:text-5xl font-semibold tracking-tight text-foreground mb-4 leading-[1.04]"
            style={{ animationDelay: '120ms' }}>
            Escolha seu{' '}
            <span className="bg-gradient-to-br from-primary to-[oklch(0.5_0.04_60)] bg-clip-text text-transparent">
              ateliê
            </span>
          </h1>
          <p className="animate-rise text-[15px] sm:text-base text-muted-foreground leading-relaxed"
            style={{ animationDelay: '200ms' }}>
            Os ateliês de alfaiataria mais reconhecidos à sua disposição.
            Escolha um, prove as peças com o tecido escolhido e veja antes de produzir.
          </p>
        </div>

        {/* ── Grid de ateliês ── */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-3xl overflow-hidden glass animate-pulse">
                <div className="h-32 bg-black/5" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-black/5 rounded w-2/3" />
                  <div className="h-3 bg-black/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ateliers.map((a, i) => (
              <button
                key={a.id}
                onClick={() => router.push(`/atelier/${a.slug}`)}
                className="animate-rise group glass glass-sheen rounded-3xl overflow-hidden text-left
                           hover:-translate-y-1 transition-transform duration-300"
                style={{ animationDelay: `${260 + i * 60}ms` }}
              >
                {/* Capa */}
                <div className="relative h-32 overflow-hidden">
                  {a.cover_image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.cover_image}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                  {/* Avatar */}
                  <div className="absolute -bottom-6 left-4 w-14 h-14 rounded-2xl overflow-hidden
                                  ring-4 ring-white/80 shadow-lg bg-white">
                    {a.avatar_image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.avatar_image} alt={a.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="pt-8 px-4 pb-4">
                  <h3 className="text-[15px] font-semibold text-foreground leading-tight">{a.name}</h3>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{a.neighborhood ?? a.city}</span>
                  </div>
                  <p className="text-xs text-muted-foreground/90 mt-2 leading-snug line-clamp-2 min-h-[2rem]">
                    {a.specialty ?? a.tagline}
                  </p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/50">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/80">
                      <Sparkles className="w-3 h-3 text-primary" />
                      {a.fabric_count} tecidos
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-1.5 transition-all">
                      Entrar <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="relative z-10 px-6 pb-7 flex justify-center">
        <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground/70">
          Marketplace de alfaiataria sob medida
        </p>
      </footer>
    </div>
  );
}
