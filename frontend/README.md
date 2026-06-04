# Frontend (React + Vite)

## Docker (zalecane — cały projekt)

Z katalogu głównego repozytorium:

```bash
docker compose up --build
```

- UI: http://127.0.0.1:5173  
- API: proxy Vite w kontenerze `frontend` → `http://backend:8000`  
- Przeglądarka woła `/api/...` na porcie 5173 (bez CORS do osobnego hosta)

## Lokalnie (bez kontenera frontendu)

```bash
cd frontend
npm install
VITE_PROXY_TARGET=http://127.0.0.1:8000 npm run dev
```

Backend musi działać (`docker compose up backend` lub lokalny Django na :8000).
