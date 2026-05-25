"""
Récupère les vrais polygones des secteurs de Ouagadougou depuis Overpass API
(relations admin_level=9 dans la commune de Ouagadougou admin_level=8).

Sauvegarde le GeoJSON dans backend/data/osm_secteurs_ouaga.geojson,
puis met à jour la base (MAJ geometry + creation si absent).

Usage:
    cd backend
    python scripts/fetch_osm_secteurs.py
    python scripts/fetch_osm_secteurs.py --save-only   # fichier seulement, pas de DB
    python scripts/fetch_osm_secteurs.py --dry-run     # affiche sans modifier la DB
"""

import argparse
import json
import sys
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OUT_FILE = ROOT / "data" / "osm_secteurs_ouaga.geojson"

# Essaie admin_level 9 puis 10 (selon comment les secteurs sont tagués dans OSM)
QUERIES = [
    ("admin_level=9 dans Ouagadougou", """
[out:json][timeout:120];
area["name"="Ouagadougou"]["admin_level"="8"]->.ouaga;
(
  relation["admin_level"="9"](area.ouaga);
);
out geom qt;
"""),
    ("admin_level=10 dans Ouagadougou", """
[out:json][timeout:120];
area["name"="Ouagadougou"]["admin_level"="8"]->.ouaga;
(
  relation["admin_level"="10"](area.ouaga);
);
out geom qt;
"""),
    ("place suburb/neighbourhood dans bbox Ouaga", """
[out:json][timeout:120];
(
  relation["place"~"suburb|neighbourhood|quarter"][~"^name"~"."](12.20,-1.75,12.55,-1.25);
);
out geom qt;
"""),
]


def fetch_overpass(query: str) -> dict:
    payload = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = urllib.request.Request(
        OVERPASS_URL,
        data=payload,
        headers={
            "User-Agent": "Wattara/0.1 OSM secteurs import",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=150) as resp:
        return json.loads(resp.read().decode("utf-8"))


def round_coord(c, decimals=5):
    return (round(c[0], decimals), round(c[1], decimals))


def chain_ways(ways: list[list]) -> list | None:
    """Assemble une liste de segments way en un anneau fermé."""
    if not ways:
        return None
    if len(ways) == 1:
        ring = list(ways[0])
        if round_coord(ring[0]) != round_coord(ring[-1]):
            ring.append(ring[0])
        return ring

    segments = [list(w) for w in ways]
    ring = list(segments.pop(0))

    for _ in range(len(segments) * 3 + 1):
        if not segments:
            break
        end = round_coord(ring[-1])
        matched = False
        for i, seg in enumerate(segments):
            if round_coord(seg[0]) == end:
                ring.extend(seg[1:])
                segments.pop(i)
                matched = True
                break
            elif round_coord(seg[-1]) == end:
                ring.extend(list(reversed(seg))[1:])
                segments.pop(i)
                matched = True
                break
        if not matched:
            break

    if round_coord(ring[0]) != round_coord(ring[-1]):
        ring.append(ring[0])

    return ring


def relation_to_feature(rel: dict) -> dict | None:
    tags = rel.get("tags", {})
    name = tags.get("name") or tags.get("name:fr")
    if not name:
        return None

    outer_ways, inner_ways = [], []

    for member in rel.get("members", []):
        if member.get("type") != "way" or "geometry" not in member:
            continue
        coords = [[g["lon"], g["lat"]] for g in member["geometry"]]
        if not coords:
            continue
        if member.get("role") == "inner":
            inner_ways.append(coords)
        else:
            outer_ways.append(coords)

    if not outer_ways:
        return None

    outer_ring = chain_ways(outer_ways)
    if not outer_ring or len(outer_ring) < 4:
        return None

    if inner_ways:
        inner_rings = [chain_ways([iw]) for iw in inner_ways]
        coordinates = [outer_ring] + [r for r in inner_rings if r and len(r) >= 4]
    else:
        coordinates = [outer_ring]

    return {
        "type": "Feature",
        "properties": {
            "name": name,
            "ref": tags.get("ref") or tags.get("ref:FR"),
            "admin_level": tags.get("admin_level"),
            "place": tags.get("place"),
            "osm_id": rel.get("id"),
        },
        "geometry": {"type": "Polygon", "coordinates": coordinates},
    }


def normalize(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text.strip().lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def import_to_db(features: list, dry_run: bool = False) -> None:
    from app.db import SessionLocal
    from app.models import Region, Zone

    db = SessionLocal()
    try:
        region = db.query(Region).filter(Region.name.ilike("Ouagadougou")).first()
        if not region:
            region = Region(name="Ouagadougou", country="Burkina Faso")
            if not dry_run:
                db.add(region)
                db.flush()

        existing: dict[str, Zone] = {normalize(z.name): z for z in db.query(Zone).all()}

        created, updated = [], []

        for feat in features:
            props = feat["properties"]
            name = props["name"]
            geometry_json = json.dumps(feat["geometry"], ensure_ascii=False)
            key = normalize(name)
            sector_number = str(props["ref"]) if props.get("ref") else None

            existing_zone = existing.get(key)
            if existing_zone:
                print(f"  [MAJ] {name:<30} (osm_id={props.get('osm_id')})")
                updated.append(name)
                if not dry_run:
                    existing_zone.geometry = geometry_json
                    if sector_number:
                        existing_zone.sector_number = sector_number
            else:
                print(f"  [NEW] {name:<30} (osm_id={props.get('osm_id')})")
                created.append(name)
                if not dry_run:
                    db.add(Zone(
                        region_id=region.id,
                        name=name,
                        place=props.get("place") or "neighbourhood",
                        sector_number=sector_number,
                        geometry=geometry_json,
                    ))

        if not dry_run:
            db.commit()
            print(f"\nCommit OK.")
        else:
            print(f"\n[DRY-RUN] pas de modification.")

        print(f"\nResultat DB : {len(created)} crees, {len(updated)} mis a jour")

    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


def main(save_only: bool = False, dry_run: bool = False) -> None:
    features = []

    for label, query in QUERIES:
        print(f"\nRequete Overpass : {label}...")
        try:
            data = fetch_overpass(query)
            elements = data.get("elements", [])
            print(f"  {len(elements)} relation(s) recues")

            for el in elements:
                feat = relation_to_feature(el)
                if feat:
                    features.append(feat)

            if features:
                print(f"  {len(features)} polygone(s) convertis — on s'arrete ici.")
                break
            else:
                print(f"  Aucun polygone utilisable, on essaie la requete suivante...")

        except Exception as e:
            print(f"  Erreur : {e}")
            continue

    if not features:
        print("\nAucun polygone trouve dans OSM. Les secteurs ne sont peut-etre pas encore traces.")
        print("Consultez https://www.openstreetmap.org et cherchez 'Ouagadougou secteurs'.")
        return

    # Sauvegarde GeoJSON
    geojson = {
        "type": "FeatureCollection",
        "name": "Secteurs OSM Ouagadougou",
        "features": features,
    }
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    print(f"\nFichier sauvegarde : {OUT_FILE} ({len(features)} zones)")

    if save_only:
        return

    print(f"\nImport en base...")
    import_to_db(features, dry_run=dry_run)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--save-only", action="store_true", help="Sauvegarde le GeoJSON seulement")
    parser.add_argument("--dry-run", action="store_true", help="Simule sans modifier la DB")
    args = parser.parse_args()
    main(save_only=args.save_only, dry_run=args.dry_run)
