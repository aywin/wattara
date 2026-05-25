"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, MapPin, Users, Zap } from "lucide-react";
import { API_URL, fetchAuthAPI, getAuthToken } from "@/lib/api";

interface Region {
  id: string;
  name: string;
}

interface Zone {
  id: string;
  name: string;
  sector_number?: string;
  region?: Region;
}

interface OutageCardProps {
  id: string;
  title: string;
  description?: string;
  zones?: Zone[];
  startTime: string;
  endTime?: string;
  source?: string;
  confirmation_count?: number;
}

interface Confirmation {
  id: string;
  user_id: string;
  outage_id?: string;
}

export default function OutageCard({
  id,
  title,
  description,
  zones = [],
  startTime,
  endTime,
  source,
  confirmation_count = 0,
}: OutageCardProps) {
  const [confirmations, setConfirmations] = useState<number>(confirmation_count);
  const [userConfirmed, setUserConfirmed] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const isOngoing = !endTime || new Date(endTime) > new Date();

  useEffect(() => {
    setCurrentUserId(localStorage.getItem("userId"));
  }, []);

  useEffect(() => {
    async function fetchConfirmations() {
      try {
        const res = await fetch(`${API_URL}/confirmations/outage/${id}`);
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
          body: JSON.stringify({ report_id: null, outage_id: id }),
        });
        setConfirmations((prev) => prev + 1);
        setUserConfirmed(true);
      } else {
        const confirmListRes = await fetch(`${API_URL}/confirmations/outage/${id}`);
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

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Zap size={16} className="shrink-0 text-primary" />
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          {source && (
            <p className="text-xs text-gray-500">Source : {source}</p>
          )}
        </div>
        <span
          className={`shrink-0 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
            isOngoing
              ? "border border-yellow-300 bg-yellow-100 text-yellow-700"
              : "border border-green-300 bg-green-100 text-green-700"
          }`}
        >
          {isOngoing ? (
            <><AlertTriangle size={13} /> En cours</>
          ) : (
            <><CheckCircle size={13} /> Terminée</>
          )}
        </span>
      </div>

      {description && (
        <p className="mb-3 text-sm leading-relaxed text-gray-600">{description}</p>
      )}

      {zones.length > 0 && (
        <div className="mb-3 flex items-start gap-2">
          <MapPin size={14} className="mt-0.5 shrink-0 text-gray-400" />
          <div>
            <p className="mb-1 text-xs font-medium text-gray-700">Zones affectées :</p>
            <div className="flex flex-wrap gap-1">
              {zones.map((zone) => (
                <span
                  key={zone.id}
                  className="inline-block rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700"
                >
                  {zone.name}
                  {zone.sector_number && ` (S${zone.sector_number})`}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-1 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-gray-400" />
          <span>Début : {new Date(startTime).toLocaleString("fr-FR")}</span>
        </div>
        {endTime && (
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-gray-400" />
            <span>Fin : {new Date(endTime).toLocaleString("fr-FR")}</span>
          </div>
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
