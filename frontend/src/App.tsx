import { useMemo, useState } from "react";
import { Shuffle, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type Player = {
  id: string;
  name: string;
  rating: number;
};

type TeamAssignment = {
  green: Player[];
  orange: Player[];
};

type TeamTally = {
  green: number;
  orange: number;
  gap: number;
  message: string;
};

const RATING_LEVELS = [
  { value: 3, label: "Pro", helper: "High-level competitive experience" },
  { value: 2, label: "Advanced", helper: "Strong pickup contributor" },
  { value: 1, label: "Casual", helper: "Plays regularly for fun" },
  { value: 0, label: "New", helper: "Learning the ropes" },
];

const DEFAULT_PLAYERS: Player[] = [
  { id: "p1", name: "Juho", rating: 3 },
  { id: "p2", name: "Erae", rating: 3 },
  { id: "p3", name: "Jihan", rating: 3 },
  { id: "p4", name: "Donghyeon", rating: 3 },
  { id: "p5", name: "KC", rating: 1 },
  { id: "p6", name: "Subin", rating: 2 },
  { id: "p7", name: "Soonhyeong", rating: 2 },
  { id: "p8", name: "Taebaek", rating: 1 },
  { id: "p9", name: "Kyeongoh", rating: 2 },
  { id: "p10", name: "Seungyoon", rating: 1 },
  { id: "p11", name: "Jaebak", rating: 2 },
  { id: "p12", name: "Jaekyeong", rating: 2 },
  { id: "p13", name: "Hongjik", rating: 2 },
  { id: "p14", name: "Taehyeon", rating: 1 },
  { id: "p15", name: "Jonghyeop", rating: 1 },
  { id: "p16", name: "Hyeonggeun", rating: 2 },
  { id: "p17", name: "Jaehoon", rating: 2 },
  { id: "p18", name: "Taekang", rating: 1 },
];

const FAIRNESS_MESSAGES = [
  { threshold: 0, message: "Perfectly balanced – as all things should be." },
  { threshold: 1, message: "Teams look tight! Expect a competitive match." },
  { threshold: 2, message: "Slight edge to one side, but still playable." },
  { threshold: Number.POSITIVE_INFINITY, message: "Wide gap detected – consider a quick reshuffle." },
];

function ratingLabel(value: number) {
  return RATING_LEVELS.find((level) => level.value === value)?.label ?? `Level ${value}`;
}

function pickFairnessMessage(gap: number) {
  return FAIRNESS_MESSAGES.find((option) => gap <= option.threshold)?.message ?? "";
}

function shufflePlayers(players: Player[]) {
  const clone = [...players];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function totalRating(players: Player[]) {
  return players.reduce((sum, player) => sum + player.rating, 0);
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";
const SHOULD_USE_API = API_BASE_URL.length > 0;

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const [players, setPlayers] = useState<Player[]>(DEFAULT_PLAYERS);
  const [greenCaptainId, setGreenCaptainId] = useState<string | null>(
    DEFAULT_PLAYERS[0]?.id ?? null,
  );
  const [orangeCaptainId, setOrangeCaptainId] = useState<string | null>(
    DEFAULT_PLAYERS[1]?.id ?? null,
  );
  const [activeTeams, setActiveTeams] = useState<TeamAssignment | null>(null);
  const [lastTally, setLastTally] = useState<TeamTally | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerRating, setNewPlayerRating] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const availablePlayers = useMemo(() => {
    return [...players].sort((a, b) => b.rating - a.rating);
  }, [players]);

  const summary = useMemo(() => {
    const squadSize = players.length;
    const total = players.reduce((sum, player) => sum + player.rating, 0);
    const averageValue = squadSize > 0 ? total / squadSize : 0;
    const rounded = Math.round(averageValue);
    return {
      squadSize,
      averageValue,
      averageLabel: ratingLabel(rounded),
    };
  }, [players]);

  const selectedCaptainIds = useMemo(
    () => new Set([greenCaptainId, orangeCaptainId].filter(Boolean) as string[]),
    [greenCaptainId, orangeCaptainId],
  );

  function handleAddPlayer() {
    if (!newPlayerName.trim()) {
      setErrorMessage("Player name is required.");
      return;
    }

    const alreadyExists = players.some(
      (player) => player.name.toLowerCase() === newPlayerName.trim().toLowerCase(),
    );

    if (alreadyExists) {
      setErrorMessage("That player is already in your pool.");
      return;
    }

    const newPlayer: Player = {
      id: generateId(),
      name: newPlayerName.trim(),
      rating: newPlayerRating,
    };
    setPlayers((prev) => [...prev, newPlayer]);
    setNewPlayerName("");
    setNewPlayerRating(1);
    setErrorMessage("");
  }

  function handleRemovePlayer(playerId: string) {
    setPlayers((prev) => prev.filter((player) => player.id !== playerId));
    if (playerId === greenCaptainId) {
      setGreenCaptainId(null);
    }
    if (playerId === orangeCaptainId) {
      setOrangeCaptainId(null);
    }
    setActiveTeams(null);
    setLastTally(null);
  }

  function handleUpdatePlayerRating(playerId: string, rating: number) {
    setPlayers((prev) =>
      prev.map((player) => (player.id === playerId ? { ...player, rating } : player)),
    );
  }

  async function handleGenerateTeams() {
    if (!greenCaptainId || !orangeCaptainId) {
      setErrorMessage("Select a captain for each team before generating lineups.");
      return;
    }

    if (greenCaptainId === orangeCaptainId) {
      setErrorMessage("Captains must be different players.");
      return;
    }

    setErrorMessage("");

    const greenCaptain = players.find((player) => player.id === greenCaptainId);
    const orangeCaptain = players.find((player) => player.id === orangeCaptainId);

    if (!greenCaptain || !orangeCaptain) {
      setErrorMessage("Captains must be part of the player pool.");
      return;
    }

    if (SHOULD_USE_API) {
      try {
        const response = await fetch(`${API_BASE_URL}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            players: players.map((player) => ({
              id: player.id,
              name: player.name,
              rating: player.rating,
            })),
            green_captain_id: greenCaptainId,
            orange_captain_id: orangeCaptainId,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.detail ?? "Failed to generate teams");
        }

        const payload = await response.json();
        const greenTeam: Player[] = payload.green;
        const orangeTeam: Player[] = payload.orange;
        const tally: TeamTally = {
          green: payload.green_total,
          orange: payload.orange_total,
          gap: payload.rating_gap,
          message: payload.message ?? pickFairnessMessage(payload.rating_gap),
        };

        setActiveTeams({ green: greenTeam, orange: orangeTeam });
        setLastTally(tally);
        return;
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "API request failed");
        return;
      }
    }

    const bench = players.filter((player) => !selectedCaptainIds.has(player.id));
    const shuffled = shufflePlayers(bench);

    const totalPlayersCount = players.length;
    const greenTargetCount = Math.ceil(totalPlayersCount / 2);
    const orangeTargetCount = Math.floor(totalPlayersCount / 2);

    const green: Player[] = [greenCaptain];
    const orange: Player[] = [orangeCaptain];

    shuffled.forEach((player) => {
      if (green.length >= greenTargetCount) {
        orange.push(player);
        return;
      }

      if (orange.length >= orangeTargetCount) {
        green.push(player);
        return;
      }

      const greenTotal = totalRating(green);
      const orangeTotal = totalRating(orange);

      if (greenTotal === orangeTotal) {
        const target = Math.random() < 0.5 ? green : orange;
        target.push(player);
        return;
      }

      if (greenTotal < orangeTotal) {
        green.push(player);
      } else {
        orange.push(player);
      }
    });

    const greenTotal = totalRating(green);
    const orangeTotal = totalRating(orange);
    const gap = Math.abs(greenTotal - orangeTotal);
    const tally: TeamTally = {
      green: greenTotal,
      orange: orangeTotal,
      gap,
      message: pickFairnessMessage(gap),
    };

    setActiveTeams({ green, orange });
    setLastTally(tally);
  }

  function handleResetTeams() {
    setActiveTeams(null);
    setLastTally(null);
    setErrorMessage("");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-4 pb-16 pt-12">
      <header className="flex flex-col gap-6 rounded-3xl border border-border bg-card/80 p-8 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-2">
          <Badge variant="success" className="w-fit">
            fairkick
          </Badge>
          <h1 className="text-4xl font-bold md:text-5xl">아재FC✌🏻-Balance pickup games in seconds.</h1>
          <p className="text-lg text-muted-foreground md:w-3/4">
            Fairkick lets you capture player skill, lock in captains, and auto-build Green and
            Orange squads that feel balanced. Keep the flow, skip the squabbling.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 rounded-full border border-border px-4 py-1.5">
            <Users className="h-4 w-4 text-primary" />
            {summary.squadSize} players registered
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border px-4 py-1.5">
            <Shuffle className="h-4 w-4 text-secondary" />
            Avg tier {summary.averageLabel} ({summary.averageValue.toFixed(1)} pts)
          </div>
        </div>
      </header>

      <main className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Player pool</CardTitle>
              <CardDescription>
                Add your squad, tag each player as Pro, Advanced, Casual, or New, then pick your
                captains.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 rounded-2xl border border-dashed border-border p-6">
                <div className="grid gap-2">
                  <Label htmlFor="player-name">Player name</Label>
                  <Input
                    id="player-name"
                    placeholder="e.g. Sam"
                    value={newPlayerName}
                    onChange={(event) => setNewPlayerName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddPlayer();
                      }
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="player-rating">Skill tier</Label>
                  <select
                    id="player-rating"
                    className="h-11 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={newPlayerRating}
                    onChange={(event) => setNewPlayerRating(Number(event.target.value))}
                  >
                    {RATING_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {RATING_LEVELS.find((level) => level.value === newPlayerRating)?.helper}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleAddPlayer}>Add player</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setNewPlayerName("");
                      setNewPlayerRating(1);
                      setErrorMessage("");
                    }}
                  >
                    Clear
                  </Button>
                </div>
                {errorMessage ? (
                  <p className="text-sm font-medium text-destructive">{errorMessage}</p>
                ) : null}
              </div>

              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Manage roster</h2>
                <div className="flex flex-col gap-3">
                  {availablePlayers.map((player) => {
                    const isCaptain = selectedCaptainIds.has(player.id);
                    return (
                      <div
                        key={player.id}
                        className={cn(
                          "flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background/80 p-4 transition hover:border-primary/60",
                          isCaptain && "border-primary/70 bg-primary/5",
                        )}
                      >
                        <div className="flex flex-1 flex-col gap-1">
                          <span className="font-medium">{player.name}</span>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>Tier:</span>
                            <select
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              value={player.rating}
                              onChange={(event) =>
                                handleUpdatePlayerRating(player.id, Number(event.target.value))
                              }
                            >
                              {RATING_LEVELS.map((level) => (
                                <option key={level.value} value={level.value}>
                                  {level.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={player.id === greenCaptainId ? "green" : player.id === orangeCaptainId ? "orange" : ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (value === "green") {
                                setGreenCaptainId(player.id);
                                if (player.id === orangeCaptainId) {
                                  setOrangeCaptainId(null);
                                }
                              } else if (value === "orange") {
                                setOrangeCaptainId(player.id);
                                if (player.id === greenCaptainId) {
                                  setGreenCaptainId(null);
                                }
                              } else {
                                if (player.id === greenCaptainId) {
                                  setGreenCaptainId(null);
                                }
                                if (player.id === orangeCaptainId) {
                                  setOrangeCaptainId(null);
                                }
                              }
                            }}
                          >
                            <option value="">No captain role</option>
                            <option value="green">Green captain</option>
                            <option value="orange">Orange captain</option>
                          </select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemovePlayer(player.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {availablePlayers.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      Start by adding at least four players to build teams.
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Captains</CardTitle>
              <CardDescription>
                Assign a captain to each side. Fairkick keeps captains locked to their teams when
                shuffling.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="green-captain">Green captain</Label>
                  <select
                    id="green-captain"
                    className="h-11 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={greenCaptainId ?? ""}
                    onChange={(event) => setGreenCaptainId(event.target.value || null)}
                  >
                    <option value="" disabled>
                      Select player
                    </option>
                    {players.map((player) => (
                      <option key={player.id} value={player.id} disabled={player.id === orangeCaptainId}>
                        {player.name} (rating {player.rating})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="orange-captain">Orange captain</Label>
                  <select
                    id="orange-captain"
                    className="h-11 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={orangeCaptainId ?? ""}
                    onChange={(event) => setOrangeCaptainId(event.target.value || null)}
                  >
                    <option value="" disabled>
                      Select player
                    </option>
                    {players.map((player) => (
                      <option key={player.id} value={player.id} disabled={player.id === greenCaptainId}>
                        {player.name} (rating {player.rating})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap gap-3">
                <Button className="flex-1" onClick={handleGenerateTeams}>
                  Generate teams
                </Button>
                <Button className="flex-1" variant="outline" onClick={handleResetTeams}>
                  Reset
                </Button>
              </div>

              {lastTally ? (
                <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
                  <p className="font-semibold text-primary">
                    Balance check: gap of {lastTally.gap} tier points.
                  </p>
                  <p className="text-muted-foreground">{lastTally.message}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <div className="rounded-xl border border-primary/30 bg-background/70 p-3 text-center">
                      <p className="font-semibold text-primary">Green total</p>
                      <p className="text-2xl font-bold text-primary">{lastTally.green}</p>
                    </div>
                    <div className="rounded-xl border border-secondary/30 bg-background/70 p-3 text-center">
                      <p className="font-semibold text-secondary">Orange total</p>
                      <p className="text-2xl font-bold text-secondary">{lastTally.orange}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Lock captains and hit generate to preview lineups.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lineups</CardTitle>
              <CardDescription>
                Captains stay fixed. Everyone else shuffles into even teams with each generate.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              {activeTeams ? (
                <div className="grid gap-4">
                  <TeamList
                    title="Green"
                    accent="bg-emerald-500/15 text-emerald-700"
                    players={activeTeams.green}
                    total={lastTally?.green ?? 0}
                  />
                  <TeamList
                    title="Orange"
                    accent="bg-orange-500/15 text-orange-700"
                    players={activeTeams.orange}
                    total={lastTally?.orange ?? 0}
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
                  <p>No teams yet. Once you generate, they will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="mb-10 text-center text-sm text-muted-foreground">
        Built with React, Tailwind, and shadcn-inspired components.
      </footer>
    </div>
  );
}

type TeamListProps = {
  title: string;
  players: Player[];
  total: number;
  accent: string;
};

function TeamList({ title, players, total, accent }: TeamListProps) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex h-8 min-w-[3.5rem] items-center justify-center rounded-full text-sm font-semibold",
              accent,
            )}
          >
            {title}
          </span>
          <p className="text-sm text-muted-foreground">{players.length} players</p>
        </div>
        <div className="text-right text-xs uppercase tracking-wide text-muted-foreground">
          <p>Total tier points</p>
          <p className="text-xl font-semibold text-foreground">{total}</p>
        </div>
      </div>
      <ul className="mt-4 grid gap-2">
        {players.map((player) => (
          <li
            key={player.id}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-card/70 px-4 py-2 text-sm"
          >
            <span className="font-medium">{player.name}</span>
            <span className="text-xs text-muted-foreground">
              {ratingLabel(player.rating)} · {player.rating} pts
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
