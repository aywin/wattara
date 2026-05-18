# Wattara

Application de suivi local des coupures d'electricite: signalements citoyens, coupures officielles, confirmations et carte des zones.

## Structure

- `backend/`: API FastAPI, SQLAlchemy, Alembic.
- `frontend/`: application Next.js.

## Configuration

1. Copier les fichiers d'exemple:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

2. Renseigner au minimum:

- `backend/.env`: `DATABASE_URL`, `SECRET_KEY`.
- `frontend/.env.local`: `NEXT_PUBLIC_API_URL`.

`SECRET_KEY` doit etre une valeur longue et aleatoire. Ne commitez jamais les fichiers `.env` ni les cles de service.

## Lancer le backend

```bash
cd backend
uvicorn app.main:app --reload
```

Documentation API:

- Swagger: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

## Lancer le frontend

```bash
cd frontend
npm install
npm run dev
```

Application: `http://localhost:3000`

## Roles et securite

- Les utilisateurs crees via l'inscription publique ont le role `user`.
- Les operations sensibles de gestion des zones, regions, utilisateurs et coupures officielles demandent un role `admin`.
- Les signalements et confirmations utilisent maintenant le token JWT au lieu d'un `user_id` passe dans l'URL.

## Verifications

Frontend:

```bash
cd frontend
npm run lint
npx tsc --noEmit
```

Backend:

```bash
cd backend
python -m compileall app
```

Si une cle de service a deja ete exposee dans le projet, elle doit etre revoquee/regeneree cote fournisseur.
