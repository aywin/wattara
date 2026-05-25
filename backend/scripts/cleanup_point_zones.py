"""
Nettoyage des zones Point dupliquées après import des polygones.

- Zones Point sans signalement → suppression
- Zones Point avec signalement + polygone équivalent → réassignation des reports puis suppression
- Zones Point avec signalement sans polygone équivalent → conservées

Usage:
    cd backend
    python scripts/cleanup_point_zones.py
    python scripts/cleanup_point_zones.py --dry-run
"""

import argparse
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db import SessionLocal
from app.models import OfficialOutageZone, Report, Zone


def normalize(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text.strip().lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def main(dry_run: bool = False) -> None:
    db = SessionLocal()
    try:
        all_zones = db.query(Zone).all()

        point_zones = [z for z in all_zones if z.geometry and '"Point"' in z.geometry]
        poly_zones  = [z for z in all_zones if z.geometry and '"Polygon"' in z.geometry]

        print(f"Zones Point   : {len(point_zones)}")
        print(f"Zones Polygon : {len(poly_zones)}")

        # Index polygones par nom normalisé
        poly_by_name: dict[str, Zone] = {normalize(z.name): z for z in poly_zones}

        # Compte les reports par zone
        report_counts: dict[str, int] = {}
        for r in db.query(Report).all():
            if r.zone_id:
                key = str(r.zone_id)
                report_counts[key] = report_counts.get(key, 0) + 1

        deleted = 0
        reassigned = 0
        kept = 0

        for zone in point_zones:
            zid = str(zone.id)
            n_reports = report_counts.get(zid, 0)
            poly_match = poly_by_name.get(normalize(zone.name))

            if n_reports == 0:
                print(f"  [DEL]  {zone.name:<30} (0 signalement)")
                if not dry_run:
                    db.query(OfficialOutageZone).filter(OfficialOutageZone.zone_id == zone.id).delete()
                    db.delete(zone)
                deleted += 1

            elif poly_match:
                print(f"  [REA]  {zone.name:<30} -> '{poly_match.name}' ({n_reports} signalement(s))")
                if not dry_run:
                    db.query(Report).filter(Report.zone_id == zone.id).update(
                        {"zone_id": poly_match.id}
                    )
                    db.query(OfficialOutageZone).filter(OfficialOutageZone.zone_id == zone.id).delete()
                    db.delete(zone)
                reassigned += n_reports
                deleted += 1

            else:
                print(f"  [KEP]  {zone.name:<30} ({n_reports} signalement(s)) — pas de polygone équivalent, conservé")
                kept += 1

        if not dry_run:
            db.commit()
            print(f"\nCommit OK.")
        else:
            print(f"\n[DRY-RUN] Aucune modification.")

        print(f"\nRésultat :")
        print(f"  Supprimées       : {deleted}")
        print(f"  Reports réassignés : {reassigned}")
        print(f"  Conservées       : {kept}")

    except Exception as e:
        db.rollback()
        print(f"\nErreur : {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
