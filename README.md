# Career Advisor

Dopasowanie ofert pracy do profilu kompetencji (Django + pgvector + React).

## Uruchomienie (tylko Docker)

```bash
cp .env.example .env   # uzupełnij hasła
docker compose up --build
```

| Usługa    | URL                      |
|-----------|--------------------------|
| Frontend  | http://127.0.0.1:5173    |
| API       | http://127.0.0.1:8000    |
| pgAdmin   | http://127.0.0.1:5050    |

Na maszynie zdalnej (np. VM w Cursor) przekieruj porty **5173** i **8000** na laptop.

### Pierwsze dane (w kontenerze backend)

```bash
docker compose exec backend python manage.py load_skills /data/lightcast_data_formatted.csv
docker compose exec backend python manage.py load_offers /data/data_en_processed.csv
```

Pliki CSV są zamontowane w `docker-compose.yml` (ścieżki w `/data/...`).

### Przydatne komendy

```bash
docker compose logs -f frontend
docker compose exec backend python manage.py test_skill_similarity --count 5
```

## Struktura

- `backend/` — Django REST API, matching wektorowy  
- `frontend/` — React (Vite), proxy `/api` → backend  
- `docker-compose.yml` — postgres, pgadmin, backend, frontend  

## Aktualizacja bazy do pełnej, polskiej wersji (Wszystkie oferty + Polskie skille)

Aby aplikacja posiadała wszystkie oferty z polskiego rynku pracy oraz poprawnie przetłumaczony słownik umiejętności (LightCast), należy zresetować bazę danych i załadować nowe pliki.

### 1. Skąd pobrać pliki z danymi?
Pliki z danymi są zbyt duże, aby przechowywać je w repozytorium kodu. Zanim zaczniesz, upewnij się, że masz je w głównym folderze projektu:

1. **Polski słownik LightCast** – wejdź na https://github.com/BisonPracujPL/OJD-DAPS-skills-polish- i pobierz stamtąd dwa pliki: `lightcast_data_formatted.csv` oraz `lightcast_hier_mapper.json`.
2. **Przetworzona baza ofert** – pobierz gotowy plik z ofertami i wygenerowanymi polskimi skillami (plik `data_en_processed.csv` polskiej wersji) z dysku: https://drive.google.com/file/d/1Hr4ZmL3h2_w9a1Zaf9v5jrcYGya4EQxA/view?usp=sharing.

*Wszystkie trzy pliki wrzuć luzem do głównego folderu projektu.*

### 2. Reset i przebudowa środowiska
Zatrzymaj kontenery i bezwarunkowo usuń stary wolumen bazy danych, aby pozbyć się starych ofert:

```bash
docker compose down -v
docker compose up -d --build

Następnie zbuduj tabele w bazie:
docker compose exec backend python manage.py migrate

### 3. Wgrywanie danych

Uruchom poniższe komendy jedna po drugiej:

A. Słownik umiejętności (LightCast):

```bash
docker compose exec backend python manage.py load_skills /data/lightcast_data_formatted.csv /data/lightcast_hier_mapper.json

B. Baza ofert pracy:

```bash
docker compose exec -e DEBUG=False backend python manage.py load_offers /data/data_en_processed.csv --threshold 0.5

C. Wektory i TD-IDF:

```bash
docker compose exec -e DEBUG=False backend python manage.py compute_skill_idf
docker compose exec -e DEBUG=False backend python manage.py build_skill_vectors --vector-value tfidf
docker compose exec -e DEBUG=False backend python manage.py embed_offers