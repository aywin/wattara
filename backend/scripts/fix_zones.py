"""
Deux corrections :
1. Met à jour les 5 zones avec leurs vrais polygones OSM
2. Supprime les faux secteurs (communes voisines incluses par erreur)

Usage:
    cd backend && python scripts/fix_zones.py
    cd backend && python scripts/fix_zones.py --dry-run
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

from app.db import SessionLocal
from app.models import OfficialOutageZone, Report, Zone

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# IDs OSM des 5 vrais polygones quartier de Ouaga
OSM_WAY_IDS = [27863585, 27895577, 27895692, 27895707, 153976450]

# Communes voisines mal incluses dans le GeoJSON (pas des secteurs de la ville)
FAKE_SECTORS = {
    "saaba", "koubri", "loumbila", "ouaghin",
    "ziniare sud", "ziniari sud", "zinare sud",
    "pabre", "kokologo", "kombissiri nord", "sapone nord", "doulougou",
    "bindougou", "koubalgou",
}


def normalize(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text.strip().lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def fetch_osm_ways(ids: list[int]) -> list[dict]:
    id_str = "".join(f"way({i});" for i in ids)
    query = f"[out:json][timeout:30];({id_str});out geom qt;"
    payload = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = urllib.request.Request(
        OVERPASS_URL, data=payload,
        headers={"User-Agent": "Wattara/0.1", "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8")).get("elements", [])


def way_to_polygon(element: dict) -> dict | None:
    geom = element.get("geometry", [])
    if len(geom) < 3:
        return None
    coords = [[g["lon"], g["lat"]] for g in geom]
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    return {"type": "Polygon", "coordinates": [coords]}


def main(dry_run: bool = False) -> None:
    db = SessionLocal()
    try:
        # ── 1. Vrais polygones OSM ──────────────────────────────────────────
        print("Recuperation des 5 vrais polygones OSM...")
        elements = fetch_osm_ways(OSM_WAY_IDS)
        print(f"  {len(elements)} ways recus\n")

        osm_updated = 0
        for el in elements:
            name = el.get("tags", {}).get("name")
            if not name:
                continue
            polygon = way_to_polygon(el)
            if not polygon:
                continue

            zone = db.query(Zone).filter(Zone.name.ilike(name)).first()
            if zone:
                print(f"  [OSM-MAJ] {name:<25} ({len(el['geometry'])} pts)")
                if not dry_run:
                    zone.geometry = json.dumps(polygon, ensure_ascii=False)
                osm_updated += 1
            else:
                print(f"  [OSM-SKIP] {name} — zone introuvable en base")

        # ── 2. Suppression des faux secteurs ────────────────────────────────
        print(f"\nRecherche des faux secteurs (communes voisines)...")
        all_zones = db.query(Zone).all()

        report_counts: dict[str, int] = {}
        for r in db.query(Report).all():
            if r.zone_id:
                k = str(r.zone_id)
                report_counts[k] = report_counts.get(k, 0) + 1

        deleted = 0
        skipped_reports = 0

        for zone in all_zones:
            if normalize(zone.name) not in FAKE_SECTORS:
                continue

            n_reports = report_counts.get(str(zone.id), 0)
            if n_reports > 0:
                print(f"  [KEEP]  {zone.name:<25} — {n_reports} signalement(s), conserve")
                skipped_reports += 1
                continue

            print(f"  [DEL]   {zone.name:<25} (commune voisine, 0 signalement)")
            if not dry_run:
                db.query(OfficialOutageZone).filter(OfficialOutageZone.zone_id == zone.id).delete()
                db.delete(zone)
            deleted += 1

        if not dry_run:
            db.commit()
            print(f"\nCommit OK.")
        else:
            print(f"\n[DRY-RUN] aucune modification.")

        print(f"\nResultat :")
        print(f"  Zones OSM mises a jour : {osm_updated}")
        print(f"  Faux secteurs supprimes : {deleted}")
        print(f"  Faux secteurs gardes (ont des reports) : {skipped_reports}")

    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
