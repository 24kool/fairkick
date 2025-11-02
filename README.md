# fairkick

Fairkick helps balance pickup soccer games by locking in team captains and shuffling the
remaining players into Green and Orange squads. The project ships with a React + Vite frontend
and an optional FastAPI backend for server-side team generation.

## Project layout

```
.
├── frontend/   # React + TypeScript + Tailwind UI
└── backend/    # FastAPI service for team generation
```

## Frontend

The frontend is built with Vite, React, TypeScript, Tailwind CSS, and shadcn-inspired primitives.

```bash
cd frontend
npm install
npm run dev
```

If you want the UI to call the FastAPI backend, expose the API URL via `VITE_API_BASE_URL`:

```bash
# .env.local
VITE_API_BASE_URL=http://127.0.0.1:8000
```

When the variable is unset, the UI falls back to running the team-balancing algorithm in the
browser.

## Backend

The backend exposes a `/generate` endpoint that applies the same balancing rules. Install the
requirements and run the development server with Uvicorn:

```bash
cd backend
conda create -n fairkick python=3.11
conda activate fairkick
pip install -e .
uvicorn app.main:app --reload
```

Run tests with:

```bash
pytest
```

## How it works

1. Add players and assign a tier (Pro, Advanced, Casual, New).
2. Choose captains for the Green and Orange teams.
3. Generate lineups. Captains stay fixed while the remaining players randomize into squads.
4. Fairkick reports the total tier points per team and highlights the difference so you can
   decide whether to reshuffle.

The balancing logic alternates players between teams, always giving the lower-rated team the next
pick while preserving randomness when the scores are tied.
