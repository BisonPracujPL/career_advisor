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
