from __future__ import annotations

from pydantic import BaseModel, Field, conlist


class Player(BaseModel):
    id: str = Field(..., description="Unique identifier for a player")
    name: str = Field(..., min_length=1, max_length=50)
    rating: float = Field(
        ...,
        ge=0,
        le=3,
        description="Tier points: New=0, Casual=1, Advanced=2, Elite=2.5, Pro=3",
    )


class TeamRequest(BaseModel):
    players: conlist(Player, min_length=2)
    green_captain_id: str
    orange_captain_id: str


class TeamResponse(BaseModel):
    green: list[Player]
    orange: list[Player]
    green_total: float
    orange_total: float
    rating_gap: float
    message: str
