# Career Advisor 

Aplikacja wspomagająca dopasowanie ofert pracy do profilu kompetencji kandydata. Wykorzystuje wektoryzację i analizę języka (pgvector) oraz intuicyjny interfejs.

**Technologie:** Django, pgvector (PostgreSQL), React (Vite), Docker.

---

## Struktura projektu

* `backend/` — Django REST API, logika dopasowywania (wektoryzacja)
* `frontend/` — Aplikacja w React (Vite), proxy dla API `/api` -> backend
* `scripts/` — Skrypty pomocnicze
* `docker-compose.yml` — Konfiguracja wszystkich kontenerów

---

## Jak uruchomić aplikację? (Instrukcja Krok po Kroku)

### Krok 1: Klonowanie i konfiguracja bazy
1. Sklonuj to repozytorium na swój komputer:
   ```bash
   git clone https://github.com/BisonPracujPL/career_advisor.git
   cd career_advisor

2. Skopiuj plik z przykładowymi zmiennymi środowiskowymi. Uzupełnij w nim hasło do bazy danych:
    ```bash
    cp .env.example .env

### Krok 2: Budowa i uruchomienie środowiska

1. Uruchom kontenery w tle. Za pierwszym razem Docker zbuduje wszystkie potrzebne obrazy:

```bash
docker compose up -d --build
```


2. Gdy kontenery wstaną, zbuduj tabele w bazie danych (migracje):
```bash
docker compose exec backend python manage.py migrate
```

### Krok 3: Wgrywanie danych początkowych
Teraz wczytaj zebrane wcześniej pliki z danymi do bazy. Uruchom te komendy jedna po drugiej:

1. Załadowanie słownika umiejętności (LightCast):
```bash
docker compose exec backend python manage.py load_skills /data/lightcast_data_formatted.csv /data/lightcast_hier_mapper.json
```

2.Załadowanie bazy ofert pracy:
```bash
docker compose exec -e DEBUG=False backend python manage.py load_offers /data/data_en_processed.csv --threshold 0.5
```

3. Obliczenia dla modelu i wektoryzacja skilli:
```bash
docker compose exec -e DEBUG=False backend python manage.py compute_skill_idf
```

```bash
docker compose exec -e DEBUG=False backend python manage.py build_skill_vectors --vector-value tfidf
```  

```bash
docker compose exec -e DEBUG=False backend python manage.py embed_offers
```

## Dostępne usługi

Gdy aplikacja działa, poszczególne panele znajdziesz pod adresami:

| Usługa | URL (Adres w przeglądarce) |
|---|---|
| **Frontend** | [http://127.0.0.1:5173](http://127.0.0.1:5173) |
| **API Backend** | [http://127.0.0.1:8000](http://127.0.0.1:8000) |
| **pgAdmin** (Zarządzanie Bazą) | [http://127.0.0.1:5050](http://127.0.0.1:5050) |
Wskazówka: Na maszynie zdalnej (np. gdy używasz wirtualnej maszyny w Cursor) pamiętaj o przekierowaniu portów 5173 i 8000 na swój lokalny komputer.

## Przydatne komendy

1. Podgląd logów Frontendu (na żywo)
```bash
docker compose logs -f frontend
```

2. Testowanie wektorowego dopasowywania skilli
```bash
docker compose exec backend python manage.py test_skill_similarity --count 5
```

3. Restart i twarde czyszczenie bazy (usunięcie starych danych)
```bash
docker compose down -v
```

(Po tej operacji trzeba powtórzyć budowę i ładowanie z Kroków 3 i 4).
