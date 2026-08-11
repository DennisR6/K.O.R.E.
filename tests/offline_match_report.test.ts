import { describe, expect, test } from "bun:test";
import { MatchEndReason, MatchStatus } from "../src/rules/types.ts";
import { ReplayRecorder } from "../src/replay/recorder.ts";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.ts";
import { createLocalGameplayHandler } from "../src/scenes/LocalMatchSceneRouter.ts";
import { createAiBattleHandler, createHumanVsAiHandler } from "../src/scenes/LocalMatchSceneRouter.ts";
import type { GameHandler } from "../src/kore/runtime/Handler.ts";
import { GameDatabase } from "../src/server/db.ts";
import { validateOfflineMatchReport } from "../src/server/offlineMatchContract.ts";
import { serveOfflineMatchReport } from "../src/server/offlineMatches.ts";
import { buildOfflineMatchEndpoint, collectOfflineMatchRecord, installOfflineMatchReport, reportOfflineMatch, type OfflineMatchRecordPayload } from "../src/net/offlineMatchReport.ts";
import { GameState } from "../src/kore/runtime/types.ts";

function validReport(): OfflineMatchRecordPayload {
	return {
		mode: "human-vs-ai",
		mapId: "ice-map-v1",
		difficulty: "easy",
		seed: 123,
		players: ["Human", "easy KI"],
		result: { status: MatchStatus.Winner, winnerTeam: 1, reason: MatchEndReason.LastTeamStanding, turnNumber: 3 },
		replay: new ReplayRecorder(createCanonicalPlayableMatchSettings(), 123).getReplay(),
	};
}

function renderer() {
	return {
		WORLD_SIZE_X: 800, WORLD_SIZE_Y: 450,
		clear() { }, push() { }, pop() { }, setFillColor() { }, setNoFill() { }, setStrokeColor() { }, setStroke() { }, noStroke() { },
		drawCircle() { }, drawRect() { }, drawText() { }, line() { }, rotate() { }, scale() { }, translate() { },
		drawImage() { }, getScreenSize: () => ({ width: 800, height: 450 }), resizeCanvas() { }, setScaleFactor() { }, getScaleFactor: () => 1,
		toWorld: (value: number) => value, toPixel: (value: number) => value, windowScale: () => 1, beginClip() { }, endClip() { }, mouseWheel() { },
	};
}

function finish(handler: GameHandler): void {
	handler.setMatchResult({ status: MatchStatus.Winner, winnerTeam: 1, reason: MatchEndReason.LastTeamStanding, turnNumber: 3 });
	handler.setState(GameState.Game_over);
}

describe("offline match contract", () => {
	test("accepts a completed match record with a validated replay origin", () => {
		const report = validReport();
		expect(() => validateOfflineMatchReport(JSON.parse(JSON.stringify(report)))).not.toThrow();
	});

	test("rejects malformed or unplayable records", () => {
		const base = validReport();
		const cases: Array<{ label: string; mutate: (value: Record<string, unknown>) => void }> = [
			{ label: "unknown mode", mutate: value => { value.mode = "poker"; } },
			{ label: "missing map id", mutate: value => { value.mapId = ""; } },
			{ label: "unknown difficulty", mutate: value => { value.difficulty = "expert"; } },
			{ label: "fractional seed", mutate: value => { value.seed = 1.5; } },
			{ label: "empty players", mutate: value => { value.players = []; } },
			{ label: "invalid result", mutate: value => { value.result = { status: "ongoing", winnerTeam: null, reason: "last-team-standing", turnNumber: 1 }; } },
			{ label: "missing replay", mutate: value => { value.replay = undefined; } },
			{ label: "inactive replay origin", mutate: value => { const replay = new ReplayRecorder(createCanonicalPlayableMatchSettings(), 1).getReplay(); const player = (replay.initialSettings as { players: Array<{ isPhysicsEnabled: boolean; isDrawingEnabled: boolean }> }).players[0]!; player.isPhysicsEnabled = false; player.isDrawingEnabled = false; value.replay = replay; } },
		];
		for (const entry of cases) {
			const value = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
			entry.mutate(value);
			expect(() => validateOfflineMatchReport(value), entry.label).toThrow();
		}
	});
});

describe("offline match database store", () => {
	test("persists one record and lists summaries without the replay payload", () => {
		const db = new GameDatabase(":memory:");
		const stored = db.storeOfflineMatch(validReport());
		expect(stored.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(stored.players).toEqual(["Human", "easy KI"]);
		const summaries = db.listOfflineMatches();
		expect(summaries).toHaveLength(1);
		expect(summaries[0]!.mode).toBe("human-vs-ai");
		expect(summaries[0]!.seed).toBe(123);
		expect("replay" in summaries[0]!).toBe(false);
	});
});

describe("offline match report route", () => {
	test("persists a valid POST body", async () => {
		const db = new GameDatabase(":memory:");
		const request = new Request("http://test.local/offline-matches", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(validReport()),
		});
		const response = await serveOfflineMatchReport(request, db);
		expect(response?.status).toBe(200);
		const body = await response!.json() as { ok: boolean; id: string };
		expect(body.ok).toBe(true);
		expect(body.id).toBeTruthy();
		expect(db.listOfflineMatches()).toHaveLength(1);
	});

	test("rejects malformed bodies with 400", async () => {
		const db = new GameDatabase(":memory:");
		const request = new Request("http://test.local/offline-matches", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ mode: "unknown" }),
		});
		const response = await serveOfflineMatchReport(request, db);
		expect(response?.status).toBe(400);
	});

	test("returns 405 for non-POST requests and ignores other paths", async () => {
		const db = new GameDatabase(":memory:");
		const get = await serveOfflineMatchReport(new Request("http://test.local/offline-matches"), db);
		expect(get?.status).toBe(405);
		expect(await serveOfflineMatchReport(new Request("http://test.local/config"), db)).toBeUndefined();
	});

	test("accepts an application base-path prefix", async () => {
		const db = new GameDatabase(":memory:");
		const response = await serveOfflineMatchReport(new Request("http://test.local/kore/offline-matches", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(validReport()),
		}), db);
		expect(response?.status).toBe(200);
	});
});

describe("browser-side offline match report", () => {
	test("keeps the deployed application base path in the report endpoint", () => {
		expect(buildOfflineMatchEndpoint("https://example.test/")).toBe("https://example.test/offline-matches");
		expect(buildOfflineMatchEndpoint("https://example.test/kore/")).toBe("https://example.test/kore/offline-matches");
		expect(buildOfflineMatchEndpoint("")).toBe("");
	});

	test("collects the finished handler's mode header and replay", () => {
		const handler = createLocalGameplayHandler("ice-map-v1");
		handler.log("performance.frame-window", { medianMs: 5, p90Ms: 12 });
		handler.log("input.accepted", { actionType: "shot" });
		finish(handler);
		const record = collectOfflineMatchRecord(handler, "hotseat", "ice-map-v1", handler.getMatchResult()!);
		expect(record).toBeDefined();
		expect(record!.mode).toBe("hotseat");
		expect(record!.players).toEqual(handler.getSettings()?.allTeams);
		expect((record!.replay as { seed: number }).seed).toBe(12345);
		expect(record!.performanceLogs).toHaveLength(1);
		expect((record!.performanceLogs![0] as { type: string }).type).toBe("performance.frame-window");
	});

	test("omits verbose simulation diagnostics from persisted performance logs", () => {
		const handler = createLocalGameplayHandler("ice-map-v1");
		handler.log("turn.simulation.started", { snapshot: "large diagnostic" });
		handler.log("turn.completed", { durationMs: 12 });
		finish(handler);
		const record = collectOfflineMatchRecord(handler, "hotseat", "ice-map-v1", handler.getMatchResult()!);
		expect(record?.performanceLogs?.map(entry => (entry as { type: string }).type) ?? []).toEqual(["turn.completed"]);
	});

	test("reports exactly once per finished match and again after a rematch", () => {
		const handler = createLocalGameplayHandler("ice-map-v1");
		const reports: OfflineMatchRecordPayload[] = [];
		installOfflineMatchReport(handler, "hotseat", "ice-map-v1", record => { reports.push(record); });
		finish(handler);
		handler.drawWorld(renderer() as never);
		handler.drawWorld(renderer() as never);
		expect(reports).toHaveLength(1);
		handler.rematch();
		handler.drawWorld(renderer() as never);
		finish(handler);
		handler.drawWorld(renderer() as never);
		expect(reports).toHaveLength(2);
	});

	test("installs automatic reporting for human-vs-AI and AI-vs-AI matches", () => {
		const cases: Array<[GameHandler, "human-vs-ai" | "ai-battle"]> = [
			[createHumanVsAiHandler("ice-map-v1", "easy", 11), "human-vs-ai"],
			[createAiBattleHandler("ice-map-v1", 12), "ai-battle"],
		];
		for (const [handler, mode] of cases) {
			const reports: OfflineMatchRecordPayload[] = [];
			installOfflineMatchReport(handler, mode, "ice-map-v1", record => { reports.push(record); });
			finish(handler);
			handler.drawWorld(renderer() as never);
			expect(reports).toHaveLength(1);
			expect(reports[0]!.mode).toBe(mode);
		}
	});

	test("resolves success and failure without throwing", async () => {
		const record = validReport();
		const calls: Array<{ url: string; body: string }> = [];
		const okFetch = async (url: string, init: RequestInit) => { calls.push({ url, body: String(init.body) }); expect(init.keepalive).toBe(true); return new Response("{}", { status: 200 }); };
		expect(await reportOfflineMatch(record, { endpoint: "http://test.local/offline-matches", fetchImpl: okFetch as never })).toBe(true);
		expect(calls[0]!.url).toBe("http://test.local/offline-matches");
		expect(calls[0]!.body).toContain('"mode":"human-vs-ai"');

		const failingFetch = async () => { throw new Error("network down"); };
		expect(await reportOfflineMatch(record, { endpoint: "http://test.local/offline-matches", fetchImpl: failingFetch as never })).toBe(false);

		const rejectedFetch = async (_url: string, _init: RequestInit) => new Response("nope", { status: 500 });
		expect(await reportOfflineMatch(record, { endpoint: "http://test.local/offline-matches", fetchImpl: rejectedFetch as never })).toBe(false);
	});

	test("retries transient report failures", async () => {
		let calls = 0;
		const fetchImpl = async () => {
			calls++;
			return new Response("{}", { status: calls < 3 ? 503 : 200 });
		};

		expect(await reportOfflineMatch(validReport(), { endpoint: "http://test.local/offline-matches", fetchImpl: fetchImpl as never })).toBe(true);
		expect(calls).toBe(3);
	});

	test("notifies the owner only after report delivery succeeds", async () => {
		const handler = createAiBattleHandler("ice-map-v1", 99);
		let delivered = 0;
		installOfflineMatchReport(handler, "ai-battle", "ice-map-v1", () => true, () => { delivered++; });
		finish(handler);
		handler.drawWorld(renderer() as never);
		expect(delivered).toBe(0);
		await Promise.resolve();
		expect(delivered).toBe(1);
	});

	test("falls back to the root endpoint when the deployed prefix is not forwarded", async () => {
		const urls: string[] = [];
		const fetchImpl = async (url: string) => {
			urls.push(url);
			return new Response("{}", { status: url.endsWith("/kore/offline-matches") ? 404 : 200 });
		};

		expect(await reportOfflineMatch(validReport(), { endpoint: "http://test.local/kore/offline-matches", fetchImpl: fetchImpl as never })).toBe(true);
		expect(urls).toEqual(["http://test.local/kore/offline-matches", "http://test.local/offline-matches"]);
	});
});
