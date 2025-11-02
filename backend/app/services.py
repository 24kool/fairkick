from __future__ import annotations

import random
from collections import defaultdict
from typing import Iterable

from .schemas import Player


FAIRNESS_MESSAGES: list[tuple[int, str]] = [
    (0, "Perfectly balanced – as all things should be."),
    (1, "Teams look tight! Expect a competitive match."),
    (2, "Slight edge to one side, but still playable."),
    (999, "Wide gap detected – consider a quick reshuffle."),
]


def pick_message(gap: int) -> str:
    for threshold, message in FAIRNESS_MESSAGES:
        if gap <= threshold:
            return message
    return FAIRNESS_MESSAGES[-1][1]


def shuffle_players(players: Iterable[Player]) -> list[Player]:
    clone = list(players)
    random.shuffle(clone)
    return clone


def total_rating(players: Iterable[Player]) -> int:
    return sum(player.rating for player in players)


def assign_balanced(players: list[Player], green_captain: Player, orange_captain: Player):
    bench = [player for player in players if player.id not in {green_captain.id, orange_captain.id}]
    shuffled_bench = shuffle_players(bench)

    total_players = len(players)
    green_target = (total_players + 1) // 2
    orange_target = total_players // 2

    teams = defaultdict(list)
    teams["green"].append(green_captain)
    teams["orange"].append(orange_captain)

    for player in shuffled_bench:
        if len(teams["green"]) >= green_target:
            teams["orange"].append(player)
            continue

        if len(teams["orange"]) >= orange_target:
            teams["green"].append(player)
            continue

        green_total = total_rating(teams["green"])
        orange_total = total_rating(teams["orange"])

        if green_total == orange_total:
            target = random.choice(["green", "orange"])
            teams[target].append(player)
            continue

        if green_total < orange_total:
            teams["green"].append(player)
        else:
            teams["orange"].append(player)

    green_total = total_rating(teams["green"])
    orange_total = total_rating(teams["orange"])
    gap = abs(green_total - orange_total)

    return {
        "green": teams["green"],
        "orange": teams["orange"],
        "green_total": green_total,
        "orange_total": orange_total,
        "rating_gap": gap,
        "message": pick_message(gap),
    }
