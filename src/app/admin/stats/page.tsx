'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp, Users, Sparkles, CheckCircle, BarChart2, Shirt, Clock, Flame, X, ExternalLink, Cpu, Zap, AlertTriangle } from 'lucide-react';
import type { DashboardStats } from '@/lib/db';
import { GARMENT_LABELS } from '@/types';

interface ProviderStatus {
  provider: string;
  label: string;
  hasKey: boolean;
  keyValid: boolean | null;
  models?: string[];
  credits?: { total: number; subscription: number; on_demand: number };
  balance?: { usd: string };
  dashboardUrl?: string;
}

const GARMENT_EMOJI: Record<string, string> = {
  terno: '🤵', blazer: '🧥', camisa: '👔', polo: '👕', calca: '👖', sapato: '👞',
};

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};


export default function StatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<DashboardStats['recent_previews'][0] | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch('/api/provider-status')
      .then((r) => r.json())
      .then((data) => { if (data && !data.error) setProviderStatus(data); })
      .catch(() => {});
  }, []);

  const maxDaily = Math.max(...(stats?.daily_activity ?? []).map((d) => d.count), 1);
  const totalGarments = (stats?.garment_breakdown ?? []).reduce((a, b) => a + b.count, 0) || 1;
  const maxFabric = stats?.top_fabrics?.[0]?.count || 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ── */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 p-2 -ml-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex justify-center">
          <span className="font-display text-sm sm:text-base font-semibold tracking-[0.18em] uppercase text-foreground whitespace-nowrap">Provador Digital</span>
        </div>
        <div className="w-9" />
      </header>

      <div className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full space-y-6">

        {/* Title */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-4 h-4 text-primary" />
            <p className="text-[10px] tracking-widest uppercase text-primary"
              style={{ fontFamily: 'var(--font-syne)' }}>
              Dashboard
            </p>
          </div>
          <h1 className="text-2xl font-bold text-foreground"
            style={{ fontFamily: 'var(--font-syne)' }}>
            Análise do Negócio
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Dados em tempo real da alfaiataria
          </p>
        </div>

        {/* ── Provider Status ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground"
              style={{ fontFamily: 'var(--font-syne)' }}>
              Inteligência Artificial
            </p>
          </div>

          {!providerStatus ? (
            <div className="h-12 animate-pulse bg-border/30 rounded-lg" />
          ) : (
            <div className="space-y-3">
              {/* Provider + Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    providerStatus.keyValid === true ? 'bg-emerald-500' :
                    providerStatus.keyValid === false ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                  <span className="text-sm font-semibold text-foreground"
                    style={{ fontFamily: 'var(--font-syne)' }}>
                    {providerStatus.label}
                  </span>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  providerStatus.keyValid === true
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : providerStatus.keyValid === false
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-yellow-500/10 text-yellow-400'
                }`} style={{ fontFamily: 'var(--font-syne)' }}>
                  {providerStatus.keyValid === true ? 'ATIVA' :
                   providerStatus.keyValid === false ? 'INVÁLIDA' : 'VERIFICANDO'}
                </span>
              </div>

              {/* Models */}
              {providerStatus.models && (
                <div className="flex flex-wrap gap-1.5">
                  {providerStatus.models.map((m) => (
                    <span key={m} className="text-[9px] px-2 py-0.5 rounded-full bg-border/50 text-muted-foreground font-mono">
                      {m}
                    </span>
                  ))}
                </div>
              )}

              {/* Fashn.ai Credits */}
              {providerStatus.credits && (
                <div className="bg-background rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-primary" />
                      Créditos restantes
                    </span>
                    <span className="text-lg font-bold text-foreground tabular-nums"
                      style={{ fontFamily: 'var(--font-syne)' }}>
                      {providerStatus.credits.total}
                    </span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, (providerStatus.credits.total / Math.max(providerStatus.credits.total + 10, 100)) * 100)}%`,
                        backgroundColor: providerStatus.credits.total < 20
                          ? 'var(--color-destructive, #ef4444)'
                          : 'var(--color-primary)',
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>Plano: {providerStatus.credits.subscription}</span>
                    <span>Avulso: {providerStatus.credits.on_demand}</span>
                  </div>
                  {providerStatus.credits.total < 20 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-red-400 mt-1">
                      <AlertTriangle className="w-3 h-3" />
                      Créditos baixos! Recarregue em breve.
                    </div>
                  )}
                </div>
              )}

              {/* Dashboard link */}
              {providerStatus.dashboardUrl && (
                <a
                  href={providerStatus.dashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Ver painel do provedor
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            loading={loading}
            icon={<Users className="w-4 h-4" />}
            label="Atendimentos"
            value={stats?.total_sessions ?? 0}
            sub={`${stats?.sessions_this_week ?? 0} esta semana`}
            accent
          />
          <KpiCard
            loading={loading}
            icon={<Sparkles className="w-4 h-4" />}
            label="Prévias geradas"
            value={stats?.total_generations ?? 0}
            sub={`${stats?.sessions_this_month ?? 0} atendimentos este mês`}
          />
          <KpiCard
            loading={loading}
            icon={<CheckCircle className="w-4 h-4" />}
            label="Taxa de sucesso"
            value={`${stats?.success_rate ?? 0}%`}
            sub={`${stats?.failed_generations ?? 0} falhas registradas`}
          />
          <KpiCard
            loading={loading}
            icon={<TrendingUp className="w-4 h-4" />}
            label="Média por sessão"
            value={stats?.avg_per_session ?? 0}
            sub="prévias por atendimento"
          />
        </div>

        {/* ── Gráfico diário ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-4"
            style={{ fontFamily: 'var(--font-syne)' }}>
            Prévias — últimos 30 dias
          </p>

          {loading ? (
            <div className="h-24 animate-pulse bg-border/30 rounded-lg" />
          ) : (
            <div className="flex items-end gap-[3px] h-24">
              {(stats?.daily_activity ?? []).map((d, i) => {
                const pct = maxDaily > 0 ? (d.count / maxDaily) * 100 : 0;
                const isToday = i === (stats?.daily_activity?.length ?? 0) - 1;
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {d.count > 0 && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-foreground text-background
                                      text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100
                                      transition-opacity pointer-events-none z-10">
                        {d.count}
                      </div>
                    )}
                    <div
                      className={`w-full rounded-t-sm transition-all duration-300 ${
                        isToday ? 'bg-primary' : d.count > 0 ? 'bg-primary/50' : 'bg-border/40'
                      }`}
                      style={{ height: `${Math.max(pct, d.count > 0 ? 8 : 2)}%` }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {!loading && stats && (
            <div className="flex justify-between mt-2">
              <span className="text-[9px] text-muted-foreground">
                {formatDay(stats.daily_activity[0]?.day)}
              </span>
              <span className="text-[9px] text-muted-foreground">
                {formatDay(stats.daily_activity[14]?.day)}
              </span>
              <span className="text-[9px] text-primary font-semibold">hoje</span>
            </div>
          )}
        </div>

        {/* ── Peças + Tecidos ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Peças mais pedidas */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shirt className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground"
                style={{ fontFamily: 'var(--font-syne)' }}>
                Peças mais pedidas
              </p>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-8 animate-pulse bg-border/30 rounded" />)}
              </div>
            ) : (stats?.garment_breakdown ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados ainda</p>
            ) : (
              <div className="space-y-3">
                {(stats?.garment_breakdown ?? []).map((g) => {
                  const pct = Math.round((g.count / totalGarments) * 100);
                  return (
                    <div key={g.garment_type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-foreground flex items-center gap-1.5">
                          <span>{GARMENT_EMOJI[g.garment_type] ?? '👗'}</span>
                          {GARMENT_LABELS[g.garment_type as keyof typeof GARMENT_LABELS] ?? g.garment_type}
                        </span>
                        <span className="text-xs font-semibold text-primary tabular-nums"
                          style={{ fontFamily: 'var(--font-syne)' }}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tecidos mais usados */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-4"
              style={{ fontFamily: 'var(--font-syne)' }}>
              Tecidos mais usados
            </p>

            {loading ? (
              <div className="space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-6 animate-pulse bg-border/30 rounded" />)}
              </div>
            ) : (stats?.top_fabrics ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados ainda</p>
            ) : (
              <div className="space-y-2.5">
                {(stats?.top_fabrics ?? []).map((f, i) => {
                  const pct = Math.round((f.count / maxFabric) * 100);
                  return (
                    <div key={f.fabric_code} className="flex items-center gap-3">
                      <span className="text-[10px] font-bold tabular-nums w-4 text-right shrink-0"
                        style={{
                          fontFamily: 'var(--font-syne)',
                          color: i === 0 ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                        }}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-foreground truncate">{f.fabric_name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono ml-2 shrink-0">
                            {f.count}×
                          </span>
                        </div>
                        <div className="h-0.5 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              background: i === 0
                                ? 'var(--color-primary)'
                                : `oklch(1 0 0 / ${0.6 - i * 0.07})`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Atividade mensal ── */}
        {!loading && stats && stats.monthly_activity.length > 1 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-4"
              style={{ fontFamily: 'var(--font-syne)' }}>
              Evolução mensal
            </p>
            <div className="flex items-end gap-3 h-20">
              {stats.monthly_activity.map((m) => {
                const maxM = Math.max(...stats.monthly_activity.map((x) => x.count), 1);
                const pct = (m.count / maxM) * 100;
                const [, mm] = m.month.split('-');
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-semibold text-primary tabular-nums"
                      style={{ fontFamily: 'var(--font-syne)' }}>
                      {m.count}
                    </span>
                    <div className="w-full flex items-end" style={{ height: '44px' }}>
                      <div
                        className="w-full bg-primary/60 rounded-t-sm"
                        style={{ height: `${Math.max(pct, 10)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">
                      {MONTH_LABELS[mm] ?? mm}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Galeria das últimas prévias ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground"
              style={{ fontFamily: 'var(--font-syne)' }}>
              Últimas prévias geradas
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {[1,2,3,4,5,6,7,8,9].map(i => (
                <div key={i} className="aspect-[3/4] animate-pulse bg-border/30 rounded-xl" />
              ))}
            </div>
          ) : (stats?.recent_previews ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem prévias ainda</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {(stats?.recent_previews ?? []).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setLightbox(p)}
                  className="relative group overflow-hidden rounded-xl aspect-[3/4] bg-border/20 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <img
                    src={`/api/files/${p.result_image}`}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Overlay com infos ao hover */}
                  <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100
                                  transition-opacity flex flex-col items-center justify-end p-2 gap-0.5">
                    <span className="text-base">{GARMENT_EMOJI[p.garment_type] ?? '👗'}</span>
                    <p className="text-[9px] text-foreground text-center leading-tight line-clamp-1 w-full">
                      {p.fabric_name}
                    </p>
                    <p className="text-[8px] text-muted-foreground font-mono">{p.fabric_code}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Heatmap de horários ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground"
              style={{ fontFamily: 'var(--font-syne)' }}>
              Horários de pico
            </p>
          </div>

          {loading ? (
            <div className="space-y-1.5">
              {[1,2,3,4,5,6,7].map(i => (
                <div key={i} className="h-5 animate-pulse bg-border/30 rounded" />
              ))}
            </div>
          ) : (
            <HeatmapChart data={stats?.hourly_heatmap ?? []} />
          )}
        </div>

        {/* ── Combinações mais pedidas ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground"
              style={{ fontFamily: 'var(--font-syne)' }}>
              Combinações mais pedidas
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-8 animate-pulse bg-border/30 rounded" />
              ))}
            </div>
          ) : (stats?.top_combos ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados ainda</p>
          ) : (
            <div className="space-y-2.5">
              {(stats?.top_combos ?? []).map((c, i) => {
                const maxCombo = stats?.top_combos?.[0]?.count || 1;
                const pct = Math.round((c.count / maxCombo) * 100);
                return (
                  <div key={`${c.garment_type}-${c.fabric_code}`} className="flex items-center gap-3">
                    <span
                      className="text-[10px] font-bold tabular-nums w-4 text-right shrink-0"
                      style={{
                        fontFamily: 'var(--font-syne)',
                        color: i === 0 ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-xl shrink-0">{GARMENT_EMOJI[c.garment_type] ?? '👗'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-foreground truncate">
                          {GARMENT_LABELS[c.garment_type as keyof typeof GARMENT_LABELS] ?? c.garment_type}
                          <span className="text-muted-foreground mx-1">·</span>
                          {c.fabric_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono ml-2 shrink-0">
                          {c.count}×
                        </span>
                      </div>
                      <div className="h-0.5 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: i === 0
                              ? 'var(--color-primary)'
                              : `oklch(1 0 0 / ${Math.max(0.15, 0.65 - i * 0.07)})`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Rodapé ── */}
        <p className="text-center text-[10px] text-muted-foreground pb-4"
          style={{ fontFamily: 'var(--font-syne)' }}>
          PROVADOR DIGITAL · VIRTUAL PREVIEW SYSTEM
        </p>

      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-background/97 flex flex-col"
          onClick={() => setLightbox(null)}
        >
          {/* Barra superior */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{GARMENT_EMOJI[lightbox.garment_type] ?? '👗'}</span>
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight"
                  style={{ fontFamily: 'var(--font-syne)' }}>
                  {GARMENT_LABELS[lightbox.garment_type as keyof typeof GARMENT_LABELS] ?? lightbox.garment_type}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lightbox.fabric_name}
                  {lightbox.fabric_code && (
                    <span className="font-mono ml-1 text-muted-foreground">· {lightbox.fabric_code}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Botão ir para sessão */}
              <button
                onClick={() => router.push(`/session/${lightbox.session_id}/preview/${lightbox.id}`)}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80
                           transition-colors border border-primary/30 hover:border-primary/60
                           px-3 py-1.5 rounded-lg"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver na sessão
              </button>

              {/* Fechar */}
              <button
                onClick={() => setLightbox(null)}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Imagem centralizada */}
          <div
            className="flex-1 flex items-center justify-center p-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`/api/files/${lightbox.result_image}`}
              alt=""
              className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl"
              style={{ maxHeight: 'calc(100vh - 80px)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── KPI Card ── */
function KpiCard({
  icon, label, value, sub, accent, loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 space-y-2 ${
      accent
        ? 'bg-primary/5 border-primary/20'
        : 'bg-card border-border'
    }`}>
      <div className={`${accent ? 'text-primary' : 'text-muted-foreground'}`}>
        {icon}
      </div>
      {loading ? (
        <div className="space-y-1.5">
          <div className="h-7 w-16 animate-pulse bg-border/50 rounded" />
          <div className="h-3 w-24 animate-pulse bg-border/30 rounded" />
        </div>
      ) : (
        <>
          <p className={`text-3xl font-bold tabular-nums leading-none ${
            accent ? 'text-primary' : 'text-foreground'
          }`} style={{ fontFamily: 'var(--font-syne)' }}>
            {value}
          </p>
          <p className="text-[10px] text-muted-foreground leading-snug">{label}</p>
          {sub && (
            <p className="text-[10px] text-muted-foreground/70 leading-snug">{sub}</p>
          )}
        </>
      )}
    </div>
  );
}

/* ── Heatmap Chart ── */
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HEATMAP_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

function HeatmapChart({ data }: { data: { day_of_week: number; hour: number; count: number }[] }) {
  const map = new Map(data.map((d) => [`${d.day_of_week}-${d.hour}`, d.count]));
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem dados ainda</p>;
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div style={{ minWidth: '260px' }}>
        {/* Labels das horas */}
        <div className="flex gap-[3px] mb-1.5" style={{ paddingLeft: '30px' }}>
          {HEATMAP_HOURS.map((h) => (
            <div
              key={h}
              className="flex-1 text-center"
              style={{ fontSize: '7px', color: 'var(--color-muted-foreground)' }}
            >
              {h}h
            </div>
          ))}
        </div>

        {/* Linhas por dia */}
        {DAY_LABELS.map((day, dayIdx) => (
          <div key={day} className="flex items-center gap-[3px] mb-[3px]">
            <span
              className="shrink-0 text-right pr-1.5"
              style={{ width: '26px', fontSize: '9px', color: 'var(--color-muted-foreground)' }}
            >
              {day}
            </span>
            {HEATMAP_HOURS.map((h) => {
              const count = map.get(`${dayIdx}-${h}`) ?? 0;
              const intensity = count > 0 ? 0.12 + (count / maxCount) * 0.88 : 0;
              return (
                <div
                  key={h}
                  title={count > 0 ? `${day} ${h}h — ${count} prévia${count > 1 ? 's' : ''}` : undefined}
                  className="flex-1 rounded-sm relative cursor-default"
                  style={{
                    height: '20px',
                    backgroundColor: count > 0
                      ? `oklch(1 0 0 / ${intensity})`
                      : 'oklch(1 0 0 / 0.05)',
                  }}
                >
                  {count >= 2 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span style={{
                        fontSize: '7px',
                        fontWeight: 700,
                        color: intensity > 0.55 ? '#0A0A0A' : 'var(--color-foreground)',
                      }}>
                        {count}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Legenda de intensidade */}
        <div className="flex items-center gap-1.5 mt-3 justify-end">
          <span style={{ fontSize: '8px', color: 'var(--color-muted-foreground)' }}>menos</span>
          {[0.08, 0.25, 0.45, 0.65, 0.85, 1.0].map((op) => (
            <div
              key={op}
              className="rounded-sm"
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: `oklch(1 0 0 / ${op})`,
              }}
            />
          ))}
          <span style={{ fontSize: '8px', color: 'var(--color-muted-foreground)' }}>mais</span>
        </div>
      </div>
    </div>
  );
}

function formatDay(iso?: string): string {
  if (!iso) return '';
  const [, mm, dd] = iso.split('-');
  return `${dd}/${mm}`;
}
