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
    for statussen in (("gepubliceerd",), ("gecureerd", "gepubliceerd"), ("in_pool",)):
        placeholders = ",".join("?" * len(statussen))
        rows = conn.execute(
            f"""SELECT id, pad, beschrijving, cyclus FROM beelden
                WHERE status IN ({placeholders}) AND beschrijving IS NOT NULL AND beschrijving != ''
                ORDER BY cyclus DESC LIMIT ?""",
            (*statussen, aantal),
        ).fetchall()
        if rows:
            return rows
    return []


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
        json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"{len(items)} beelden verwerkt -> site/images/, site/data.json bijgewerkt")


if __name__ == "__main__":
    main()
