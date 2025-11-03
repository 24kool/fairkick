import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Shuffle, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type FlowStep = "players" | "captains" | "generate" | "results";

const RATING_LEVELS = [
  { value: 3, label: "Pro", helper: "High-level competitive experience" },
  { value: 2.5, label: "Elite", helper: "Between pro and advanced, consistently sharp" },
  { value: 2, label: "Advanced", helper: "Strong pickup contributor" },
  { value: 1, label: "Casual", helper: "Plays regularly for fun" },
  { value: 0, label: "New", helper: "Learning the ropes" },
];

const DEFAULT_PLAYERS: Player[] = [
  { id: "p1", name: "유주호", rating: 2 },
  { id: "p2", name: "이이레", rating: 2 },
  { id: "p3", name: "윤지한", rating: 2 },
  { id: "p4", name: "서동현", rating: 2 },
  { id: "p5", name: "김경철", rating: 2 },
  { id: "p6", name: "박수빈", rating: 2 },
  { id: "p7", name: "김태강", rating: 2 },
  { id: "p8", name: "김종진", rating: 2 },
  { id: "p9", name: "Hank", rating: 2 },
  { id: "p10", name: "이재박", rating: 2 },
  { id: "p11", name: "한승훈", rating: 2 },
  { id: "p12", name: "황순형", rating: 2 },
  { id: "p13", name: "Juan", rating: 2 },
  { id: "p14", name: "Devin", rating: 2 },
  { id: "p15", name: "Saya", rating: 2 },
  { id: "p16", name: "지형근", rating: 2 },
  { id: "p17", name: "김민중", rating: 2 },
  { id: "p18", name: "송경호", rating: 2 },
  { id: "p19", name: "Lazaro", rating: 2 },
  { id: "p20", name: "주승열", rating: 2 },
  { id: "p21", name: "정동영", rating: 2 },   
  { id: "p22", name: "최창현", rating: 2 },
  { id: "p23", name: "이제경", rating: 2 },
  { id: "p24", name: "이건웅", rating: 2 },
  { id: "p25", name: "전상구", rating: 2 },
  { id: "p26", name: "황한얼", rating: 2 },
  { id: "p27", name: "김동일", rating: 2 },
  { id: "p28", name: "최재훈", rating: 2 },
  { id: "p29", name: "이홍직", rating: 2 },
  { id: "p30", name: "이승윤", rating: 2 },
  { id: "p31", name: "서순신", rating: 2 },
  { id: "p32", name: "Yusuke", rating: 2 },
  { id: "p33", name: "이종협", rating: 2 },
  { id: "p34", name: "Sean", rating: 2 },
  { id: "p35", name: "임태현", rating: 2 },
];

const FAIRNESS_MESSAGES = [
  { threshold: 0, message: "Perfectly balanced – as all things should be." },
  { threshold: 1, message: "Teams look tight! Expect a competitive match." },
  { threshold: 2, message: "Slight edge to one side, but still playable." },
  { threshold: Number.POSITIVE_INFINITY, message: "Wide gap detected – consider a quick reshuffle." },
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";
const SHOULD_USE_API = API_BASE_URL.length > 0;
const MIN_PLAYERS_REQUIRED = 4;

function ratingLabel(value: number) {
  return RATING_LEVELS.find((level) => level.value === value)?.label ?? `Level ${value}`;
}

function closestRatingLabel(value: number) {
  const closest = RATING_LEVELS.reduce((best, level) => {
    const bestDelta = Math.abs(best.value - value);
    const levelDelta = Math.abs(level.value - value);
    if (levelDelta < bestDelta) {
      return level;
    }
    if (levelDelta === bestDelta && level.value > best.value) {
      return level;
    }
    return best;
  }, RATING_LEVELS[0]);
  return closest.label;
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

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const [allPlayers, setAllPlayers] = useState<Player[]>(DEFAULT_PLAYERS);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [greenCaptainId, setGreenCaptainId] = useState<string | null>(null);
  const [orangeCaptainId, setOrangeCaptainId] = useState<string | null>(null);
  const [activeTeams, setActiveTeams] = useState<TeamAssignment | null>(null);
  const [lastTally, setLastTally] = useState<TeamTally | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerRating, setNewPlayerRating] = useState<number>(1);
  const [formError, setFormError] = useState("");
  const [flowError, setFlowError] = useState("");
  const [currentStep, setCurrentStep] = useState<FlowStep | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const generationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rosterScrollRef = useRef<HTMLDivElement | null>(null);
  const stepOneFooterRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolledFooterRef = useRef(false);

  const players = useMemo(
    () => allPlayers.filter((player) => selectedPlayerIds.includes(player.id)),
    [allPlayers, selectedPlayerIds],
  );
  const rosterPlayers = allPlayers;

  const summary = useMemo(() => {
    const squadSize = players.length;
    const total = players.reduce((sum, player) => sum + player.rating, 0);
    const averageValue = squadSize > 0 ? total / squadSize : 0;
    return {
      squadSize,
      averageValue,
      averageLabel: closestRatingLabel(averageValue),
    };
  }, [players]);

  const selectedCaptainIds = useMemo(
    () => new Set([greenCaptainId, orangeCaptainId].filter(Boolean) as string[]),
    [greenCaptainId, orangeCaptainId],
  );

  const isFlowOpen = currentStep !== null;

  useEffect(() => {
    return () => {
      if (generationTimerRef.current) {
        clearTimeout(generationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentStep !== "players") {
      hasAutoScrolledFooterRef.current = false;
      return;
    }

    hasAutoScrolledFooterRef.current = false;

    const container = rosterScrollRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      if (!container || hasAutoScrolledFooterRef.current) {
        return;
      }

      const reachedBottom =
        container.scrollTop + container.clientHeight >= container.scrollHeight - 32;

      if (reachedBottom) {
        hasAutoScrolledFooterRef.current = true;
        stepOneFooterRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    };

    container.addEventListener("scroll", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [currentStep, rosterPlayers.length]);

  function clearGenerationTimer() {
    if (generationTimerRef.current) {
      clearTimeout(generationTimerRef.current);
      generationTimerRef.current = null;
    }
  }

  function openFlow(step: FlowStep = "players") {
    setFormError("");
    setFlowError("");
    setCurrentStep(step);
  }

  function handleCloseFlow() {
    clearGenerationTimer();
    setCurrentStep(null);
    setIsGenerating(false);
    setFlowError("");
  }

  function handleReturnHome() {
    handleCloseFlow();
    setSelectedPlayerIds([]);
    setGreenCaptainId(null);
    setOrangeCaptainId(null);
    setActiveTeams(null);
    setLastTally(null);
    setFormError("");
    setFlowError("");
    setNewPlayerName("");
    setNewPlayerRating(1);
    setIsAddPlayerModalOpen(false);
  }

  function handleAddPlayer() {
    if (!newPlayerName.trim()) {
      setFormError("Player name is required.");
      return false;
    }

    const alreadyExists = allPlayers.some(
      (player) => player.name.toLowerCase() === newPlayerName.trim().toLowerCase(),
    );

    if (alreadyExists) {
      setFormError("That player is already in your pool.");
      return false;
    }

    const newPlayer: Player = {
      id: generateId(),
      name: newPlayerName.trim(),
      rating: newPlayerRating,
    };

    setAllPlayers((prev) => [...prev, newPlayer]);
    setSelectedPlayerIds((prev) => [...prev, newPlayer.id]);
    setNewPlayerName("");
    setNewPlayerRating(1);
    setFormError("");
    setFlowError("");
    setActiveTeams(null);
    setLastTally(null);
    return true;
  }

  function handleUpdatePlayerRating(playerId: string, rating: number) {
    setAllPlayers((prev) =>
      prev.map((player) => (player.id === playerId ? { ...player, rating } : player)),
    );
  }

  function handleTogglePlayerSelection(playerId: string) {
    setSelectedPlayerIds((prev) => {
      if (prev.includes(playerId)) {
        if (playerId === greenCaptainId) {
          setGreenCaptainId(null);
        }
        if (playerId === orangeCaptainId) {
          setOrangeCaptainId(null);
        }
        setActiveTeams(null);
        setLastTally(null);
        return prev.filter((id) => id !== playerId);
      }
      setActiveTeams(null);
      setLastTally(null);
      return [...prev, playerId];
    });
    setFlowError("");
  }

  async function handleGenerateTeams(): Promise<boolean> {
    if (!greenCaptainId || !orangeCaptainId) {
      setFlowError("Select a captain for each team before generating lineups.");
      return false;
    }

    if (greenCaptainId === orangeCaptainId) {
      setFlowError("Captains must be different players.");
      return false;
    }

    setFlowError("");

    const greenCaptain = players.find((player) => player.id === greenCaptainId);
    const orangeCaptain = players.find((player) => player.id === orangeCaptainId);

    if (!greenCaptain || !orangeCaptain) {
      setFlowError("Captains must be part of the player pool.");
      return false;
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
        return true;
      } catch (error) {
        setFlowError(error instanceof Error ? error.message : "API request failed");
        return false;
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
    return true;
  }

  async function triggerGeneration(autoNavigate = true) {
    if (isGenerating) {
      return;
    }

    clearGenerationTimer();
    setFlowError("");
    setIsGenerating(true);

    const start = performance.now();
    const success = await handleGenerateTeams();
    const elapsed = performance.now() - start;
    const waitTime = Math.max(0, 2000 - elapsed);

    generationTimerRef.current = setTimeout(() => {
      setIsGenerating(false);
      if (success && autoNavigate) {
        setCurrentStep("results");
      }
      generationTimerRef.current = null;
    }, waitTime);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-4 pb-16 pt-12">
      <header className="flex flex-col gap-6 rounded-3xl border border-border bg-card/80 p-8 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-2">
          <Badge variant="success" className="w-fit">
            fairkick
          </Badge>
          <div className="flex items-center gap-4">
            <img src="/aj_logo.png" alt="아재FC 로고" className="h-12 w-12 md:h-16 md:w-16" />
            <h2 className="text-4xl font-bold md:text-5xl">AZFC Team Generator</h2>
          </div>
          <p className="text-lg text-muted-foreground md:w-3/4">
            Launch the guided flow to add players, lock in captains, and generate balanced squads –
            one focused step at a time.
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

      <main className="grid gap-8">
        <Card>
          <CardContent className="flex justify-center py-12">
            <Button size="lg" className="min-w-[220px]" onClick={() => openFlow("players")}>
              Start
            </Button>
          </CardContent>
        </Card>
      </main>

      <footer className="mb-10 text-center text-sm text-muted-foreground">
        아재 FC Since 2022
      </footer>

      <Dialog open={isFlowOpen} onOpenChange={(open) => (!open ? handleCloseFlow() : undefined)}>
        <DialogContent>
          {currentStep === "players" ? (
            <>
              <DialogHeader>
                <DialogTitle>Step 1 of 3 · Select players</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Roster</h2>
                    <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setFormError("");
                            setNewPlayerName("");
                            setNewPlayerRating(1);
                            setIsAddPlayerModalOpen(true);
                          }}
                        >
                          + Add
                        </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tap a player to toggle them into the session. Selected players highlight in blue.
                  </p>
                  <div
                    ref={rosterScrollRef}
                    className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1"
                  >
                    {rosterPlayers.map((player) => {
                      const isSelected = selectedPlayerIds.includes(player.id);
                      return (
                        <div
                          key={player.id}
                          className={cn(
                            "rounded-2xl border border-border bg-background/80 p-4 transition",
                            isSelected && "border-blue-500/60 bg-blue-500/10",
                          )}
                        >
                          <div className="flex flex-wrap items-start gap-3">
                            <button
                              type="button"
                              onClick={() => handleTogglePlayerSelection(player.id)}
                              className="flex flex-1 flex-col items-start gap-1 text-left"
                            >
                              <span className="font-medium text-foreground">{player.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {isSelected ? "" : "Tap to include"}
                              </span>
                            </button>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {isSelected ? (
                                <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                                  Selected
                                </span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <select
                                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div ref={stepOneFooterRef}>
                <DialogFooter className="flex-col gap-3">
                  <div className="flex flex-col gap-2 w-full text-sm">
                    <span className="text-md font-semibold text-foreground">
                      Total {players.length} players
                    </span>
                    {flowError ? (
                      <span className="font-medium text-destructive">{flowError}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-center gap-2 w-full">
                    <Button variant="ghost" size="lg" onClick={handleCloseFlow}>
                      Cancel
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => {
                        if (players.length < MIN_PLAYERS_REQUIRED) {
                          setFlowError(
                            `Add at least ${MIN_PLAYERS_REQUIRED} players to move to the next step.`,
                          );
                          return;
                        }
                        setFlowError("");
                        setCurrentStep("captains");
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </DialogFooter>
              </div>
            </>
          ) : null}

          {currentStep === "captains" ? (
            <>
              <DialogHeader>
                <DialogTitle>Step 2 of 3 · Select captains</DialogTitle>
                <DialogDescription>
                  Lock in one Blue and one Orange captain. They stay fixed when teams generate.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid gap-4 rounded-2xl border border-dashed border-border p-6">
                  <div className="grid gap-2">
                    <Label htmlFor="green-captain">Blue captain</Label>
                    <select
                      id="green-captain"
                      className="h-11 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={greenCaptainId ?? ""}
                      onChange={(event) => {
                        setGreenCaptainId(event.target.value || null);
                        setFlowError("");
                      }}
                    >
                      <option value="" disabled>
                        Select player
                      </option>
                      {players.map((player) => (
                        <option
                          key={player.id}
                          value={player.id}
                          disabled={player.id === orangeCaptainId}
                        >
                          {player.name}
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
                      onChange={(event) => {
                        setOrangeCaptainId(event.target.value || null);
                        setFlowError("");
                      }}
                    >
                      <option value="" disabled>
                        Select player
                      </option>
                      {players.map((player) => (
                        <option
                          key={player.id}
                          value={player.id}
                          disabled={player.id === greenCaptainId}
                        >
                          {player.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <div className="flex flex-1 flex-col gap-1 text-sm text-muted-foreground">
                  <span>Pick different captains for each side.</span>
                  {flowError ? (
                    <span className="font-medium text-destructive">{flowError}</span>
                  ) : null}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Button variant="ghost" onClick={() => setCurrentStep("players")}>
                    Back
                  </Button>
                  <Button
                    onClick={() => {
                      if (!greenCaptainId || !orangeCaptainId) {
                        setFlowError("Select a captain for each team to continue.");
                        return;
                      }
                      if (greenCaptainId === orangeCaptainId) {
                        setFlowError("Captains must be different players.");
                        return;
                      }
                      setFlowError("");
                      setCurrentStep("generate");
                      void triggerGeneration(true);
                    }}
                  >
                    Generate teams
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : null}

          {currentStep === "generate" ? (
            <>
              <DialogHeader>
                <DialogTitle>Step 3 of 3 · Generate balanced teams</DialogTitle>
                <DialogDescription>
                  We&apos;ll build Blue and Orange sides using skill tiers while keeping captains fixed.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  <p>Ready when you are. Tap generate and we&apos;ll spin up balanced squads.</p>
                  <p className="mt-2 text-xs">
                    We run a quick balancing pass and hold the results for review in the final
                    modal.
                  </p>
                </div>
                <div className="flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-border bg-background/70 p-6 text-center">
                  {isGenerating ? (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-medium text-foreground">Building teams…</p>
                      <p className="text-xs">
                        Give it a moment. We ensure at least a two second balancing run.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                      <p>Teams aren&apos;t generated yet.</p>
                      <p className="text-xs">
                        When you continue, the next modal shows the final lineups.
                      </p>
                    </div>
                  )}
                </div>
                {flowError && !isGenerating ? (
                  <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {flowError}
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <div className="flex flex-1 flex-col gap-1 text-sm text-muted-foreground">
                  <span>Balanced teams land in the next modal once the spinner completes.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setCurrentStep("captains")} disabled={isGenerating}>
                    Back
                  </Button>
                  <Button onClick={() => void triggerGeneration(true)} disabled={isGenerating}>
                    {isGenerating ? "Generating…" : "Generate teams"}
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : null}

          {currentStep === "results" ? (
            <>
              <DialogHeader>
                <DialogTitle>Balanced teams ready</DialogTitle>
                <DialogDescription>
                  Review the lineups, head back to tweak, or regenerate with a fresh shuffle.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-5">
                {lastTally ? (
                  <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
                    <p className="font-semibold text-primary">
                      Balance gap: {lastTally.gap} tier points.
                    </p>
                    <p className="text-muted-foreground">{lastTally.message}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <div className="rounded-xl border border-blue-400/30 bg-background/70 p-3 text-center">
                        <p className="font-semibold text-blue-600">Blue total</p>
                        <p className="text-2xl font-bold text-blue-600">{lastTally.green}</p>
                      </div>
                      <div className="rounded-xl border border-secondary/30 bg-background/70 p-3 text-center">
                        <p className="font-semibold text-secondary">Orange total</p>
                        <p className="text-2xl font-bold text-secondary">{lastTally.orange}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
                {activeTeams ? (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <TeamList
                      title="Blue"
                      accent="bg-blue-500/15 text-blue-700"
                      players={activeTeams.green}
                      total={lastTally?.green ?? 0}
                      showStats={false}
                      className="h-full"
                      captainId={greenCaptainId ?? undefined}
                    />
                    <TeamList
                      title="Orange"
                      accent="bg-orange-500/15 text-orange-700"
                      players={activeTeams.orange}
                      total={lastTally?.orange ?? 0}
                      showStats={false}
                      className="h-full"
                      captainId={orangeCaptainId ?? undefined}
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No teams yet. Head back one step and run the generator.
                  </div>
                )}
              </div>
              <DialogFooter>
                <div className="flex flex-1 flex-col gap-1 text-sm text-muted-foreground">
                  <span>Happy with the draw? You can close or shuffle again.</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setFlowError("");
                      setCurrentStep("generate");
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFlowError("");
                      setCurrentStep("generate");
                      void triggerGeneration(true);
                    }}
                  >
                    Regenerate
                  </Button>
                  <Button onClick={handleReturnHome}>Home(reset)</Button>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddPlayerModalOpen}
        onOpenChange={(open) => {
          setIsAddPlayerModalOpen(open);
          if (!open) {
            setFormError("");
            setNewPlayerName("");
            setNewPlayerRating(1);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a player</DialogTitle>
            <DialogDescription>
              Capture the player&apos;s name and skill tier, then they will appear in the roster list.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="modal-player-name">Player name</Label>
              <Input
                id="modal-player-name"
                placeholder="e.g. Sam"
                value={newPlayerName}
                onChange={(event) => {
                  setNewPlayerName(event.target.value);
                  setFormError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (handleAddPlayer()) {
                      setIsAddPlayerModalOpen(false);
                    }
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="modal-player-rating">Skill tier</Label>
              <select
                id="modal-player-rating"
                className="h-11 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={newPlayerRating}
                onChange={(event) => {
                  setNewPlayerRating(Number(event.target.value));
                  setFormError("");
                }}
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
            {formError ? (
              <p className="text-sm font-medium text-destructive">{formError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsAddPlayerModalOpen(false);
                setFormError("");
                setNewPlayerName("");
                setNewPlayerRating(1);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (handleAddPlayer()) {
                  setIsAddPlayerModalOpen(false);
                }
              }}
            >
              Save player
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type TeamListProps = {
  title: string;
  players: Player[];
  total: number;
  accent: string;
  showStats?: boolean;
  className?: string;
  captainId?: string | null;
};

function TeamList({
  title,
  players,
  total,
  accent,
  showStats = true,
  className,
  captainId,
}: TeamListProps) {
  return (
    <div className={cn("rounded-2xl border border-border bg-background/70 p-6 shadow-sm", className)}>
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
      </div>
      <ul className="mt-4 grid gap-2">
        {players.map((player) => (
          <li
            key={player.id}
            className={cn(
              "flex items-center rounded-xl border border-border/60 bg-card/70 px-4 py-2 text-sm",
              showStats ? "justify-between" : "justify-start",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{player.name}</span>
              {captainId && captainId === player.id ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-primary">
                  Captain
                </span>
              ) : null}
            </div>
            {showStats ? (
              <span className="text-xs text-muted-foreground">
                {ratingLabel(player.rating)} · {player.rating} pts
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
