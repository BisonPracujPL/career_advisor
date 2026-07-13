"""Popraw nazwy technologii w słowniku LightCast (Skill.name).

Google Translate psuje nazwy własne technologii przy tłumaczeniu słownika na
polski, np.:

    ActivePython   -> AktywnyPython
    Backing Beans  -> Fasola szparagowa
    Apache Pig     -> Świnia Apacza
    Hibernate      -> Hibernacja

Ta komenda bierze angielskie nazwy po ``id`` z ``lightcast_data_formatted.en.csv``
i dla skilli technicznych (kategoria IT, wzorce nazw własnych, prefiks
"Apache ", lista wyjątków) przywraca oryginalną nazwę angielską — bez ruszania
skilli miękkich (np. "Aktywne słuchanie" zostaje po polsku).

Zmienia TYLKO ``Skill.name`` (etykieta wyświetlana). Matching działa po
``skill_id`` / ``vector_index``, więc oferty i wektory zostają nietknięte i nie
trzeba nic przeliczać. Uruchom PO ``load_skills``::

    docker compose exec backend python manage.py fix_skill_names /data/lightcast_data_formatted.en.csv
"""

from __future__ import annotations

import csv
import re
import sys

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.job_market.models import Skill

csv.field_size_limit(sys.maxsize)

DEFAULT_EN_CSV = "/data/lightcast_data_formatted.en.csv"

# Kategoria główna IT w hierarchii LightCast ("17.0" = "Technologia informacyjna").
IT_MAIN_PREFIX = "17."

_CAMEL_CASE = re.compile(r"[a-z][A-Z]")  # ActivePython, NetBeans, JavaBeans
_TECH_MARKERS = re.compile(
    r"\((?:[^)]*\b(?:Programming Language|Language|Package|Framework|"
    r"Library|Software|Web Framework)\b[^)]*)\)",
    re.IGNORECASE,
)
_TECH_SYMBOLS = ("#", "++", ".net", ".js", "sql")

# Nazwy własne, które zawsze oznaczają produkt/technologię (prefiks).
_FORCE_ENGLISH_PREFIXES = ("Apache ",)

# Ręczna lista wyjątków: nazwy własne z pustą hierarchią i "zwykłym" angielskim,
# których heurystyki nie łapią, a tłumacz je psuje. Rozszerzalna.
_FORCE_ENGLISH_NAMES = {
    "Backing Beans",
    "Bean Validation",
    "Managed Bean",
    "Message Driven Beans",
    "Session Beans",
    "Java Access Bridge",
    "Object Relational Bridge (OJB)",
    "Vaadin",
}


def _looks_technical(name: str) -> bool:
    if _CAMEL_CASE.search(name):
        return True
    if _TECH_MARKERS.search(name):
        return True
    low = name.lower()
    return any(sym in low for sym in _TECH_SYMBOLS)


def should_use_english(english_name: str, main_category_code: str) -> bool:
    if english_name in _FORCE_ENGLISH_NAMES:
        return True
    if english_name.startswith(_FORCE_ENGLISH_PREFIXES):
        return True
    if (main_category_code or "").startswith(IT_MAIN_PREFIX):
        return True
    return _looks_technical(english_name)


class Command(BaseCommand):
    help = "Przywraca angielskie nazwy technologii w Skill.name (po id, z pliku EN)."

    def add_arguments(self, parser):
        parser.add_argument(
            "en_csv",
            nargs="?",
            default=DEFAULT_EN_CSV,
            help=f"Angielski słownik LightCast (id,description,...). Domyślnie {DEFAULT_EN_CSV}.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Pokaż co zostałoby zmienione, nie zapisuj.",
        )

    def handle(self, *args, **opts):
        en_path, dry_run = opts["en_csv"], opts["dry_run"]

        try:
            with open(en_path, newline="", encoding="utf-8") as f:
                en_map = {
                    row["id"]: (row.get("description") or "").strip()
                    for row in csv.DictReader(f)
                }
        except FileNotFoundError:
            self.stderr.write(self.style.ERROR(f"Nie znaleziono pliku EN: {en_path}"))
            return
        self.stdout.write(f"Wczytano {len(en_map):,} angielskich nazw po id.")

        to_update: list[Skill] = []
        samples: list[tuple[str, str]] = []
        missing_en = 0

        for skill in Skill.objects.all().iterator(chunk_size=2000):
            english = en_map.get(skill.id)
            if not english:
                missing_en += 1
                continue
            if english == skill.name:
                continue
            if should_use_english(english, skill.main_category_code):
                if len(samples) < 20:
                    samples.append((skill.name, english))
                skill.name = english
                to_update.append(skill)

        self.stdout.write(
            f"Do poprawy: {len(to_update):,} nazw "
            f"(brak ang. odpowiednika dla {missing_en:,} skilli)."
        )
        if samples:
            self.stdout.write("Przykłady (PL -> EN):")
            for pl, en in samples:
                self.stdout.write(f"  {pl!r:45} -> {en!r}")

        if dry_run:
            self.stdout.write(self.style.WARNING("--dry-run: nic nie zapisano."))
            return

        with transaction.atomic():
            Skill.objects.bulk_update(to_update, ["name"], batch_size=2000)
        self.stdout.write(
            self.style.SUCCESS(f"Zaktualizowano Skill.name dla {len(to_update):,} skilli.")
        )
