"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Clock, LocateFixed, Power, RotateCcw, Send, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { fetchAuthAPI, fetchZones, getAuthToken, type Zone } from "@/lib/api";

type EventType = "outage" | "restored" | "low_voltage" | "flickering" | "still_out";

const actionOptions: {
  type: EventType;
  label: string;
  hint: string;
  title: string;
  Icon: LucideIcon;
  className: string;
}[] = [
  {
    type: "outage",
    label: "Coupé",
    hint: "Plus de courant",
    title: "Coupure signalée",
    Icon: Zap,
    className: "border-red-200 bg-red-50 text-red-800 data-[active=true]:border-red-500 data-[active=true]:bg-red-100",
  },
  {
    type: "restored",
    label: "Revenu",
    hint: "Le courant est revenu",
    title: "Courant revenu",
    Icon: Power,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800 data-[active=true]:border-emerald-500 data-[active=true]:bg-emerald-100",
  },
  {
    type: "low_voltage",
    label: "Faible tension",
    hint: "Courant instable",
    title: "Faible tension signalée",
    Icon: Activity,
    className: "border-amber-200 bg-amber-50 text-amber-800 data-[active=true]:border-amber-500 data-[active=true]:bg-amber-100",
  },
  {
    type: "still_out",
    label: "Toujours coupé",
    hint: "La coupure continue",
    title: "Coupure toujours en cours",
    Icon: RotateCcw,
    className: "border-slate-200 bg-slate-50 text-slate-800 data-[active=true]:border-slate-500 data-[active=true]:bg-slate-100",
  },
];

export default function ReportForm() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [selectedAction, setSelectedAction] = useState<EventType>("outage");
  const [description, setDescription] = useState("");
  const [since, setSince] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);

  const currentAction = useMemo(
    () => actionOptions.find((action) => action.type === selectedAction) ?? actionOptions[0],
    [selectedAction]
  );

  useEffect(() => {
    setIsLoggedIn(Boolean(localStorage.getItem("authToken")));
    fetchZones().then(setZones);
  }, []);

  const useLocation = () => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (location) => {
        setPosition({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      },
      () => alert("Impossible de récupérer votre position.")
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!getAuthToken()) {
      setMessage({ type: "error", text: "Vous devez être connecté pour signaler une situation." });
      return;
    }

    setLoading(true);
    setMessage(null);

    const details = [
      since ? `Depuis: ${since}` : null,
      description.trim() || null,
    ].filter(Boolean).join("\n");

    try {
      await fetchAuthAPI("/reports/", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          title: currentAction.title,
          description: details || null,
          event_type: selectedAction,
          zone_id: zoneId || null,
          latitude: position?.latitude ?? null,
          longitude: position?.longitude ?? null,
          outage_id: null,
        }),
      });

      setDescription("");
      setSince("");
      setZoneId("");
      setPosition(null);
      setMessage({ type: "success", text: "Signalement envoyé." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Erreur de connexion au serveur" });
    } finally {
      setLoading(false);
    }
  };

  if (isLoggedIn === false) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Action rapide</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-900">Que se passe-t-il dans votre zone ?</h2>
        <p className="mt-3 text-gray-500">Connectez-vous pour signaler une situation dans votre quartier.</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/auth/login"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Se connecter
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Créer un compte
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Action rapide</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-900">Que se passe-t-il dans votre zone ?</h2>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actionOptions.map(({ type, label, hint, Icon, className }) => (
          <button
            key={type}
            type="button"
            data-active={selectedAction === type}
            onClick={() => setSelectedAction(type)}
            className={`flex min-h-24 items-start gap-3 rounded-lg border p-4 text-left transition ${className}`}
          >
            <Icon size={22} />
            <span>
              <span className="block font-semibold">{label}</span>
              <span className="mt-1 block text-sm opacity-80">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Zone concernée</label>
          <select
            title="Zone concernée"
            className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-primary focus:outline-none"
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
          >
            <option value="">Sélectionnez une zone</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name} {zone.sector_number ? `(Secteur ${zone.sector_number})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Depuis quand ?</label>
          <div className="relative">
            <Clock className="absolute left-3 top-3 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Ex: 20 min, 2h, ce matin"
              className="w-full rounded-lg border border-gray-300 p-2.5 pl-9 text-gray-900 focus:border-primary focus:outline-none"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Commentaire optionnel</label>
        <textarea
          placeholder="Ajoutez un détail utile : rues touchées, courant qui revient puis repart, appareils affectés..."
          className="min-h-24 w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:border-primary focus:outline-none"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={useLocation}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <LocateFixed size={16} />
          {position ? "Position ajoutée" : "Ajouter ma position"}
        </button>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send size={16} />
          {loading ? "Envoi..." : `Envoyer: ${currentAction.label}`}
        </button>
      </div>
    </form>
  );
}
