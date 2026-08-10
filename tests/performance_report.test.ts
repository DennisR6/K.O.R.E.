import { expect, test } from "bun:test";
import { buildPerformanceEndpoint, reportMatchPerformance } from "../src/net/performanceReport.ts";

const report = { schemaVersion: 1 as const, gameId: "game-1", userId: "user-1", summary: { workerRequestCount: 0, workerCompletedCount: 0, workerRejectedCount: 0, workerFailedCount: 0, precomputeHitCount: 0, precomputeHitRate: 0, fallbackCount: 0, fallbackDurationTotalMs: 0 }, turns: [] };

test("performance reporter posts to the game-scoped endpoint and is best-effort", async () => {
	expect(buildPerformanceEndpoint("https://example.test/", "game/1")).toBe("https://example.test/api/games/game%2F1/performance");
	expect(buildPerformanceEndpoint("https://example.test/kore/?lang=en_en", "game-1")).toBe("https://example.test/kore/api/games/game-1/performance");
	expect(buildPerformanceEndpoint("wss://example.test/kore/", "game-1")).toBe("https://example.test/kore/api/games/game-1/performance");
	let request: Request | undefined;
	const ok = await reportMatchPerformance(report, { endpoint: "https://example.test/api/games/game-1/performance", fetchImpl: (async (input, init) => { request = new Request(input, init); return new Response(null, { status: 200 }); }) as typeof fetch });
	expect(ok).toBe(true);
	expect(request?.method).toBe("POST");
	expect(JSON.parse(await request!.text())).toEqual(report);
	expect(await reportMatchPerformance(report, { endpoint: "https://example.test/api/games/game-1/performance", fetchImpl: (async () => { throw new Error("offline"); }) as unknown as typeof fetch })).toBe(false);
});
