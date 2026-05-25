"use client";

import { useEffect, useState } from "react";
import { fetchAuthAPI, fetchZones, getAuthToken, type Zone } from "@/lib/api";

export default function OutageForm() {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchZones().then(setZones);
  }, []);

  const handleZoneToggle = (zoneId: string) => {
    setZoneIds((prev) => (prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (zoneIds.length === 0) {
      setMessage({ type: "error", text: "Veuillez sélectionner au moins une zone affectée." });
      return;
    }

    if (!getAuthToken()) {
      setMessage({ type: "error", text: "Connexion admin requise pour publier une coupure officielle." });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await fetchAuthAPI("/outages/", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || null,
          start_time: new Date(startTime).toISOString(),
          end_time: endTime ? new Date(endTime).toISOString() : null,
          source: source || null,
          zone_ids: zoneIds,
        }),
      });

      setMessage({ type: "success", text: "Coupure officielle publiée avec succès." });
      setTitle("");
      setDescription("");
      setZoneIds([]);
      setStartTime("");
      setEndTime("");
      setSource("");
      setShowForm(false);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Erreur de connexion au serveur" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setShowForm(!showForm)}
        className="rounded bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
      >
        {showForm ? "Fermer le formulaire" : "Publier une coupure officielle"}
      </button>

      {message && (
        <div
          className={`mt-3 rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-xl border bg-white p-6 shadow-md">
          <h3 className="text-lg font-semibold text-gray-800">Nouvelle coupure officielle</h3>

          <div>
            <label htmlFor="outage-title" className="mb-1 block text-sm font-medium text-gray-700">
              Titre de la coupure *
            </label>
            <input
              id="outage-title"
              type="text"
              placeholder="Ex: Maintenance programmée Secteur 15"
              className="w-full rounded border p-2 focus:ring-2 focus:ring-blue-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={5}
            />
          </div>

          <div>
            <label htmlFor="outage-description" className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="outage-description"
              placeholder="Détails de la coupure, cause, etc."
              className="min-h-[80px] w-full rounded border p-2 focus:ring-2 focus:ring-blue-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Zones affectées *</p>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded border p-3">
              {zones.map((zone) => (
                <label key={zone.id} className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={zoneIds.includes(zone.id)}
                    onChange={() => handleZoneToggle(zone.id)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm">
                    {zone.name} {zone.sector_number ? `(Secteur ${zone.sector_number})` : ""}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">{zoneIds.length} zone(s) sélectionnée(s)</p>
          </div>

          <div>
            <label htmlFor="outage-start" className="mb-1 block text-sm font-medium text-gray-700">
              Date et heure de début *
            </label>
            <input
              id="outage-start"
              type="datetime-local"
              title="Date et heure de début"
              className="w-full rounded border p-2 focus:ring-2 focus:ring-blue-500"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="outage-end" className="mb-1 block text-sm font-medium text-gray-700">
              Date et heure de fin
            </label>
            <input
              id="outage-end"
              type="datetime-local"
              title="Date et heure de fin (optionnel)"
              className="w-full rounded border p-2 focus:ring-2 focus:ring-blue-500"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">Laissez vide si la durée est indéterminée</p>
          </div>

          <div>
            <label htmlFor="outage-source" className="mb-1 block text-sm font-medium text-gray-700">
              Source
            </label>
            <input
              id="outage-source"
              type="text"
              placeholder="Ex: SONABEL, Maintenance"
              className="w-full rounded border p-2 focus:ring-2 focus:ring-blue-500"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-blue-600 px-6 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Publication..." : "Publier la coupure"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded bg-gray-300 px-6 py-2 text-gray-700 transition hover:bg-gray-400"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
