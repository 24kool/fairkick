from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import services
from .schemas import TeamRequest, TeamResponse

app = FastAPI(title="fairkick API", version="0.1.0")

# CORS 설정 - Firebase Hosting에서 접근 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 배포 후 Firebase URL로 제한 가능
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/generate", response_model=TeamResponse)
async def generate_teams(payload: TeamRequest) -> TeamResponse:
    players_by_id = {player.id: player for player in payload.players}

    try:
        green_captain = players_by_id[payload.green_captain_id]
        orange_captain = players_by_id[payload.orange_captain_id]
    except KeyError as exc:  # pragma: no cover - defensive safety
        raise HTTPException(status_code=400, detail="Captains must exist in provided players") from exc

    if green_captain.id == orange_captain.id:
        raise HTTPException(status_code=400, detail="Captains must be different players")

    result = services.assign_balanced(payload.players, green_captain, orange_captain)
    return TeamResponse(**result)
