#!/usr/bin/env python3
"""Bouwt de statische atelier-site uit data/loes.db.

Geen galerij maar een werkruimte: haar lopende onderzoek, haar interne dialoog,
het werk dat ze koos, het werk dat ze maakte maar niet koos, en het werk dat de
criticus afkeurde — met de reden erbij. De gedachte is die van loes.ai: geen
claims, wel metingen; niets verborgen.

Alle beelden worden fors ingekrompen en naar WebP omgezet (de installatie hangt
aan een 5G-verbinding); afgekeurd werk krijgt een kleinere maat, want dat is
context, geen tentoonstelling.

Gebruik: .venv/bin/python site/build.py [--aantal 18] [--afgekeurd 8]
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import datetime
from pathlib import Path

from PIL import Image

BASE = Path(__file__).resolve().parent
REPO = BASE.parent
DB_PAD = REPO / "data" / "loes.db"
IMAGES_DIR = BASE / "images"
BREEDTE = 640           # max. breedte van getoond werk (px)
BREEDTE_AFGEKEURD = 360  # afgekeurd werk is context, geen tentoonstelling
KWALITEIT = 72


def _rijen(conn: sqlite3.Connection, sql: str, *args) -> list[dict]:
    """Query die een lege lijst geeft op een db van vóór het atelier."""
    try:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]
    except sqlite3.OperationalError:
        return []


def selecteer_werk(conn: sqlite3.Connection, aantal: int) -> list[dict]:
    """Wat zij zelf koos eerst, daarna de werkbank om aan te vullen.

    'gepubliceerd' is sinds de zelfcuratie een bewuste keuze en dus het echte
    oeuvre, maar dat groeit langzaam. De rest komt uit de pool, herkenbaar als
    niet-gekozen, zodat zichtbaar blijft wat ze maakt náást wat ze ervan de
    moeite waard vond."""
    velden = ("id, pad, prompt, beschrijving, cyclus, tech_score, tech_notities, "
              "academie_cliche, cliche_notities, curriculum_score")
    gekozen = _rijen(
        conn,
        f"""SELECT {velden}, 1 AS gekozen FROM beelden
            WHERE status = 'gepubliceerd' AND beschrijving IS NOT NULL AND beschrijving != ''
            ORDER BY cyclus DESC LIMIT ?""",
        aantal,
    )
    if len(gekozen) >= aantal:
        return gekozen
    rest = _rijen(
        conn,
        f"""SELECT {velden}, 0 AS gekozen FROM beelden
            WHERE status IN ('in_pool', 'gecurateerd') AND beschrijving IS NOT NULL
            AND beschrijving != '' ORDER BY cyclus DESC LIMIT ?""",
        aantal - len(gekozen),
    )
    return [*gekozen, *rest]


def selecteer_afgekeurd(conn: sqlite3.Connection, aantal: int) -> list[dict]:
    """Wat de criticus tegenhield. Hoort er juist bij: een atelier zonder
    mislukkingen is een etalage."""
    return _rijen(
        conn,
        """SELECT id, pad, prompt, cyclus, afkeuringsreden, tech_score, tech_notities,
                  cliche_notities
           FROM beelden WHERE afkeuringsreden IS NOT NULL
           ORDER BY cyclus DESC LIMIT ?""",
        aantal,
    )


def lees_praktijk(conn: sqlite3.Connection) -> dict:
    onderzoek = _rijen(
        conn,
        "SELECT id, titel, vraag, aanleiding, modus, begonnen_cyclus FROM onderzoeken "
        "WHERE status = 'lopend' ORDER BY id DESC LIMIT 1",
    )
    return {
        "onderzoek": onderzoek[0] if onderzoek else None,
        "afgesloten": _rijen(
            conn,
            "SELECT titel, vraag, bevinding, begonnen_cyclus, geeindigd_cyclus "
            "FROM onderzoeken WHERE status = 'afgesloten' ORDER BY id DESC LIMIT 8",
        ),
        "notities": _rijen(
            conn, "SELECT cyclus, soort, tekst FROM notities ORDER BY id DESC LIMIT 24"
        ),
        "identiteit": _lees_identiteit(),
        "metingen": _metingen(conn),
    }


def _lees_identiteit() -> list[dict]:
    """Alle identiteitsversies. Ze herschrijft haar eigen persona zonder
    goedkeuringsstap; het spoor is de verantwoording, dus het hoort op de site."""
    versies = []
    for bestand in (REPO / "identiteit").glob("identity_v*.md"):
        if bestand.name.endswith(".concept.md"):
            continue
        cijfers = "".join(c for c in bestand.stem if c.isdigit())
        versies.append({
            "versie": int(cijfers or 0),
            "tekst": bestand.read_text(encoding="utf-8"),
        })
    return sorted(versies, key=lambda v: v["versie"])


def _metingen(conn: sqlite3.Connection) -> dict:
    def getal(sql: str) -> int:
        rijen = _rijen(conn, sql)
        return rijen[0]["n"] if rijen else 0

    return {
        "cycli": getal("SELECT COALESCE(MAX(id), 0) AS n FROM cycli"),
        "gemaakt": getal("SELECT COUNT(*) AS n FROM beelden"),
        "gekozen": getal("SELECT COUNT(*) AS n FROM beelden WHERE status = 'gepubliceerd'"),
        "afgekeurd": getal("SELECT COUNT(*) AS n FROM beelden WHERE afkeuringsreden IS NOT NULL"),
        "corpus": getal("SELECT COUNT(*) AS n FROM corpus WHERE actief = 1"),
        "notities": getal("SELECT COUNT(*) AS n FROM notities"),
    }


def verwerk_beeld(bron_pad: Path, doel_pad: Path, breedte: int) -> bool:
    try:
        with Image.open(bron_pad) as im:
            im = im.convert("RGB")
            if im.width > breedte:
                hoogte = round(im.height * breedte / im.width)
                im = im.resize((breedte, hoogte), Image.LANCZOS)
            im.save(doel_pad, "WEBP", quality=KWALITEIT, method=6)
        return True
    except (OSError, ValueError):
        return False


def _verwerk_reeks(rijen: list[dict], breedte: int, voorvoegsel: str) -> list[dict]:
    uit = []
    for rij in rijen:
        bron = Path(rij["pad"])
        if not bron.is_absolute():
            bron = REPO / bron
        if not bron.exists():
            continue
        bestandsnaam = f"{voorvoegsel}{rij['cyclus']:06d}_{rij['id']}.webp"
        if not verwerk_beeld(bron, IMAGES_DIR / bestandsnaam, breedte):
            continue
        item = {k: v for k, v in rij.items() if k != "pad"}
        item["bestand"] = f"images/{bestandsnaam}"
        uit.append(item)
    return uit


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--aantal", type=int, default=18)
    parser.add_argument("--afgekeurd", type=int, default=8)
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PAD)
    conn.row_factory = sqlite3.Row
    werk = selecteer_werk(conn, args.aantal)
    afgekeurd = selecteer_afgekeurd(conn, args.afgekeurd)
    praktijk = lees_praktijk(conn)
    conn.close()

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    for oud in IMAGES_DIR.glob("*.webp"):
        oud.unlink()

    data = {
        # Zonder tijdstempel is van buitenaf niet te zien of je naar een verse
        # of een gecachete kopie kijkt — dat kostte een avond zoeken naar een
        # storing die aan de browsercache lag. De pagina toont dit in de voet.
        "bijgewerkt": datetime.now().astimezone().isoformat(timespec="minutes"),
        "werk": _verwerk_reeks(werk, BREEDTE, "w"),
        "afgekeurd": _verwerk_reeks(afgekeurd, BREEDTE_AFGEKEURD, "a"),
        **praktijk,
    }
    if not data["werk"]:
        raise SystemExit("geen beelden met beschrijving gevonden in data/loes.db")

    (BASE / "data.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(
        f"{len(data['werk'])} werken + {len(data['afgekeurd'])} afgekeurd verwerkt, "
        f"{len(data['notities'])} notities, site/data.json bijgewerkt"
    )


if __name__ == "__main__":
    main()
