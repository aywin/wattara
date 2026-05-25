import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db import SessionLocal
from app.models import Region, Zone


OVERPASS_URL = "https://overpass-api.de/api/interpreter"

OUAGA_BBOX = {
    "south": 12.20,
    "west": -1.75,
    "north": 12.55,
    "east": -1.25,
}

PLACE_FILTER = "city|town|suburb|neighbourhood|quarter|village|hamlet"


def normalize_name(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"\s+", " ", value)
    return value


def build_query() -> str:
    south = OUAGA_BBOX["south"]
    west = OUAGA_BBOX["west"]
    north = OUAGA_BBOX["north"]
    east = OUAGA_BBOX["east"]

    return f"""
[out:json][timeout:90];
(
  node["place"~"{PLACE_FILTER}"]({south},{west},{north},{east});
  way["place"~"{PLACE_FILTER}"]({south},{west},{north},{east});
  relation["place"~"{PLACE_FILTER}"]({south},{west},{north},{east});
);
out center tags;
"""


def fetch_overpass() -> dict:
    payload = urllib.parse.urlencode({"data": build_query()}).encode("utf-8")
    request = urllib.request.Request(
        OVERPASS_URL,
        data=payload,
        headers={
            "User-Agent": "Wattara/0.1 local import",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def element_to_zone(element: dict) -> dict | None:
    tags = element.get("tags") or {}
    name = tags.get("name") or tags.get("name:fr")
    place = tags.get("place")

    if not name or not place:
        return None

    latitude = element.get("lat")
    longitude = element.get("lon")

    if latitude is None or longitude is None:
        center = element.get("center") or {}
        latitude = center.get("lat")
        longitude = center.get("lon")

    if latitude is None or longitude is None:
        return None

    return {
        "name": name.strip(),
        "place": place,
        "geometry": {
            "type": "Point",
            "coordinates": [float(longitude), float(latitude)],
        },
        "osm_id": f"{element.get('type')}/{element.get('id')}",
    }


def import_zones(dry_run: bool = False) -> dict:
    data = fetch_overpass()
    raw_zones = [element_to_zone(element) for element in data.get("elements", [])]
    zones = [zone for zone in raw_zones if zone]

    by_key: dict[tuple[str, str], dict] = {}
    for zone in zones:
        key = (normalize_name(zone["name"]), zone["place"])
        by_key.setdefault(key, zone)

    db = SessionLocal()
    try:
        region = db.query(Region).filter(Region.name.ilike("Ouagadougou")).first()
        if not region:
            region = Region(name="Ouagadougou", country="Burkina Faso")
            if not dry_run:
                db.add(region)
                db.flush()

        existing = {
            (normalize_name(zone.name), zone.place or "")
            for zone in db.query(Zone).all()
        }

        created = []
        skipped = []

        for (_, _), zone in sorted(by_key.items(), key=lambda item: item[1]["name"]):
            key = (normalize_name(zone["name"]), zone["place"])
            if key in existing:
                skipped.append(zone)
                continue

            created.append(zone)
            if not dry_run:
                db.add(
                    Zone(
                        region_id=region.id,
                        name=zone["name"],
                        place=zone["place"],
                        geometry=json.dumps(zone["geometry"]),
                    )
                )

        if not dry_run:
            db.commit()

        return {
            "fetched": len(data.get("elements", [])),
            "usable": len(zones),
            "unique": len(by_key),
            "created": len(created),
            "skipped_existing": len(skipped),
            "created_names": [zone["name"] for zone in created],
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Importe les quartiers OSM de Ouagadougou dans Wattara.")
    parser.add_argument("--dry-run", action="store_true", help="Affiche le résultat sans insérer en base.")
    args = parser.parse_args()

    result = import_zones(dry_run=args.dry_run)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
