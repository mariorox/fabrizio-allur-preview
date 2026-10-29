'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { AtelierWithStats } from '@/types';
import { Settings, BarChart2, MapPin, ArrowRight, Users } from 'lucide-react';
import { VestoLogo } from '@/components/VestoLogo';

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

      {/* ── Topo ── */}
      <header className="sticky top-0 z-30 bar-surface border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <VestoLogo size="md" />
          <div className="flex items-center shrink-0">
            <button
              onClick={() => router.push('/clients')}
              className="p-2 sm:p-2.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              title="Clientes atendidos"
              aria-label="Clientes atendidos"
            >
              <Users className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => router.push('/admin/fabrics')}
              className="p-2 sm:p-2.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              title="Catálogo de tecidos"
              aria-label="Catálogo de tecidos"
            >
              <Settings className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => router.push('/admin/stats')}
              className="p-2 sm:p-2.5 -mr-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              title="Estatísticas"
              aria-label="Estatísticas"
            >
              <BarChart2 className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-9 pb-12 sm:pt-14 sm:pb-16">

        {/* ── Abertura ── */}
        <div className="animate-rise max-w-2xl mb-8 sm:mb-12">
          <h1 className="text-[2.6rem] leading-[1.02] sm:text-6xl text-foreground">
            Escolha o ateliê
          </h1>
          <p className="mt-3 sm:mt-4 text-[15px] sm:text-[17px] text-muted-foreground leading-relaxed max-w-[52ch]">
            Cada ateliê tem seu próprio catálogo de tecidos. Escolha um para fotografar o cliente
            e ver a peça pronta antes de cortar.
          </p>
        </div>

        {/* ── Ateliês ── */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden glass animate-pulse">
                <div className="h-36 bg-white/5" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-white/5 rounded w-2/3" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : ateliers.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-foreground">Nenhum ateliê ativo ainda.</p>
            <p className="text-sm text-muted-foreground mt-1">Cadastre um ateliê para começar a fazer provas.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {ateliers.map((a) => (
              <button
                key={a.id}
                onClick={() => router.push(`/atelier/${a.slug}`)}
                className="group glass rounded-2xl overflow-hidden text-left transition-colors
                           hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-primary"
              >
                {/* Capa */}
                <div className="relative h-36 overflow-hidden">
                  {a.cover_image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.cover_image}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                </div>

                {/* Identificação */}
                <div className="px-4 pb-4 flex gap-3">
                  <div className="-mt-7 w-14 h-14 shrink-0 rounded-full overflow-hidden ring-[3px] ring-card bg-secondary relative">
                    {a.avatar_image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.avatar_image} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 pt-2.5 flex-1">
                    <h3 className="font-display text-[19px] leading-tight text-foreground">{a.name}</h3>
                    <p className="flex items-center gap-1 text-[12.5px] text-muted-foreground mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{a.neighborhood ?? a.city}</span>
                    </p>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <p className="text-[13px] text-muted-foreground leading-snug line-clamp-2 min-h-[2.4em]">
                    {a.specialty ?? a.tagline}
                  </p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <span className="text-[12.5px] text-foreground/80">
                      {a.fabric_count} {a.fabric_count === 1 ? 'tecido' : 'tecidos'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[13px] font-medium text-primary">
                      Abrir ateliê <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="relative z-10 px-6 pb-8 flex justify-center">
        <p className="text-[12px] text-muted-foreground/70">Vesto · alfaiataria sob medida, provada antes do corte</p>
      </footer>
    </div>
  );
}
