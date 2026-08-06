#!/usr/bin/env python3
"""Genereert de statische presentatiesite (site/index.html + site/images/*.webp)
uit de huidige data/loes.db. Comprimeert alle beelden fors (WebP, ingekrompen)
zodat de site licht blijft over mobiele verbindingen — geen volle resolutie.

Gebruik: .venv/bin/python site/build.py [--aantal 24]
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

from PIL import Image

BASE = Path(__file__).resolve().parent
REPO = BASE.parent
DB_PAD = REPO / "data" / "loes.db"
IMAGES_DIR = BASE / "images"
BREEDTE = 640          # max. breedte van de gepubliceerde webp's (px)
KWALITEIT = 72         # webp-kwaliteit (0-100)


def selecteer_beelden(conn: sqlite3.Connection, aantal: int) -> list[sqlite3.Row]:
    """Wat zij zelf koos eerst, daarna de werkbank om aan te vullen.

    Sinds ze haar eigen werk cureert is 'gepubliceerd' een bewuste keuze en dus
    het echte oeuvre — maar dat groeit langzaam, en een pagina met drie beelden
    vertelt niets. De rest wordt aangevuld met werk uit de pool, herkenbaar als
    niet-gekozen (`gekozen: false`), zodat de site laat zien wat ze maakt én wat
    ze daarvan de moeite waard vond. Verbergen zou hier het verkeerde signaal
    zijn."""
    gekozen = conn.execute(
        """SELECT id, pad, beschrijving, cyclus, 1 AS gekozen FROM beelden
           WHERE status = 'gepubliceerd' AND beschrijving IS NOT NULL AND beschrijving != ''
           ORDER BY cyclus DESC LIMIT ?""",
        (aantal,),
    ).fetchall()
    if len(gekozen) >= aantal:
        return gekozen

    rest = conn.execute(
        """SELECT id, pad, beschrijving, cyclus, 0 AS gekozen FROM beelden
           WHERE status IN ('in_pool', 'gecurateerd') AND beschrijving IS NOT NULL
           AND beschrijving != '' ORDER BY cyclus DESC LIMIT ?""",
        (aantal - len(gekozen),),
    ).fetchall()
    return [*gekozen, *rest]


def lees_praktijk(conn: sqlite3.Connection) -> dict:
    """Haar lopende onderzoek, haar notities en haar identiteitsversies.

    Dit is wat de site van een galerij een verslag maakt: niet alleen wat ze
    maakte, maar waar ze mee bezig was en wat ze daarover aan zichzelf schreef.
    De identiteitsreeks staat er omdat ze haar eigen persona herschrijft zonder
    goedkeuringsstap — het spoor is de verantwoording."""
    def rijen(sql, *a):
        try:
            return [dict(r) for r in conn.execute(sql, a).fetchall()]
        except sqlite3.OperationalError:
            return []   # db van vóór het atelier

    onderzoek = rijen(
        "SELECT titel, vraag, aanleiding, modus, begonnen_cyclus FROM onderzoeken "
        "WHERE status = 'lopend' ORDER BY id DESC LIMIT 1"
    )
    afgesloten = rijen(
        "SELECT titel, vraag, bevinding, begonnen_cyclus, geeindigd_cyclus FROM onderzoeken "
        "WHERE status = 'afgesloten' ORDER BY id DESC LIMIT 5"
    )
    notities = rijen(
        "SELECT cyclus, soort, tekst FROM notities ORDER BY id DESC LIMIT 12"
    )
    identiteiten = []
    id_dir = REPO / "identiteit"
    for bestand in sorted(id_dir.glob("identity_v*.md")):
        if bestand.name.endswith(".concept.md"):
            continue
        cijfers = "".join(c for c in bestand.stem if c.isdigit())
        identiteiten.append({
            "versie": int(cijfers or 0),
            "tekst": bestand.read_text(encoding="utf-8"),
        })
    identiteiten.sort(key=lambda i: i["versie"])
    return {
        "onderzoek": onderzoek[0] if onderzoek else None,
        "afgesloten": afgesloten,
        "notities": notities,
        "identiteit": identiteiten,
    }


def verwerk_beeld(bron_pad: Path, doel_pad: Path) -> None:
    with Image.open(bron_pad) as im:
        im = im.convert("RGB")
        if im.width > BREEDTE:
            hoogte = round(im.height * BREEDTE / im.width)
            im = im.resize((BREEDTE, hoogte), Image.LANCZOS)
        im.save(doel_pad, "WEBP", quality=KWALITEIT, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--aantal", type=int, default=24)
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PAD)
    conn.row_factory = sqlite3.Row
    rows = selecteer_beelden(conn, args.aantal)
    praktijk = lees_praktijk(conn)
    conn.close()

    if not rows:
        raise SystemExit("geen beelden met beschrijving gevonden in data/loes.db")

    for oud in IMAGES_DIR.glob("*.webp"):
        oud.unlink()

    items = []
    for row in rows:
        bron_pad = Path(row["pad"])
        if not bron_pad.is_absolute():
            bron_pad = REPO / bron_pad
        if not bron_pad.exists():
            continue
        bestandsnaam = f"c{row['cyclus']:06d}.webp"
        verwerk_beeld(bron_pad, IMAGES_DIR / bestandsnaam)
        items.append({
            "bestand": f"images/{bestandsnaam}",
            "beschrijving": row["beschrijving"],
            "cyclus": row["cyclus"],
        })

    (BASE / "data.json").write_text(
        json.dumps({"werk": items, **praktijk}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"{len(items)} beelden verwerkt -> site/images/, site/data.json bijgewerkt")


if __name__ == "__main__":
    main()
