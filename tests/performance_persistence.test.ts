import { expect, test } from "bun:test";
import { aggregatePerformanceLogs, validateMatchPerformanceReport, type MatchPerformanceReport } from "../src/performance/matchPerformance.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { servePerformanceReport } from "../src/server/performanceReports.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

const users = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
const metric = (value: number) => ({ count: 1, min: value, median: value, p90: value, p95: value, max: value });

function report(gameId: string, userId = users[0]!): MatchPerformanceReport {
	return {
		schemaVersion: 1, gameId, userId, engineVersion: "test",
		summary: {
			turnDurationMs: metric(100), workerComputeMs: metric(40), workerRequestCount: 1,
			workerCompletedCount: 1, workerRejectedCount: 0, workerFailedCount: 0,
			precomputeHitCount: 1, precomputeHitRate: 1, fallbackCount: 0, fallbackDurationTotalMs: 0,
		},
		turns: [{ turnNumber: 2, team: 1, turnDurationMs: 100, workerComputeMs: 40, workerReadyBeforeTurnEnd: true }],
	};
}

test("runtime logs aggregate into match and per-turn performance summaries", () => {
	const result = aggregatePerformanceLogs([
		{ type: "ai.worker.requested", timestampMs: 1, turnNumber: 2, data: { team: 1 } },
		{ type: "turn.playback.completed", timestampMs: 2, turnNumber: 2, data: { team: 1, playerVisibleDurationMs: 80 } },
		{ type: "ai.worker.completed", timestampMs: 3, turnNumber: 2, data: { team: 1, workerComputeMs: 40, playerVisibleDurationMs: 80, precomputeHeadroomMs: 40, postTurnWaitMs: 0, workerReadyBeforeTurnEnd: true } },
		{ type: "turn.completed", timestampMs: 4, turnNumber: 2, data: { team: 1, turnDurationMs: 100 } },
		{ type: "ai.fallback.completed", timestampMs: 5, turnNumber: 3, data: { team: 0, reason: "worker-unavailable", durationMs: 20 } },
	] as any, { gameId: "game", userId: users[0]! });
	 expect(result.summary.workerRequestCount).toBe(1);
	expect(result.summary.precomputeHitRate).toBe(1);
	expect(result.summary.playerVisibleDurationMs).toEqual(metric(80));
	expect(result.turns).toEqual(expect.arrayContaining([{ turnNumber: 2, team: 1, playerVisibleDurationMs: 80, workerComputeMs: 40, precomputeHeadroomMs: 40, postTurnWaitMs: 0, workerReadyBeforeTurnEnd: true, turnDurationMs: 100 }, { turnNumber: 3, team: 0, fallbackOccurred: true, fallbackReason: "worker-unavailable", fallbackDurationMs: 20 }]));
});

test.serial("performance endpoint authenticates game membership and replaces duplicate reports idempotently", async () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database);
	const game = registry.create(createDefaultGameSettings(2, 1), users);
	database.setLifecycle(game.id, { version: 1, status: "completed", createdAt: 1, statusChangedAt: 2, completedAt: 3 });
	const first = report(game.id);
	const response = await servePerformanceReport(new Request(`http://localhost/api/games/${game.id}/performance`, { method: "POST", body: JSON.stringify(first) }), database);
	expect(response?.status).toBe(200);
	const stored = database.getPerformanceReport(game.id, users[0]!);
	expect(stored).toMatchObject({ gameId: game.id, userId: users[0]!, summary: first.summary, turns: first.turns });
	const second = { ...first, summary: { ...first.summary, precomputeHitRate: 0 }, turns: [{ turnNumber: 9, team: 0, fallbackOccurred: true, fallbackReason: "worker-runtime-error", fallbackDurationMs: 30 }] };
	const retry = await servePerformanceReport(new Request(`http://localhost/api/games/${game.id}/performance`, { method: "POST", body: JSON.stringify(second) }), database);
	expect(retry?.status).toBe(200);
	expect(database.getPerformanceReport(game.id, users[0]!)?.turns).toEqual(second.turns);
	expect(await servePerformanceReport(new Request(`http://localhost/api/games/${game.id}/performance`, { method: "POST", body: JSON.stringify({ ...first, userId: users[1] }) }), database)).toMatchObject({ status: 200 });
	expect(await servePerformanceReport(new Request(`http://localhost/api/games/${game.id}/performance`, { method: "POST", body: JSON.stringify({ ...first, userId: "not-a-member" }) }), database)).toMatchObject({ status: 403 });
	database.close();
});

test.serial("performance endpoint rejects unknown, active, mismatched, and malformed reports", async () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database);
	const game = registry.create(createDefaultGameSettings(2, 1), users);
	const valid = report(game.id);
	expect(await servePerformanceReport(new Request(`http://localhost/api/games/unknown/performance`, { method: "POST", body: JSON.stringify({ ...valid, gameId: "unknown" }) }), database)).toMatchObject({ status: 404 });
	expect(await servePerformanceReport(new Request(`http://localhost/api/games/${game.id}/performance`, { method: "POST", body: JSON.stringify(valid) }), database)).toMatchObject({ status: 409 });
	expect(await servePerformanceReport(new Request(`http://localhost/api/games/${game.id}/performance`, { method: "POST", body: JSON.stringify({ ...valid, summary: { ...valid.summary, precomputeHitRate: 2 } }) }), database)).toMatchObject({ status: 400 });
	expect(await servePerformanceReport(new Request(`http://localhost/api/games/${game.id}/performance`, { method: "POST", body: JSON.stringify({ ...valid, gameId: "other" }) }), database)).toMatchObject({ status: 400 });
	database.close();
});

test("performance report validation accepts finite negative headroom and rejects invalid percentile values", () => {
	const valid = report("game");
	validateMatchPerformanceReport({ ...valid, summary: { ...valid.summary, precomputeHeadroomMs: metric(-10) } });
	expect(() => validateMatchPerformanceReport({ ...valid, summary: { ...valid.summary, workerComputeMs: { ...metric(1), p95: Number.NaN } } })).toThrow();
});
