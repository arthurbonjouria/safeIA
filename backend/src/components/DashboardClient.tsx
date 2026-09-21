"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, Laptop, MessageSquare, PlugZap, RefreshCw, Trophy, Zap } from "lucide-react";
import {
  formatDuration,
  PROVIDER_COLORS,
  PROVIDER_LABELS,
  SOURCE_COLORS,
  SOURCE_LABELS,
} from "@/lib/format";
import type { Stats } from "@/lib/stats";

const RANGES = [
  { value: "1d", label: "24h" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
];

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Clock;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        <Icon className="h-4 w-4" />
        <p className="text-sm">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
      <h2 className="mb-4 text-sm font-medium text-zinc-300">{title}</h2>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-500/10 text-orange-400">
        <PlugZap className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-300">Aucune donnée pour l&apos;instant</p>
        <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">
          Installe l&apos;extension navigateur ou l&apos;agent desktop et connecte-les avec ton
          token API pour voir apparaître tes statistiques ici.
        </p>
      </div>
      <Link
        href="/settings"
        className="mt-1 rounded-lg bg-orange-500/10 px-3 py-1.5 text-sm font-medium text-orange-400 transition hover:bg-orange-500/20"
      >
        Récupérer mon token API →
      </Link>
    </div>
  );
}

const AUTO_REFRESH_MS = 30_000;

export default function DashboardClient({ initialStats }: { initialStats: Stats }) {
  const [range, setRange] = useState(initialStats.range);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    let cancelled = false;

    async function fetchStats(showSpinner: boolean) {
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch(`/api/stats?range=${range}`);
        const data = await res.json();
        if (!cancelled) {
          setStats(data);
          setLastUpdated(new Date());
        }
      } finally {
        if (showSpinner) setLoading(false);
      }
    }

    fetchStats(range !== initialStats.range);
    const interval = setInterval(() => fetchStats(false), AUTO_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const providerChartData = useMemo(
    () =>
      stats.byProvider
        .map((p) => ({
          name: PROVIDER_LABELS[p.provider] ?? p.provider,
          provider: p.provider,
          heures: Math.round((p.durationSeconds / 3600) * 10) / 10,
          messages: p.messageCount,
        }))
        .sort((a, b) => b.heures - a.heures),
    [stats.byProvider]
  );

  const dailyChartData = useMemo(() => {
    const days = new Map<string, Record<string, number | string>>();
    for (const d of stats.daily) {
      const key = new Date(d.day).toISOString().slice(0, 10);
      if (!days.has(key)) days.set(key, { day: key });
      const row = days.get(key)!;
      row[d.provider] = Math.round((d.durationSeconds / 3600) * 10) / 10;
    }
    return Array.from(days.values()).sort((a, b) =>
      String(a.day).localeCompare(String(b.day))
    );
  }, [stats.daily]);

  const activeProviders = useMemo(
    () => Array.from(new Set(stats.daily.map((d) => d.provider))),
    [stats.daily]
  );

  const hasData = stats.totals.events > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Tableau de bord</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {stats.isAdmin
              ? "Vue d'ensemble de l'usage IA de ton équipe"
              : "Ton usage personnel des IA"}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                range === r.value
                  ? "bg-orange-600 text-white"
                  : "text-[var(--text-muted)] hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 text-xs text-[var(--text-muted)]">
        <span>
          Actualisé à{" "}
          {lastUpdated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}{" "}
          · auto toutes les 30s
        </span>
        <button
          onClick={() => {
            setLoading(true);
            fetch(`/api/stats?range=${range}`)
              .then((r) => r.json())
              .then((data) => {
                setStats(data);
                setLastUpdated(new Date());
              })
              .finally(() => setLoading(false));
          }}
          title="Actualiser maintenant"
          className="rounded p-1 transition hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className={loading ? "opacity-50 transition-opacity" : "transition-opacity"}>
        {!hasData ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
            <EmptyState />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile
                icon={Clock}
                label="Temps total"
                value={formatDuration(stats.totals.durationSeconds)}
              />
              <StatTile
                icon={MessageSquare}
                label="Messages envoyés"
                value={stats.totals.messageCount.toLocaleString("fr-FR")}
              />
              <StatTile
                icon={Zap}
                label="Sessions / événements"
                value={stats.totals.events.toLocaleString("fr-FR")}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Temps par IA (heures)">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={providerChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#232327" vertical={false} />
                    <XAxis dataKey="name" stroke="#8b8b93" fontSize={12} />
                    <YAxis stroke="#8b8b93" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "#131316",
                        border: "1px solid #232327",
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Bar dataKey="heures" radius={[4, 4, 0, 0]}>
                      {providerChartData.map((entry) => (
                        <Cell key={entry.provider} fill={PROVIDER_COLORS[entry.provider]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Évolution quotidienne (heures)">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#232327" vertical={false} />
                    <XAxis dataKey="day" stroke="#8b8b93" fontSize={12} />
                    <YAxis stroke="#8b8b93" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "#131316",
                        border: "1px solid #232327",
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Legend />
                    {activeProviders.map((p) => (
                      <Line
                        key={p}
                        type="monotone"
                        dataKey={p}
                        name={PROVIDER_LABELS[p] ?? p}
                        stroke={PROVIDER_COLORS[p] ?? "#888"}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {stats.bySource.length > 0 && (
              <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Laptop className="h-4 w-4 text-orange-400" />
                  Web vs. PC — où se passe l&apos;usage IA ?
                </h2>
                {(() => {
                  const total = stats.bySource.reduce((s, x) => s + x.durationSeconds, 0) || 1;
                  return (
                    <>
                      <div className="flex h-3 w-full overflow-hidden rounded-full bg-black/30">
                        {stats.bySource.map((s) => (
                          <div
                            key={s.source}
                            style={{
                              width: `${(s.durationSeconds / total) * 100}%`,
                              backgroundColor: SOURCE_COLORS[s.source] ?? "#888",
                            }}
                          />
                        ))}
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {stats.bySource.map((s) => (
                          <div key={s.source} className="flex items-center gap-3">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: SOURCE_COLORS[s.source] ?? "#888" }}
                            />
                            <div>
                              <p className="text-sm text-white">
                                {SOURCE_LABELS[s.source] ?? s.source}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">
                                {formatDuration(s.durationSeconds)} ·{" "}
                                {((s.durationSeconds / total) * 100).toFixed(0)}% ·{" "}
                                {s.messageCount.toLocaleString("fr-FR")} messages
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {stats.isAdmin && (
              <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Trophy className="h-4 w-4 text-orange-400" />
                  Comparaison par utilisateur
                </h2>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                      <th className="pb-2 font-normal">Utilisateur</th>
                      <th className="pb-2 font-normal">Temps</th>
                      <th className="pb-2 font-normal">Messages</th>
                      <th className="pb-2 font-normal">Événements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byUser.map((u, i) => (
                      <tr
                        key={u.userId}
                        className="border-b border-[var(--border)]/60 text-white last:border-0"
                      >
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            {i === 0 && u.durationSeconds > 0 && (
                              <Trophy className="h-3.5 w-3.5 text-orange-400" />
                            )}
                            <div>
                              <div>{u.name}</div>
                              <div className="text-xs text-[var(--text-muted)]">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5">{formatDuration(u.durationSeconds)}</td>
                        <td className="py-2.5">{u.messageCount.toLocaleString("fr-FR")}</td>
                        <td className="py-2.5">{u.events.toLocaleString("fr-FR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
