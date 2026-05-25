"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

interface Stats {
  activeOutages: number;
  reportsToday: number;
  zonesAffected: number;
}

function Dot({ pulse, color }: { pulse: boolean; color: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {pulse && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${color}`} />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

export default function LiveStatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [rep, out] = await Promise.allSettled([
          fetch(`${API_URL}/reports/?recent_hours=24&limit=100`),
          fetch(`${API_URL}/outages/?active_only=true`),
        ]);

        const reports =
          rep.status === "fulfilled" && rep.value.ok ? await rep.value.json() : [];
        const outages =
          out.status === "fulfilled" && out.value.ok ? await out.value.json() : [];

        const affectedZoneIds = new Set<string>();
        if (Array.isArray(outages)) {
          outages.forEach((o: { zones?: { id: string }[] }) =>
            o.zones?.forEach((z) => affectedZoneIds.add(z.id))
          );
        }

        setStats({
          activeOutages: Array.isArray(outages) ? outages.length : 0,
          reportsToday: Array.isArray(reports) ? reports.length : 0,
          zonesAffected: affectedZoneIds.size,
        });
      } catch {
        // silencieux
      }
    }
    load();
  }, []);

  return (
    <div className="bg-gray-950 text-white">
      <div className="flex items-center gap-5 overflow-x-auto px-4 py-2 text-xs">
        {stats === null ? (
          <span className="text-gray-500">Chargement des données…</span>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Dot pulse={stats.zonesAffected > 0} color={stats.zonesAffected > 0 ? "bg-red-500" : "bg-green-500"} />
              <span className="whitespace-nowrap text-gray-200">
                {stats.zonesAffected > 0
                  ? `${stats.zonesAffected} zone${stats.zonesAffected > 1 ? "s" : ""} affectée${stats.zonesAffected > 1 ? "s" : ""}`
                  : "Aucune zone affectée"}
              </span>
            </div>

            <div className="h-3 w-px bg-gray-700" />

            <div className="flex items-center gap-2">
              <Dot pulse={false} color="bg-blue-400" />
              <span className="whitespace-nowrap text-gray-200">
                {stats.reportsToday} signalement{stats.reportsToday > 1 ? "s" : ""} aujourd&apos;hui
              </span>
            </div>

            <div className="h-3 w-px bg-gray-700" />

            <div className="flex items-center gap-2">
              <Dot pulse={stats.activeOutages > 0} color={stats.activeOutages > 0 ? "bg-orange-500" : "bg-gray-600"} />
              <span className="whitespace-nowrap text-gray-200">
                {stats.activeOutages} coupure{stats.activeOutages > 1 ? "s" : ""} officielle{stats.activeOutages > 1 ? "s" : ""}
              </span>
            </div>

            <span className="ml-auto shrink-0 text-gray-600">● Temps réel</span>
          </>
        )}
      </div>
    </div>
  );
}
