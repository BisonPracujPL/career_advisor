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

## Uruchomienie na maszynie GCP zespołu (dane już wgrane)

Jeśli pracujesz **bezpośrednio na maszynie GCP zespołu**, nie trzeba nic klonować, pobierać ani ładować od nowa — pliki danych (`data_en_processed.csv`, słowniki LightCast, `final_rag_pdfs/`) są już w katalogu projektu, baza jest wgrana w wolumenie Dockera `career_postgres_data`, a `.env` (z hasłami i `OPEN_ROUTER_API_KEY`) jest ustawiony. Zwykle aplikacja już działa.

1. Połącz się z maszyną (SSH lub Cursor Remote‑SSH) i wejdź do katalogu projektu:

```bash
cd /home/bison/career_advisor
```

2. Sprawdź, czy kontenery działają (na tej maszynie Docker wymaga `sudo`):

```bash
sudo docker compose ps
```

3. Jeśli nie działają — podnieś je (bez `--build`, obrazy już są; **bez** `-v`, żeby nie skasować bazy):

```bash
sudo docker compose up -d
```

4. Otwórz aplikację. Lokalnie na maszynie: `http://127.0.0.1:5173`. Zdalnie: **przekieruj porty 5173 i 8000** na swój komputer (SSH `-L` lub panel portów w Cursorze), a następnie wejdź na `http://localhost:5173`.

> **Nie uruchamiaj `docker compose down -v`** — flaga `-v` kasuje wolumen `career_postgres_data`, czyli całą wgraną bazę. Wtedy trzeba mieć pliki danych i powtórzyć ładowanie z instrukcji poniżej. Zwykły `down` (bez `-v`) jest bezpieczny.

---

## Jak uruchomić aplikację? (Instrukcja Krok po Kroku — świeża instalacja)

### Krok 1: Klonowanie i konfiguracja bazy

1. Sklonuj to repozytorium na swój komputer:

```bash
git clone https://github.com/BisonPracujPL/career_advisor.git
cd career_advisor
```

2. Skopiuj plik z przykładowymi zmiennymi środowiskowymi i uzupełnij w nim hasło do bazy danych oraz klucz OpenRouter:

```bash
cp .env.example .env
```

W pliku `.env` ustaw **`OPEN_ROUTER_API_KEY`** (klucz z https://openrouter.ai/) — bez niego czat doradcy oraz generowanie wizji ścieżki kariery nie działają (zwracają pusty wynik z komunikatem błędu).

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

2. Załadowanie bazy ofert pracy:
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

4. Indeks RAG (raporty PDF z `final_rag_pdfs/`) — wymagany, jeśli czat ma uziemiać odpowiedzi w raportach rynkowych:
```bash
docker compose exec backend python manage.py build_rag_index
```

5. (opcjonalnie) Przywrócenie angielskich nazw technologii w słowniku — wymaga pliku `lightcast_data_formatted.en.csv` w katalogu projektu:
```bash
docker compose exec backend python manage.py fix_skill_names
```

## Dostępne usługi

Gdy aplikacja działa, poszczególne panele znajdziesz pod adresami:

| Usługa | URL (Adres w przeglądarce) |
|---|---|
| **Frontend** | [http://127.0.0.1:5173](http://127.0.0.1:5173) |
| **API Backend** | [http://127.0.0.1:8000](http://127.0.0.1:8000) |
| **pgAdmin** (Zarządzanie Bazą) | [http://127.0.0.1:5050](http://127.0.0.1:5050) |

> **Wskazówka:** Na maszynie zdalnej (np. gdy używasz wirtualnej maszyny w Cursor) pamiętaj o przekierowaniu portów 5173 i 8000 na swój lokalny komputer.

> **Uwaga (bezpieczeństwo):** porty w `docker-compose.yml` są bindowane na `0.0.0.0`. Jeśli maszyna ma publiczny adres IP z otwartym firewallem, frontend (5173), API (8000) i pgAdmin (5050) będą dostępne publicznie **bez uwierzytelniania**. Na potrzeby dema udostępniaj aplikację przez tunel SSH / przekierowanie portów, a nie przez publiczny IP.

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

(Po tej operacji trzeba powtórzyć budowę i ładowanie z Kroków 2 i 3).
