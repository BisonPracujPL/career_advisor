# job_market

Aplikacja przechowuje oferty pracy oraz powiązane z nimi skille (na podstawie
`data_en_processed.csv` oraz słownika LightCast). Model opiera się na **trzech
tabelach**:

| Tabela | Klasa modelu | Co przechowuje |
|--------|--------------|----------------|
| `skills_dict` | `Skill` | słownik skilli: `id → nazwa + kategorie` |
| `job_offer_info` | `JobOffer` | ogólne informacje o ofercie |
| `extracted_skills` | `ExtractedSkills` | jeden wiersz na ofertę: `offer_id` + zbiór skilli w JSON |

---

## Relacje

```mermaid
erDiagram
    JobOffer ||--|| ExtractedSkills : "1 do 1 po offer_id"

    JobOffer {
        bigint id PK
        string job_title
        string country_name
        datetime start_date
    }
    Skill {
        string id PK
        string name
        string main_category
        string subcategory
        bool is_category
        int vector_index UK
    }
    ExtractedSkills {
        bigint offer_id PK
        json skills
        sparsevec skill_vector
    }
```

Opisy kolumn znajdziesz w tabelach niżej. W skrócie: `Skill.vector_index` (`UK`,
unikalny) to pozycja skilla w wektorze, a `ExtractedSkills.skill_vector`
(`sparsevec`) ma `1.0` na pozycji `vector_index` każdego wymaganego skilla.

Słownie:

- **`JobOffer` 1 — 1 `ExtractedSkills`** po `offer_id`: cały zbiór skilli oferty
  jest w jednym wierszu, w kolumnie JSON `skills`.
- **`ExtractedSkills.skills[].skill_id` → `Skill.id`**: powiązanie logiczne (przez
  wartość w JSON, bez klucza obcego na poziomie bazy). Pozwala zmapować `skill_id`
  na nazwę i kategorie ze słownika.
- W JSON-ie każdy skill występuje najwyżej raz (przy wielu dopasowaniach zostaje
  najwyższe `probability`).

```
JobOffer ─1──1─ ExtractedSkills.skills = [{skill_id, probability}, ...]
  (id)            (offer_id)                      │ skill_id
                                                  └────────────→ Skill.id (słownik)
```

> Uwaga: skille są przechowywane jako **zbiór w JSON (JSONB)** na ofertę, a nie
> jako osobne wiersze relacji. Szybszy import i prosty odczyt całego zestawu skilli
> oferty; mapowanie `skill_id → nazwa` robi się przez `skills_dict`.

---

## Tabela 1: `skills_dict` (model `Skill`, słownik skilli)

Kluczem głównym jest **ID skilla** (string), więc JSON w `extracted_skills`
odwołuje się do niego przez `skill_id`. Źródła: `lightcast_data_formatted.csv`
(wiersze `type='skill'`) oraz `lightcast_hier_mapper.json` (mapowanie kodów na
nazwy kategorii).

| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | `CharField(32)` **PK** | ID skilla LightCast (np. `KS126XS6CQCFGC3NG79X`) lub kod podkategorii (np. `19.0.511.0`) |
| `name` | `CharField(255)`, indeks | nazwa skilla po angielsku |
| `main_category_code` | `CharField(16)`, indeks | kod kategorii głównej (np. `17.0`) |
| `main_category` | `CharField(128)` | nazwa kategorii głównej (np. `Information Technology`) |
| `subcategory_code` | `CharField(16)`, indeks | kod podkategorii (np. `17.0.442.0`) |
| `subcategory` | `CharField(128)` | nazwa podkategorii (np. `Microsoft Development Tools`) |
| `is_category` | `BooleanField`, indeks | `False` = prawdziwy skill LightCast; `True` = sztuczny wiersz (podkategoria użyta jako skill) |
| `vector_index` | `IntegerField`, **unique** | pozycja skilla w wektorze skilli oferty (`extracted_skills.skill_vector`). Stabilne, ciągłe `0..N-1` po całym słowniku (prawdziwe + syntetyczne), kolejność `(is_category, id)`. Pozwala zrobić **indeks → skill**: `Skill.objects.get(vector_index=i)`. Nadawany przez `load_skills`. |

**Sztuczne wiersze (`is_category=True`):** dopasowania typu `most_common_level_1`
w ofertach wskazują nie na skill, lecz na **podkategorię**. Aby się podlinkowały,
dla każdej z 442 podkategorii dodajemy wiersz, w którym podkategoria pełni rolę
skilla (`id` = kod podkategorii, `name` = `subcategory` = nazwa podkategorii),
a `main_category` pozostaje prawdziwą kategorią nadrzędną.

---

## Tabela 2: `job_offer_info` (model `JobOffer`, oferta)

Jeden wiersz = jedna oferta z CSV. Klucz główny `id` jest automatyczny i pełni
rolę „ID oferty".

| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | `BigAutoField` **PK** | ID oferty |
| `job_title` | `CharField(255)`, indeks | tytuł stanowiska |
| `workplaces` | `CharField(255)` | miejsce pracy |
| `district` | `CharField(255)` | dzielnica |
| `country_name` | `CharField(100)`, indeks | kraj |
| `region_name` | `CharField(100)`, indeks | województwo |
| `latitude` / `longitude` | `DecimalField(9,6)` | współrzędne |
| `main_category_names` | `ArrayField(CharField)` | kategorie główne (lista) |
| `sub_category_names` | `ArrayField(CharField)` | podkategorie (lista) |
| `all_category_names` | `ArrayField(CharField)` | wszystkie kategorie (lista) |
| `lead_main_category` | `CharField(128)` | wiodąca kategoria główna |
| `lead_sub_category` | `CharField(128)` | wiodąca podkategoria |
| `start_date` | `DateTimeField` | data publikacji |
| `expiration_date` | `DateTimeField`, indeks | data wygaśnięcia |
| `requirements_optional` | `TextField` | wymagania opcjonalne |
| `requirements_expected` | `TextField` | wymagania oczekiwane |
| `responsibilities` | `TextField` | zakres obowiązków |
| `technologies_expected` | `TextField` | oczekiwane technologie |
| `position_levels` | `ArrayField(CharField)` | poziomy stanowiska (lista) |
| `type_of_contract` | `ArrayField(CharField)` | typy umowy (lista) |
| `work_schedules` | `ArrayField(CharField)` | wymiary pracy (lista) |
| `work_modes` | `ArrayField(CharField)` | tryby pracy (lista) |
| `keywords` | `ArrayField(CharField)` | słowa kluczowe (lista) |
| `is_remote_work` | `BooleanField(null)` | praca zdalna |
| `is_remote_recruitment` | `BooleanField(null)` | rekrutacja zdalna |
| `is_from_agency` | `BooleanField(null)` | oferta z agencji |
| `is_immediate_employment` | `BooleanField(null)` | zatrudnienie od zaraz |
| `is_cv_optional` | `BooleanField(null)` | CV opcjonalne |
| `multiple_vacancies` | `BooleanField(null)` | wiele wakatów |
| `multiple_vacancies_number` | `PositiveIntegerField(null)` | liczba wakatów |
| `language` | `CharField(8)`, indeks | język ogłoszenia |
| `salary_uop_from` / `_to` | `DecimalField(12,5)` | widełki — umowa o pracę |
| `salary_uop_currency` / `_duration` / `_kind` | `CharField` | waluta / okres / rodzaj (uop) |
| `salary_b2b_from` / `_to` | `DecimalField(12,5)` | widełki — B2B |
| `salary_b2b_currency` / `_duration` / `_kind` | `CharField` | waluta / okres / rodzaj (B2B) |
| `created_at` | `DateTimeField` | czas dodania rekordu |

Listy (kategorie, poziomy, tryby pracy itd.) są zapisane jako natywne tablice
PostgreSQL (`ArrayField`), dzięki czemu można filtrować po pojedynczym elemencie.
Flagi są `null=True`, bo w danych występuje też wartość `null` (rozróżniamy „nie"
od „brak danych").

---

## Tabela 3: `extracted_skills` (model `ExtractedSkills`, zbiór skilli oferty)

Jeden wiersz = jedna oferta i cały jej zbiór wyciągniętych skilli w JSON.

| Kolumna | Typ | Opis |
|---------|-----|------|
| `offer_id` | `OneToOneField → JobOffer` **PK**, `ON DELETE CASCADE` | ID oferty (jednocześnie klucz główny) |
| `skills` | `JSONField` (JSONB) | zbiór skilli: `[{"skill_id": "...", "probability": 0.62}, ...]` |
| `skill_vector` | `SparseVectorField` (pgvector `sparsevec`) | rzadki wektor nad całym słownikiem skilli; współrzędna `i` jest niezerowa, gdy oferta wymaga skilla o `vector_index = i` |

### Wektor skilli (`skill_vector`)

Dla każdej oferty tworzymy wektor o długości = liczbie **wszystkich** skilli w
słowniku (prawdziwych + syntetycznych, ~32 tys.). Współrzędna `i` jest niezerowa,
gdy oferta wymaga skilla, którego `Skill.vector_index = i` (czyli skill jest w
`skills`, a ten zbiór jest już odfiltrowany progiem importu — domyślnie `0.5`).
Wartość to `1.0` (tryb `binary`, domyślny) albo `match_score` (tryb
`probability`, flaga `--vector-value`).

> **Dlaczego `sparsevec`, a nie `vector`?** Słownik ma ~32 tys. skilli, czyli
> więcej niż limit 16 tys. wymiarów gęstego `vector`/`halfvec` w pgvector.
> `sparsevec` obsługuje do 1 mld wymiarów i zapisuje tylko niezerowe pozycje, a
> jedna oferta ma ich tylko kilka — więc to zarazem konieczne i znacznie tańsze.

Mapowanie **indeks → skill** jest relacyjne przez `skills_dict.vector_index`,
więc mając np. współrzędną `5` zapytasz `Skill.objects.get(vector_index=5)` i
poznasz nazwę skilla.

Format `skills`:

```json
[
  {"skill_id": "KS1235V5W7TM41LP3N70", "probability": 0.83},
  {"skill_id": "19.0.511.0", "probability": 0.61}
]
```

- `skill_id` odwołuje się do `skills_dict.id` (mapowanie na nazwę i kategorie).
- każdy `skill_id` występuje w zbiorze najwyżej raz (najwyższe `probability`).
- relacja 1:1 z ofertą — `offer_id` jest kluczem głównym tej tabeli.

W razie potrzeby szybkiego wyszukiwania ofert po skillu można dodać indeks GIN na
kolumnie `skills` (JSONB).

---

## Jak powstają tabele (migracje)

Tabele tworzy Django na podstawie migracji
`apps/job_market/migrations/0001_initial.py`. Wewnątrz kontenera backendu:

```bash
# podgląd SQL, który zostanie wykonany (nic nie zmienia)
python manage.py sqlmigrate job_market 0001

# faktyczne utworzenie tabel w PostgreSQL
python manage.py migrate
```

W tym projekcie `docker compose up` uruchamia `migrate` automatycznie, więc tabele
powstają przy starcie backendu.

---

## Wczytanie danych

Kolejność jest istotna — najpierw słownik skilli, potem oferty (oferty linkują się
tylko do skilli, które już istnieją w słowniku):

```bash
# 1) słownik skilli LightCast + sztuczne wiersze podkategorii
python manage.py load_skills /data/lightcast_data_formatted.csv /data/lightcast_hier_mapper.json

# 2) oferty + zbiór skilli w JSON + wektor skilli (zapisuje tylko match_score >= threshold)
python manage.py load_offers /data/data_en_processed.csv --threshold 0.5
```

Próg (`--threshold`) decyduje, z jakim minimalnym prawdopodobieństwem skill jest
„brany". Domyślnie `0.5` (stała `DEFAULT_SKILL_THRESHOLD` w `models.py`).
`--batch` (domyślnie 1000) kontroluje liczbę ofert na jedną transakcję importu.
`--vector-value` ustala wartość w wektorze: `binary` (1.0, domyślnie) lub
`probability` (zapisuje `match_score`).

> **Wymagane:** obraz Postgresa z pgvectorem (`pgvector/pgvector:pg16`, ustawiony
> w `docker-compose.yml`) oraz pakiet `pgvector` (w `requirements.txt`). Migracja
> `0002_skill_vector` włącza rozszerzenie (`CREATE EXTENSION vector`) i dodaje
> kolumny `vector_index` oraz `skill_vector`.

### Przebudowa wektorów dla już wczytanych ofert

Gdy oferty są już w bazie i nie chcesz ich wczytywać od nowa (np. po dodaniu
kolumny albo po ponownym zaindeksowaniu słownika), przelicz same wektory:

```bash
python manage.py build_skill_vectors                       # binary (1.0)
python manage.py build_skill_vectors --vector-value probability
```

---

## Przykładowe zapytania

```python
from apps.job_market.models import JobOffer, Skill, ExtractedSkills

# zbiór skilli jednej oferty (JSON)
offer.extracted.skills
# -> [{"skill_id": "KS...", "probability": 0.83}, ...]

# skille oferty z nazwami ze słownika
ids = [s["skill_id"] for s in offer.extracted.skills]
names = Skill.objects.filter(id__in=ids).values("id", "name", "main_category")

# oferty zawierające dany skill (zapytanie po JSON)
ExtractedSkills.objects.filter(skills__contains=[{"skill_id": "KS1235V5W7TM41LP3N70"}])

# same prawdziwe skille w słowniku (bez sztucznych kategorii)
Skill.objects.filter(is_category=False)

# --- wektor skilli oferty ---

# rzadki wektor oferty (pgvector SparseVector)
vec = offer.extracted.skill_vector
vec.indices()        # niezerowe pozycje, np. [0, 5, 128, ...]
vec.values()         # wartości w tych pozycjach, np. [1.0, 1.0, ...]
vec.dimensions()     # długość = liczba wszystkich skilli w słowniku

# indeks → skill (np. współrzędna nr 5)
Skill.objects.get(vector_index=5).name

# nazwy skilli, które oferta wymaga (z niezerowych pozycji wektora)
Skill.objects.filter(vector_index__in=vec.indices()).values("vector_index", "name")

# oferty najbardziej podobne skillowo (odległość kosinusowa na sparsevec)
from pgvector.django import CosineDistance
ExtractedSkills.objects.annotate(
    d=CosineDistance("skill_vector", offer.extracted.skill_vector)
).exclude(offer_id=offer.id).order_by("d")[:10]
```

## Jak wykonać feed danymi?
Potrzebna pliku data_en_processed.dsv (info o ofertach z wyeksportowanymi skillami)
oraz lightcast_data_formatted.csv z biblioteki ojd daps skills do mapowania skili i ich kategoryzacji
```
bash

cd /home/bison/career_advisor

# zatrzymaj i usuń wolumen Postgresa (czyści wszystkie stare artefakty)
sudo docker compose down -v

# postaw od nowa — migracje utworzą tabele w nowym kształcie
sudo docker compose up -d --build

# 1) słownik skilli
sudo docker compose exec backend python manage.py load_skills \
  /data/lightcast_data_formatted.csv /data/lightcast_hier_mapper.json

# 2) oferty + zbiór skilli w JSON (test na 100, potem pełny)
sudo docker compose exec backend python manage.py load_offers \
  /data/data_en_processed.csv --threshold 0.5 --limit 100

sudo docker compose exec backend python manage.py load_offers \
  /data/data_en_processed.csv --threshold 0.5
```