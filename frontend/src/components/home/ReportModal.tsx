"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Power, RotateCcw, X, Zap } from "lucide-react";
import { fetchAuthAPI, fetchZones, type Zone } from "@/lib/api";

type EventType = "outage" | "restored" | "low_voltage" | "still_out";

const EVENT_OPTIONS: {
  type: EventType;
  label: string;
  hint: string;
  Icon: React.ElementType;
  active: string;
  base: string;
}[] = [
  {
    type: "outage",
    label: "Coupure",
    hint: "Plus de courant",
    Icon: Zap,
    base: "border-red-100 bg-red-50 text-red-700",
    active: "border-red-500 bg-red-100 ring-2 ring-red-400",
  },
  {
    type: "restored",
    label: "Courant revenu",
    hint: "Ça remarche",
    Icon: Power,
    base: "border-emerald-100 bg-emerald-50 text-emerald-700",
    active: "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-400",
  },
  {
    type: "low_voltage",
    label: "Instable",
    hint: "Tension faible",
    Icon: Activity,
    base: "border-amber-100 bg-amber-50 text-amber-700",
    active: "border-amber-500 bg-amber-100 ring-2 ring-amber-400",
  },
  {
    type: "still_out",
    label: "Toujours coupé",
    hint: "Ça dure",
    Icon: RotateCcw,
    base: "border-slate-100 bg-slate-50 text-slate-700",
    active: "border-slate-500 bg-slate-100 ring-2 ring-slate-400",
  },
];

const TITLE_MAP: Record<EventType, string> = {
  outage: "Coupure signalée",
  restored: "Courant revenu",
  low_voltage: "Faible tension signalée",
  still_out: "Coupure toujours en cours",
};

export default function ReportModal({ onClose }: { onClose: () => void }) {
  const [eventType, setEventType] = useState<EventType>("outage");
  const [zoneId, setZoneId] = useState("");
  const [description, setDescription] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchZones().then(setZones);
  }, []);

  const selectedOption = useMemo(
    () => EVENT_OPTIONS.find((o) => o.type === eventType)!,
    [eventType]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await fetchAuthAPI("/reports/", {
        method: "POST",
        body: JSON.stringify({
          title: TITLE_MAP[eventType],
          description: description.trim() || null,
          event_type: eventType,
          zone_id: zoneId || null,
          latitude: null,
          longitude: null,
          outage_id: null,
        }),
      });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl">
        {/* En-tête */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Signalement rapide
            </p>
            <h2 className="mt-0.5 text-xl font-bold text-gray-900">
              Que se passe-t-il ?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Power size={28} />
            </div>
            <p className="font-semibold text-gray-900">Signalement envoyé !</p>
            <p className="text-sm text-gray-500">Merci pour votre contribution.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Choix de l'événement */}
            <div className="mb-5 grid grid-cols-2 gap-3">
              {EVENT_OPTIONS.map(({ type, label, hint, Icon, base, active }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEventType(type)}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                    eventType === type ? active : base
                  }`}
                >
                  <Icon size={20} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="block font-semibold leading-tight">{label}</span>
                    <span className="mt-0.5 block text-xs opacity-70">{hint}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* Zone */}
            <div className="mb-4">
              <label htmlFor="modal-zone" className="mb-1.5 block text-sm font-medium text-gray-700">
                Zone concernée
              </label>
              <select
                id="modal-zone"
                title="Zone concernée"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Sélectionner une zone…</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                    {z.sector_number ? ` — Secteur ${z.sector_number}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="mb-5">
              <label htmlFor="modal-desc" className="mb-1.5 block text-sm font-medium text-gray-700">
                Détails <span className="text-gray-400">(optionnel)</span>
              </label>
              <textarea
                id="modal-desc"
                placeholder="Rues touchées, durée estimée, appareils affectés…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {error && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition ${
                selectedOption.base
              } border ${loading ? "cursor-not-allowed opacity-60" : "hover:opacity-90"}`}
            >
              <selectedOption.Icon size={18} />
              {loading ? "Envoi…" : `Signaler : ${selectedOption.label}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
