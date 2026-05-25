"use client";

import OutageCard from "./OutageCard";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { API_URL } from "@/lib/api";

interface Region {
  id: string;
  name: string;
}

interface Zone {
  id: string;
  name: string;
  sector_number?: string;
  region?: Region;
  color_code?: string;
}

interface Outage {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  source?: string;
  zones: Zone[];
  confirmation_count: number;
}

export default function OutagesList() {
  const [outages, setOutages] = useState<Outage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "ended">("active");

  useEffect(() => {
    async function fetchOutages() {
      try {
        setLoading(true);
        setError(null);

        // Fetch avec active_only pour les coupures en cours
        const activeParam = filter === "active" ? "?active_only=true" : "";
        const res = await fetch(`${API_URL}/outages/${activeParam}`);

        if (!res.ok) {
          throw new Error(`Erreur ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        if (!Array.isArray(data)) {
          throw new Error("Format de réponse invalide");
        }

        // Filtrer côté client si besoin
        let filteredData = data;
        if (filter === "ended") {
          filteredData = data.filter((o: Outage) =>
            o.end_time && new Date(o.end_time) < new Date()
          );
        }

        setOutages(filteredData);
      } catch (err) {
        console.error("Erreur fetch outages:", err);
        setError(err instanceof Error ? err.message : "Erreur de chargement");
        setOutages([]);
      } finally {
        setLoading(false);
      }
    }

    fetchOutages();
  }, [filter]);

  // État de chargement
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-gray-400" size={32} />
        <span className="ml-3 text-gray-600">Chargement des coupures...</span>
      </div>
    );
  }

  // État d'erreur
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">Erreur de chargement</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === "all"
            ? "bg-blue-100 text-blue-700 border border-blue-300"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
        >
          Toutes
        </button>
        <button
          onClick={() => setFilter("active")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === "active"
            ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
        >
          En cours
        </button>
        <button
          onClick={() => setFilter("ended")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === "ended"
            ? "bg-green-100 text-green-700 border border-green-300"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
        >
          Terminées
        </button>
      </div>

      {/* Compteur */}
      {outages.length > 0 && (
        <p className="text-sm text-gray-600">
          {outages.length} coupure{outages.length > 1 ? "s" : ""} {
            filter === "active" ? "en cours" :
              filter === "ended" ? "terminée" + (outages.length > 1 ? "s" : "") :
                "trouvée" + (outages.length > 1 ? "s" : "")
          }
        </p>
      )}

      {/* Liste des coupures */}
      {outages.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">Aucune coupure {
            filter === "active" ? "en cours" :
              filter === "ended" ? "terminée" :
                "disponible"
          }.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {outages.map((outage) => (
            <OutageCard
              key={outage.id}
              id={outage.id}
              title={outage.title}
              description={outage.description}
              zones={outage.zones}
              startTime={outage.start_time}
              endTime={outage.end_time}
              source={outage.source}
              confirmation_count={outage.confirmation_count}
            />
          ))}
        </div>
      )}
    </div>
  );
}
