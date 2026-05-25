"""
Import des 57 secteurs de Ouagadougou depuis ouagadougou_secteurs_merged.geojson.

- Si une zone du même nom existe déjà : met à jour geometry + sector_number
- Sinon : crée une nouvelle zone
- Les reports/liens existants sont préservés

Usage:
    cd backend
    python scripts/import_secteurs.py
    python scripts/import_secteurs.py --dry-run
"""

import argparse
import json
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db import SessionLocal
from app.models import Region, Zone

GEOJSON_PATH = ROOT / "data" / "ouagadougou_secteurs_merged.geojson"


def normalize(text: str) -> str:
    """Minuscules + suppression des accents + strip."""
    nfkd = unicodedata.normalize("NFKD", text.strip().lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def main(dry_run: bool = False) -> None:
    with open(GEOJSON_PATH, encoding="utf-8") as f:
        geojson = json.load(f)

    features = geojson.get("features", [])
    print(f"Fichier chargé : {len(features)} secteurs\n")

    db = SessionLocal()
    try:
        # Région Ouagadougou — créée si absente
        region = db.query(Region).filter(Region.name.ilike("Ouagadougou")).first()
        if not region:
            region = Region(name="Ouagadougou", country="Burkina Faso")
            if not dry_run:
                db.add(region)
                db.flush()
            print("Région 'Ouagadougou' créée.")
        else:
            print(f"Région trouvée : {region.name} (id={region.id})")

        # Index des zones existantes par nom normalisé
        existing_zones: dict[str, Zone] = {
            normalize(z.name): z for z in db.query(Zone).all()
        }
        print(f"Zones existantes en base : {len(existing_zones)}\n")

        created, updated, skipped = [], [], []

        for feat in features:
            props = feat.get("properties", {})
            geometry = feat.get("geometry")

            name: str = props.get("name") or props.get("nom") or ""
            sector_number: str = str(props.get("secteur", "")) if props.get("secteur") else None

            if not name or not geometry:
                skipped.append(name or "?")
                continue

            geometry_json = json.dumps(geometry, ensure_ascii=False)
            key = normalize(name)

            existing = existing_zones.get(key)

            if existing:
                # Mise à jour
                action = f"  [MAJ]  {name:<30} (S{sector_number or '?':>2}) — geometry + sector_number"
                print(action)
                updated.append(name)
                if not dry_run:
                    existing.geometry = geometry_json
                    existing.sector_number = sector_number
                    existing.place = existing.place or "neighbourhood"
            else:
                # Création
                action = f"  [NEW]  {name:<30} (S{sector_number or '?':>2})"
                print(action)
                created.append(name)
                if not dry_run:
                    db.add(Zone(
                        region_id=region.id,
                        name=name,
                        place="neighbourhood",
                        sector_number=sector_number,
                        geometry=geometry_json,
                    ))

        if not dry_run:
            db.commit()
            print(f"\nCommit OK.")
        else:
            print(f"\n[DRY-RUN] Aucune modification en base.")

        print(f"\nRésultat :")
        print(f"  Créées  : {len(created)}")
        print(f"  Mises à jour : {len(updated)}")
        print(f"  Ignorées : {len(skipped)}")

    except Exception as e:
        db.rollback()
        print(f"\nErreur : {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Importe les secteurs de Ouagadougou.")
    parser.add_argument("--dry-run", action="store_true", help="Simule sans modifier la base.")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
