import { expect, test } from "bun:test";
import { GameSettings } from "../src/settings/settings.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { serveMatchReport } from "../src/server/matchReports.ts";
import { buildMatchReportEndpoint, reportMatchHttp } from "../src/net/matchReport.ts";

test.serial("HTTP report fallback validates membership and preserves the current turn", async () => {
	const database = new GameDatabase(":memory:");
	const users = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
	const record = new GameRegistry(database).create(GameSettings, users);
	const endpoint = `https://example.test/api/games/${record.id}/report`;
	const valid = await serveMatchReport(new Request(endpoint, { method: "POST", body: JSON.stringify({ gameId: record.id, userId: users[0], category: "technical", text: "The shot preview is wrong" }) }), database);
	expect(valid?.status).toBe(200);
	expect(database.getGameTurnNumber(record.id)).toBe(0);
	const duplicate = await serveMatchReport(new Request(endpoint, { method: "POST", body: JSON.stringify({ gameId: record.id, userId: users[0], category: "technical", text: "again" }) }), database);
	expect(duplicate?.status).toBe(400);
	const outsider = await serveMatchReport(new Request(endpoint, { method: "POST", body: JSON.stringify({ gameId: record.id, userId: "33333333-3333-4333-8333-333333333333", category: "conduct", text: "cheating" }) }), database);
	expect(outsider?.status).toBe(403);
	database.close();
});

test("report fallback builds the deployment-base endpoint and posts its payload", async () => {
	let request: Request | undefined;
	const endpoint = buildMatchReportEndpoint("wss://example.test/kore", "game/1");
	expect(endpoint).toBe("https://example.test/kore/api/games/game%2F1/report");
	expect(await reportMatchHttp(endpoint, "game/1", "user-1", "conduct", "unsporting", (async (input: RequestInfo | URL, init?: RequestInit) => {
		request = new Request(input, init);
		return new Response(null, { status: 200 });
	}) as unknown as typeof fetch)).toBe(true);
	expect(await request!.json()).toEqual({ gameId: "game/1", userId: "user-1", category: "conduct", text: "unsporting" });
});
