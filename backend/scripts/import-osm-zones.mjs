const API_URL = process.env.WATTARA_API_URL || "http://127.0.0.1:8000";
const OVERPASS_URL = process.env.OVERPASS_URL || "http://overpass-api.de/api/interpreter";
const fromFileArg = process.argv.find((arg) => arg.startsWith("--from-file="));

const BBOX = {
  south: 12.2,
  west: -1.75,
  north: 12.55,
  east: -1.25,
};

const PLACE_FILTER = "city|town|suburb|neighbourhood|quarter|village|hamlet";

function normalizeName(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildQuery() {
  const { south, west, north, east } = BBOX;
  const nodesOnly = process.argv.includes("--nodes-only");

  if (nodesOnly) {
    return `
[out:json][timeout:60];
node["place"~"${PLACE_FILTER}"](${south},${west},${north},${east});
out tags;
`;
  }

  return `
[out:json][timeout:90];
(
  node["place"~"${PLACE_FILTER}"](${south},${west},${north},${east});
  way["place"~"${PLACE_FILTER}"](${south},${west},${north},${east});
  relation["place"~"${PLACE_FILTER}"](${south},${west},${north},${east});
);
out center tags;
`;
}

async function fetchJson(url, options = {}) {
  const { request } = await import(url.startsWith("https:") ? "node:https" : "node:http");
  const target = new URL(url);
  const body = options.body ? String(options.body) : null;

  const text = await new Promise((resolve, reject) => {
    const req = request(
      target,
      {
        method: options.method || "GET",
        headers: {
          ...(options.headers || {}),
          ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        },
        timeout: 120000,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if ((res.statusCode || 500) >= 400) {
            reject(new Error(`${res.statusCode} ${res.statusMessage}: ${data.slice(0, 500)}`));
            return;
          }
          resolve(data);
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Request timeout: ${url}`));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });

  return text ? JSON.parse(text) : null;
}

async function fetchOverpass() {
  if (fromFileArg) {
    const filePath = fromFileArg.split("=").slice(1).join("=");
    const text = await import("node:fs/promises").then((fs) => fs.readFile(filePath, "utf-8"));
    return JSON.parse(text);
  }

  const body = new URLSearchParams({ data: buildQuery() });
  return fetchJson(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Wattara/0.1 local import",
    },
    body,
  });
}

function elementToZone(element) {
  const tags = element.tags || {};
  const name = tags.name || tags["name:fr"];
  const place = tags.place;

  if (!name || !place) return null;

  let latitude = element.lat;
  let longitude = element.lon;

  if ((latitude === undefined || longitude === undefined) && element.center) {
    latitude = element.center.lat;
    longitude = element.center.lon;
  }

  if (latitude === undefined || longitude === undefined) return null;

  return {
    name: name.trim(),
    place,
    sector_number: null,
    color_code: null,
    geometry: {
      type: "Point",
      coordinates: [Number(longitude), Number(latitude)],
    },
  };
}

async function getOrCreateOuagaRegion(dryRun) {
  const regions = await fetchJson(`${API_URL}/regions/?limit=100`);
  const existing = regions.find((region) => normalizeName(region.name) === "ouagadougou");

  if (existing) return existing;

  if (dryRun) {
    return { id: "dry-run-ouagadougou", name: "Ouagadougou" };
  }

  return fetchJson(`${API_URL}/regions/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Ouagadougou",
      country: "Burkina Faso",
      geometry: null,
    }),
  });
}

async function importZones({ dryRun }) {
  const [overpassData, region] = await Promise.all([
    fetchOverpass(),
    getOrCreateOuagaRegion(dryRun),
  ]);

  const candidates = overpassData.elements.map(elementToZone).filter(Boolean);
  const unique = new Map();

  for (const zone of candidates) {
    const key = `${normalizeName(zone.name)}::${zone.place}`;
    if (!unique.has(key)) unique.set(key, zone);
  }

  const payload = [...unique.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((zone) => ({ ...zone, region_id: region.id }));

  let importResult = {
    created: payload.length,
    skipped_existing: 0,
    created_names: payload.map((zone) => zone.name),
  };

  if (!dryRun) {
    importResult = await fetchJson(`${API_URL}/zones/bulk-import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  return {
    overpass_elements: overpassData.elements.length,
    usable_places: candidates.length,
    unique_places: unique.size,
    ...importResult,
  };
}

const dryRun = process.argv.includes("--dry-run");

importZones({ dryRun })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
