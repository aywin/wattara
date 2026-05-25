"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin,
  Power,
  RotateCcw,
  Users,
  Zap,
} from "lucide-react";
import { API_URL, fetchAuthAPI, getAuthToken } from "@/lib/api";

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

interface ReportCardProps {
  id: string;
  title: string;
  description?: string;
  event_type?: "outage" | "restored" | "low_voltage" | "flickering" | "still_out";
  status: "open" | "in_progress" | "resolved";
  zone?: Zone;
  user?: User;
  created_at: string;
  confirmation_count?: number;
}

interface Confirmation {
  id: string;
  user_id: string;
  report_id?: string;
}

export default function ReportCard({
  id,
  title,
  description,
  event_type = "outage",
  status,
  zone,
  user,
  created_at,
  confirmation_count = 0,
}: ReportCardProps) {
  const [confirmations, setConfirmations] = useState<number>(confirmation_count);
  const [userConfirmed, setUserConfirmed] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUserId(localStorage.getItem("userId"));
  }, []);

  useEffect(() => {
    async function fetchConfirmations() {
      try {
        const res = await fetch(`${API_URL}/confirmations/report/${id}`);
        if (!res.ok) return;
        const data: Confirmation[] = await res.json();
        setConfirmations(data.length);
        setUserConfirmed(Boolean(currentUserId && data.some((item) => item.user_id === currentUserId)));
      } catch {
        // silencieux
      }
    }
    fetchConfirmations();
  }, [id, currentUserId]);

  const handleConfirm = async () => {
    const token = getAuthToken();
    if (!token || !currentUserId) {
      setMessage("Vous devez être connecté pour confirmer.");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      if (!userConfirmed) {
        await fetchAuthAPI("/confirmations/", {
          method: "POST",
          body: JSON.stringify({ report_id: id, outage_id: null }),
        });
        setConfirmations((prev) => prev + 1);
        setUserConfirmed(true);
      } else {
        const confirmListRes = await fetch(`${API_URL}/confirmations/report/${id}`);
        if (!confirmListRes.ok) throw new Error("Impossible de charger les confirmations");
        const confirmList: Confirmation[] = await confirmListRes.json();
        const userConfirmation = confirmList.find((item) => item.user_id === currentUserId);
        if (userConfirmation) {
          const delRes = await fetch(`${API_URL}/confirmations/${userConfirmation.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!delRes.ok) throw new Error("Impossible d'annuler la confirmation");
          setConfirmations((prev) => Math.max(prev - 1, 0));
          setUserConfirmed(false);
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    open: { badge: "bg-red-100 text-red-700 border-red-300", icon: AlertCircle, label: "Ouvert" },
    in_progress: { badge: "bg-yellow-100 text-yellow-700 border-yellow-300", icon: Clock, label: "En cours" },
    resolved: { badge: "bg-green-100 text-green-700 border-green-300", icon: CheckCircle, label: "Résolu" },
  };

  const eventConfig = {
    outage: { label: "Coupé", Icon: Zap, badge: "bg-red-50 text-red-700 border-red-200" },
    restored: { label: "Revenu", Icon: Power, badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    low_voltage: { label: "Faible tension", Icon: Activity, badge: "bg-amber-50 text-amber-700 border-amber-200" },
    flickering: { label: "Clignotant", Icon: Activity, badge: "bg-orange-50 text-orange-700 border-orange-200" },
    still_out: { label: "Toujours coupé", Icon: RotateCcw, badge: "bg-slate-50 text-slate-700 border-slate-200" },
  };

  const currentStatus = statusConfig[status];
  const StatusIcon = currentStatus.icon;
  const currentEvent = eventConfig[event_type];
  const EventIcon = currentEvent.Icon;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${currentEvent.badge}`}>
              <EventIcon size={14} />
              {currentEvent.label}
            </span>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <Clock size={12} />
            {new Date(created_at).toLocaleString("fr-FR")}
          </p>
        </div>
        <span className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${currentStatus.badge}`}>
          <StatusIcon size={14} />
          {currentStatus.label}
        </span>
      </div>

      {description && <p className="mb-3 line-clamp-2 text-sm text-gray-600">{description}</p>}

      <div className="mb-4 flex flex-col gap-2 text-sm text-gray-600">
        {zone && (
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-gray-400" />
            <span>
              {zone.name}
              {zone.sector_number && ` (Secteur ${zone.sector_number})`}
            </span>
          </div>
        )}
        {user && (
          <p className="text-xs text-gray-500">
            Signalé par <span className="font-medium">{user.username}</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading || !currentUserId}
          title={!currentUserId ? "Connectez-vous pour confirmer" : undefined}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            userConfirmed
              ? "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              : "border border-green-200 bg-green-50 text-green-600 hover:bg-green-100"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {userConfirmed ? "Annuler" : "Confirmer"}
        </button>

        <div className="flex items-center gap-2 text-gray-600">
          <Users size={18} />
          <span className="text-sm font-medium">{confirmations}</span>
        </div>
      </div>

      {message && <p className="mt-2 text-sm text-red-600">{message}</p>}
    </div>
  );
}
