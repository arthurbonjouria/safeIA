"use client";

import { useEffect, useMemo, useState } from "react";
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
import { formatDuration, PROVIDER_COLORS, PROVIDER_LABELS } from "@/lib/format";
import type { Stats } from "@/lib/stats";

const RANGES = [
  { value: "1d", label: "24h" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
];

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <p className="text-sm text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export default function DashboardClient({ initialStats }: { initialStats: Stats }) {
  const [range, setRange] = useState(initialStats.range);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (range === initialStats.range) return;
    setLoading(true);
    fetch(`/api/stats?range=${range}`)
      .then((r) => r.json())
      .then((data) => setStats(data))
      .finally(() => setLoading(false));
  }, [range, initialStats.range]);

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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Tableau de bord</h1>
        <div className="flex gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                range === r.value
                  ? "bg-orange-600 text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className={loading ? "opacity-50 transition-opacity" : "transition-opacity"}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Temps total" value={formatDuration(stats.totals.durationSeconds)} />
          <StatTile label="Messages envoyés" value={stats.totals.messageCount.toLocaleString("fr-FR")} />
          <StatTile label="Sessions / événements" value={stats.totals.events.toLocaleString("fr-FR")} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="mb-4 text-sm font-medium text-neutral-300">Temps par IA (heures)</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={providerChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="name" stroke="#737373" fontSize={12} />
                <YAxis stroke="#737373" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#171717", border: "1px solid #262626", borderRadius: 8 }}
                  labelStyle={{ color: "#fff" }}
                />
                <Bar dataKey="heures" radius={[4, 4, 0, 0]}>
                  {providerChartData.map((entry) => (
                    <Cell key={entry.provider} fill={PROVIDER_COLORS[entry.provider]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="mb-4 text-sm font-medium text-neutral-300">Évolution quotidienne (heures)</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="day" stroke="#737373" fontSize={12} />
                <YAxis stroke="#737373" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#171717", border: "1px solid #262626", borderRadius: 8 }}
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
          </div>
        </div>

        {stats.isAdmin && (
          <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="mb-4 text-sm font-medium text-neutral-300">Comparaison par utilisateur</h2>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400">
                  <th className="pb-2 font-normal">Utilisateur</th>
                  <th className="pb-2 font-normal">Temps</th>
                  <th className="pb-2 font-normal">Messages</th>
                  <th className="pb-2 font-normal">Événements</th>
                </tr>
              </thead>
              <tbody>
                {stats.byUser.map((u) => (
                  <tr key={u.userId} className="border-b border-neutral-900 text-white">
                    <td className="py-2">
                      <div>{u.name}</div>
                      <div className="text-xs text-neutral-500">{u.email}</div>
                    </td>
                    <td className="py-2">{formatDuration(u.durationSeconds)}</td>
                    <td className="py-2">{u.messageCount.toLocaleString("fr-FR")}</td>
                    <td className="py-2">{u.events.toLocaleString("fr-FR")}</td>
                  </tr>
                ))}
                {stats.byUser.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-neutral-500">
                      Aucune donnée sur cette période.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
