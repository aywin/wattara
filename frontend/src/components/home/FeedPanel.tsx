"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  Loader2,
  MapPin,
  Power,
  RotateCcw,
  ThumbsUp,
  Users,
  Zap,
} from "lucide-react";
import { API_URL, fetchAuthAPI, getAuthToken } from "@/lib/api";
import { timeAgo } from "@/lib/utils";

type EventType = "outage" | "restored" | "low_voltage" | "flickering" | "still_out";

const EVENT_CONFIG: Record<EventType, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  outage:      { label: "Coupé",          Icon: Zap,       color: "text-red-600",     bg: "bg-red-50" },
  restored:    { label: "Revenu",         Icon: Power,     color: "text-emerald-600", bg: "bg-emerald-50" },
  low_voltage: { label: "Faible tension", Icon: Activity,  color: "text-amber-600",   bg: "bg-amber-50" },
  flickering:  { label: "Clignotant",     Icon: Activity,  color: "text-orange-600",  bg: "bg-orange-50" },
  still_out:   { label: "Toujours coupé", Icon: RotateCcw, color: "text-slate-600",   bg: "bg-slate-50" },
};

interface Report {
  id: string;
  title: string;
  description?: string;
  event_type: EventType;
  status: string;
  created_at: string;
  confirmation_count: number;
  zone?: { id: string; name: string; sector_number?: string };
  user?: { id: string; username: string };
}

function FeedItem({
  report,
  isLoggedIn,
  currentUserId,
}: {
  report: Report;
  isLoggedIn: boolean;
  currentUserId: string | null;
}) {
  const [count, setCount] = useState(report.confirmation_count);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const cfg = EVENT_CONFIG[report.event_type] ?? EVENT_CONFIG.outage;
  const Icon = cfg.Icon;

  const handleConfirm = async () => {
    if (!isLoggedIn || busy) return;
    setBusy(true);
    try {
      await fetchAuthAPI("/confirmations/", {
        method: "POST",
        body: JSON.stringify({ report_id: report.id, outage_id: null }),
      });
      setCount((c) => c + 1);
      setConfirmed(true);
    } catch {
      // silencieux
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-3 border-b border-gray-100 px-4 py-4 transition hover:bg-gray-50">
      {/* Icône événement */}
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
        <Icon size={18} className={cfg.color} />
      </div>

      {/* Contenu */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="font-semibold text-gray-900">
              {report.zone?.name ?? "Zone non précisée"}
              {report.zone?.sector_number ? ` · S${report.zone.sector_number}` : ""}
            </span>
            <span className="ml-2 text-xs text-gray-400">{timeAgo(report.created_at)}</span>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}
          >
            {cfg.label}
          </span>
        </div>

        {report.description && (
          <p className="mt-0.5 truncate text-sm text-gray-500">{report.description}</p>
        )}

        <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
          {report.user && (
            <span className="flex items-center gap-1">
              <span className="font-medium text-gray-600">@{report.user.username}</span>
            </span>
          )}

          <div className="flex items-center gap-1">
            <Users size={12} />
            <span>{count}</span>
          </div>

          {isLoggedIn ? (
            confirmed ? (
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 size={12} /> Confirmé
              </span>
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={busy}
                className="flex items-center gap-1 text-primary transition hover:text-blue-700 disabled:opacity-50"
              >
                <ThumbsUp size={12} />
                Confirmer
              </button>
            )
          ) : (
            <span className="text-gray-300">Connectez-vous pour confirmer</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FeedPanel({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUserId(localStorage.getItem("userId"));
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/reports/?recent_hours=168&limit=40`);
        const data = await res.json().catch(() => []);
        setReports(Array.isArray(data) ? data : []);
      } catch {
        setReports([]);
      } finally {
        setLoading(false);
      }
    }
    load();
    // Rafraîchit toutes les 30 secondes
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* En-tête du panel */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <p className="font-semibold text-gray-900">Fil citoyen</p>
          <p className="text-xs text-gray-400">7 derniers jours · rafraîchi toutes les 30s</p>
        </div>
        <Link
          href="/reports"
          className="text-xs font-semibold text-primary transition hover:underline"
        >
          Tout voir →
        </Link>
      </div>

      {/* CTA si non connecté */}
      {!isLoggedIn && (
        <div className="border-b border-secondary/30 bg-secondary/10 px-4 py-3">
          <p className="text-sm font-medium text-gray-800">
            Rejoignez la communauté pour signaler des situations
          </p>
          <div className="mt-2 flex gap-2">
            <Link
              href="/auth/signup"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              S&apos;inscrire gratuitement
            </Link>
            <Link
              href="/auth/login"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Se connecter
            </Link>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="mr-2 animate-spin" size={20} />
            <span className="text-sm">Chargement…</span>
          </div>
        ) : reports.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <MapPin size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">Aucun signalement récent.</p>
          </div>
        ) : (
          reports.map((r) => (
            <FeedItem
              key={r.id}
              report={r}
              isLoggedIn={isLoggedIn}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>
    </div>
  );
}
