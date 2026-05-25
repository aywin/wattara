"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Activity, AlertTriangle, CheckCircle2, Clock, MapPin, RadioTower, type LucideIcon } from "lucide-react";
import ReportForm from "@/components/reports/ReportsForm";
import ReportCard from "@/components/reports/ReportsCard";
import { API_URL } from "@/lib/api";

const WattaraMap = dynamic(() => import("@/components/map/WattaraMap"), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="h-[420px] animate-pulse rounded-lg bg-gray-100" />
    </div>
  ),
});

type EventType = "outage" | "restored" | "low_voltage" | "flickering" | "still_out";

interface Zone {
  id: string;
  name: string;
  sector_number?: string;
}

interface Report {
  id: string;
  title: string;
  description?: string;
  event_type?: EventType;
  status: "open" | "in_progress" | "resolved";
  zone?: Zone;
  user?: {
    id: string;
    username: string;
    email: string;
  };
  created_at: string;
  confirmation_count: number;
}

interface Outage {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  zones?: Zone[];
  source?: string;
}

export default function Dashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [outages, setOutages] = useState<Outage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [outagesError, setOutagesError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setReportsError(null);
      setOutagesError(null);

      const [reportsResult, outagesResult] = await Promise.allSettled([
        fetch(`${API_URL}/reports/?recent_hours=168&limit=30`),
        fetch(`${API_URL}/outages/?active_only=true`),
      ]);

      if (reportsResult.status === "fulfilled" && reportsResult.value.ok) {
        const data = await reportsResult.value.json().catch(() => []);
        setReports(Array.isArray(data) ? data : []);
      } else {
        setReportsError("Impossible de charger les signalements");
      }

      if (outagesResult.status === "fulfilled" && outagesResult.value.ok) {
        const data = await outagesResult.value.json().catch(() => []);
        setOutages(Array.isArray(data) ? data : []);
      } else {
        setOutagesError("Impossible de charger les coupures officielles");
      }

      setLoading(false);
    }

    loadDashboard();
  }, []);

  const insights = useMemo(() => {
    const now = Date.now();
    const last24h = reports.filter((report) => now - new Date(report.created_at).getTime() <= 24 * 60 * 60 * 1000);
    const activeUserSignals = reports.filter((report) =>
      ["outage", "low_voltage", "flickering", "still_out"].includes(report.event_type ?? "outage")
    );
    const restored = reports.filter((report) => report.event_type === "restored");

    const zones = activeUserSignals.reduce<Record<string, { zone: Zone; count: number; confirmations: number }>>((acc, report) => {
      if (!report.zone) return acc;
      const existing = acc[report.zone.id] ?? { zone: report.zone, count: 0, confirmations: 0 };
      existing.count += 1;
      existing.confirmations += report.confirmation_count ?? 0;
      acc[report.zone.id] = existing;
      return acc;
    }, {});

    const hotZones = Object.values(zones)
      .sort((a, b) => b.count + b.confirmations - (a.count + a.confirmations))
      .slice(0, 4);

    return {
      last24hCount: last24h.length,
      activeSignalsCount: activeUserSignals.length,
      restoredCount: restored.length,
      hotZones,
    };
  }, [reports]);

  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Wattara</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-950">Situation électrique locale</h1>
            <p className="mt-2 max-w-2xl text-gray-600">
              Suivez les coupures, les retours de courant et les zones instables à partir des signalements citoyens et des annonces officielles.
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Mise à jour avec les signalements des 7 derniers jours
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={AlertTriangle} label="Signaux actifs" value={insights.activeSignalsCount} tone="red" />
        <MetricCard icon={Clock} label="Signalements 24h" value={insights.last24hCount} tone="blue" />
        <MetricCard icon={RadioTower} label="Coupures officielles" value={outagesError ? 0 : outages.length} tone="amber" />
        <MetricCard icon={CheckCircle2} label="Retours signalés" value={insights.restoredCount} tone="green" />
      </div>

      <ReportForm />

      <WattaraMap />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="text-primary" size={20} />
            <h2 className="text-xl font-bold text-gray-900">Zones à surveiller</h2>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Chargement...</p>
          ) : insights.hotZones.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune zone instable détectée pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {insights.hotZones.map(({ zone, count, confirmations }) => (
                <div key={zone.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 text-gray-500" size={17} />
                      <div>
                        <p className="font-semibold text-gray-900">
                          {zone.name} {zone.sector_number ? `(Secteur ${zone.sector_number})` : ""}
                        </p>
                        <p className="text-sm text-gray-600">{count} signalement{count > 1 ? "s" : ""} actif{count > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-gray-700">
                      {confirmations} confirmation{confirmations > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-900">Fil citoyen récent</h2>
            <a href="/reports" className="text-sm font-semibold text-primary hover:underline">Tout voir</a>
          </div>

          {reportsError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{reportsError}</p>
          ) : loading ? (
            <p className="text-sm text-gray-500">Chargement...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun signalement récent.</p>
          ) : (
            <div className="space-y-3">
              {reports.slice(0, 5).map((report) => (
                <ReportCard
                  key={report.id}
                  id={report.id}
                  title={report.title}
                  description={report.description}
                  event_type={report.event_type}
                  status={report.status}
                  zone={report.zone}
                  user={report.user}
                  created_at={report.created_at}
                  confirmation_count={report.confirmation_count}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: "red" | "blue" | "amber" | "green";
}) {
  const tones = {
    red: "bg-red-50 text-red-700 border-red-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className={`mb-4 inline-flex rounded-lg border p-2 ${tones[tone]}`}>
        <Icon size={20} />
      </div>
      <p className="text-3xl font-bold text-gray-950">{value}</p>
      <p className="mt-1 text-sm font-medium text-gray-600">{label}</p>
    </div>
  );
}
