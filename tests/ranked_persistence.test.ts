import { expect, test } from "bun:test";
import { GameDatabase } from "../src/server/db.ts";

test("ranked seasons and leaderboard entries persist in deterministic order", () => {
	const database = new GameDatabase(":memory:");
	database.createRankedSeason({ id: "season-1", rulesetVersion: "ranked-v1", startsAt: 1, endsAt: null, status: "active" });
	expect(database.getRankedSeason("season-1")).toEqual({ id: "season-1", rulesetVersion: "ranked-v1", startsAt: 1, endsAt: null, status: "active" });
	database.finalizeRankedMatch({ matchId: "leaderboard-match", seasonId: "season-1", result: { status: "winner", winnerTeam: 0, reason: "last-team-standing", turnNumber: 2 }, players: [{ playerId: "lower", team: 0 }, { playerId: "higher", team: 1 }], now: 2 });
	expect(database.listRankedLeaderboard("season-1").map(entry => entry.playerId)).toEqual(["lower", "higher"]);
});

test("ranked result finalization is transactional and idempotent", () => {
	const database = new GameDatabase(":memory:");
	const result = { status: "winner" as const, winnerTeam: 0, reason: "last-team-standing" as const, turnNumber: 8 };
	const first = database.finalizeRankedMatch({ matchId: "ranked-match-1", seasonId: "season-1", result, players: [{ playerId: "player-a", team: 0 }, { playerId: "player-b", team: 1 }], now: 10 });
	expect(first.events).toHaveLength(2);
	expect(first.events.find(event => event.playerId === "player-a")?.delta).toBeGreaterThan(0);
	expect(database.getRankedRating("season-1", "player-a").games).toBe(1);
	const replayed = database.finalizeRankedMatch({ matchId: "ranked-match-1", seasonId: "season-1", result, players: [{ playerId: "player-a", team: 0 }, { playerId: "player-b", team: 1 }], now: 20 });
	expect(replayed).toEqual(first);
	expect(database.getRankedRating("season-1", "player-a").games).toBe(1);
});
