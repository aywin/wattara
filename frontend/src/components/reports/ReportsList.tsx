"use client";

import ReportCard from "./ReportsCard";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { API_URL } from "@/lib/api";

interface User {
  id: string;
  username: string;
  email: string;
}

interface Zone {
  id: string;
  name: string;
  sector_number?: string;
}

interface Report {
  id: string;
  title: string;
  description?: string;
  event_type?: "outage" | "restored" | "low_voltage" | "flickering" | "still_out";
  status: "open" | "in_progress" | "resolved";
  zone?: Zone;
  user?: User;
  created_at: string;
  confirmation_count: number;
}

export default function ReportsList() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReports() {
      try {
        setLoading(true);
        setError(null);

        // Fetch avec recent_hours=168 (7 jours) pour avoir les récents
        const res = await fetch(`${API_URL}/reports/?recent_hours=168&limit=50`);

        if (!res.ok) {
          throw new Error(`Erreur ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        // Vérifier si data est un array
        if (!Array.isArray(data)) {
          throw new Error("Format de réponse invalide");
        }

        setReports(data);
      } catch (err) {
        console.error("Erreur fetch reports:", err);
        setError(err instanceof Error ? err.message : "Erreur de chargement");
        setReports([]);
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, []);

  // État de chargement
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-gray-400" size={32} />
        <span className="ml-3 text-gray-600">Chargement des signalements...</span>
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

  // Aucun signalement
  if (reports.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Aucun signalement récent.</p>
        <p className="text-sm text-gray-500 mt-2">
          Les signalements apparaîtront ici dès qu&apos;ils seront créés.
        </p>
      </div>
    );
  }

  // Affichage des reports
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          {reports.length} signalement{reports.length > 1 ? "s" : ""} trouvé{reports.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid gap-4">
        {reports.map((report) => (
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
    </div>
  );
}
