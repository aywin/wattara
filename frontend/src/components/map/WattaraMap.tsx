"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LatLngExpression, LeafletMap, PathOptions } from "leaflet";
import { Loader2, MapPinned, Search, X } from "lucide-react";
import { API_URL } from "@/lib/api";

type GeoJSONGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

interface ZoneMapItem {
  id: string;
  name: string;
  sector_number?: string;
  geometry?: GeoJSONGeometry | string | null;
  color_code?: string | null;
  has_active_outage: boolean;
  active_outage_count: number;
  active_report_count: number;
}

const OUAGA_CENTER: LatLngExpression = [12.3714, -1.5197];

function parseGeometry(geometry: ZoneMapItem["geometry"]) {
  if (!geometry) return null;
  if (typeof geometry === "string") {
    try {
      return JSON.parse(geometry) as GeoJSONGeometry;
    } catch {
      return null;
    }
  }
  return geometry;
}

function getZoneStyle(zone: ZoneMapItem): PathOptions & { label: string } {
  if (zone.has_active_outage) {
    return { color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.40, weight: 2.5, label: "Coupure officielle" };
  }
  if (zone.active_report_count >= 3) {
    return { color: "#ea580c", fillColor: "#f97316", fillOpacity: 0.36, weight: 2, label: "Zone instable" };
  }
  if (zone.active_report_count > 0) {
    return { color: "#d97706", fillColor: "#facc15", fillOpacity: 0.32, weight: 2, label: "Signalements récents" };
  }
  return { color: "#2563eb", fillColor: zone.color_code || "#3b82f6", fillOpacity: 0.18, weight: 1.5, label: "Aucun signal récent" };
}

function getZoneCentroid(geo: GeoJSONGeometry): [number, number] | null {
  if (geo.type === "Point") {
    return [geo.coordinates[1], geo.coordinates[0]];
  }
  if (geo.type === "Polygon") {
    const ring = geo.coordinates[0];
    const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
    const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
    return [lat, lng];
  }
  if (geo.type === "MultiPolygon") {
    const flat = geo.coordinates.flat(2) as number[][];
    const lat = flat.reduce((s, c) => s + c[1], 0) / flat.length;
    const lng = flat.reduce((s, c) => s + c[0], 0) / flat.length;
    return [lat, lng];
  }
  return null;
}

export default function WattaraMap({ fullscreen = false }: { fullscreen?: boolean }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const [zones, setZones] = useState<ZoneMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    async function loadZones() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_URL}/zones/map?include_outages=true`);
        if (!res.ok) throw new Error("Impossible de charger les zones de la carte");
        const data = await res.json();
        setZones(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de chargement de la carte");
      } finally {
        setLoading(false);
      }
    }
    loadZones();
  }, []);

  const mappedZones = useMemo(
    () =>
      zones
        .map((zone) => ({ zone, geometry: parseGeometry(zone.geometry), style: getZoneStyle(zone) }))
        .filter((item) => item.geometry),
    [zones]
  );

  const filteredZones = useMemo(
    () =>
      search.trim().length > 1
        ? zones.filter(
            (z) =>
              z.name.toLowerCase().includes(search.toLowerCase()) ||
              (z.sector_number &&
                `secteur ${z.sector_number}`.toLowerCase().includes(search.toLowerCase()))
          )
        : [],
    [search, zones]
  );

  const flyToZone = useCallback((zone: ZoneMapItem) => {
    const geo = parseGeometry(zone.geometry);
    if (!leafletMapRef.current || !geo) return;
    const centroid = getZoneCentroid(geo);
    if (!centroid) return;
    leafletMapRef.current.flyTo(centroid, 15, { duration: 1 });
    setSearch("");
    setSearchOpen(false);
  }, []);

  useEffect(() => {
    if (!mapRef.current || loading || error) return;

    let cancelled = false;

    async function renderMap() {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }

      const map = L.map(mapRef.current, {
        center: OUAGA_CENTER,
        zoom: 12,
        scrollWheelZoom: true,
      });
      leafletMapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      mappedZones.forEach(({ zone, geometry, style }) => {
        if (!geometry) return;

        const isActive = zone.has_active_outage || zone.active_report_count >= 3;
        const tooltipClass = isActive
          ? "wattara-zone-label wattara-zone-label--active"
          : "wattara-zone-label";

        const popup = `
          <strong>${zone.name}${zone.sector_number ? ` (Secteur ${zone.sector_number})` : ""}</strong>
          <br />${style.label}
          <br />Signalements récents : ${zone.active_report_count}
          <br />Coupures officielles : ${zone.active_outage_count}
        `;

        if (geometry.type === "Point") {
          const [longitude, latitude] = geometry.coordinates;
          L.circleMarker([latitude, longitude], {
            ...style,
            radius: zone.has_active_outage ? 14 : zone.active_report_count > 0 ? 11 : 9,
          })
            .addTo(map)
            .bindPopup(popup)
            .bindTooltip(zone.name, {
              permanent: isActive,
              direction: "top",
              className: tooltipClass,
            });
          return;
        }

        const layer = L.geoJSON({ type: "Feature", properties: {}, geometry }, { style }).addTo(map);
        layer.bindPopup(popup);
        layer.bindTooltip(zone.name, {
          permanent: isActive,
          sticky: !isActive,
          className: tooltipClass,
        });
      });
    }

    renderMap();

    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [error, loading, mappedZones]);

  const legend = (
    <div className="flex flex-wrap gap-2 text-xs font-medium">
      <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">Officiel</span>
      <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-700">Instable</span>
      <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Signalé</span>
      <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">Calme</span>
    </div>
  );

  const searchBox = (
    <div className="absolute left-3 top-14 z-[1001] w-60">
      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-2.5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher une zone…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          className="w-full rounded-lg border border-gray-200 bg-white/95 py-2 pl-8 pr-7 text-sm shadow backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {search && (
          <button
            type="button"
            title="Effacer la recherche"
            onClick={() => {
              setSearch("");
              setSearchOpen(false);
            }}
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {searchOpen && filteredZones.length > 0 && (
        <div className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filteredZones.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => flyToZone(z)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-gray-50"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  z.has_active_outage
                    ? "bg-red-500"
                    : z.active_report_count >= 3
                    ? "bg-orange-500"
                    : z.active_report_count > 0
                    ? "bg-amber-400"
                    : "bg-blue-400"
                }`}
              />
              <span className="font-medium text-gray-900">{z.name}</span>
              {z.sector_number && (
                <span className="ml-auto shrink-0 text-xs text-gray-400">S{z.sector_number}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {searchOpen && search.trim().length > 1 && filteredZones.length === 0 && (
        <div className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow">
          Aucune zone trouvée
        </div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="relative flex h-full w-full flex-col">
        {/* Zone search */}
        {searchBox}

        {/* Legend */}
        <div className="absolute right-3 top-3 z-[400] rounded-lg border border-gray-200 bg-white/90 p-2 shadow backdrop-blur-sm">
          {legend}
        </div>

        {error ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          </div>
        ) : (
          <div className="relative h-full w-full">
            {loading && (
              <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/80 text-gray-600">
                <Loader2 className="mr-2 animate-spin" size={20} />
                Chargement de la carte...
              </div>
            )}
            <div ref={mapRef} className="h-full w-full" />
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MapPinned className="text-primary" size={21} />
            <h2 className="text-xl font-bold text-gray-900">Carte des zones</h2>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Vue géographique des quartiers, coupures officielles et signalements citoyens.
          </p>
        </div>
        {legend}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <div className="relative h-[420px] overflow-hidden rounded-lg border border-gray-200">
          {/* Zone search inside card map */}
          {searchBox}

          {loading && (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/80 text-gray-600">
              <Loader2 className="mr-2 animate-spin" size={20} />
              Chargement de la carte...
            </div>
          )}
          <div ref={mapRef} className="h-full w-full" />
        </div>
      )}
    </section>
  );
}
