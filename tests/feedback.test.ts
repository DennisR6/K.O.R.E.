import { expect, test } from "bun:test";
import { buildFeedbackEndpoint, reportFeedback } from "../src/net/feedback.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { serveFeedback } from "../src/server/feedbackRoute.ts";
import { GameSettings } from "../src/settings/settings.ts";

test("feedback endpoint preserves deployment paths and posts feedback", async () => {
	expect(buildFeedbackEndpoint("https://example.test/kore/?lang=en_en")).toBe("https://example.test/kore/api/feedback");
	let request: Request | undefined;
	const ok = await reportFeedback({ mode: "hotseat", mapId: "ice-map-v1" }, "Fun match", "https://example.test/api/feedback", (async (input, init) => {
		request = new Request(input, init);
		return new Response(null, { status: 200 });
	}) as typeof fetch, 5);
	expect(ok).toBe(true);
	expect(JSON.parse(await request!.text())).toEqual({ mode: "hotseat", mapId: "ice-map-v1", text: "Fun match", rating: 5 });
});

test.serial("feedback is accumulated in the database and online submissions require membership", async () => {
	const database = new GameDatabase(":memory:");
	const users = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
	const game = new GameRegistry(database).create(GameSettings, users);
	const first = await serveFeedback(new Request("http://localhost/api/feedback", { method: "POST", body: JSON.stringify({ gameId: game.id, userId: users[0], mode: "online", text: "Good match" }) }), database);
	const second = await serveFeedback(new Request("http://localhost/api/feedback", { method: "POST", body: JSON.stringify({ mode: "hotseat", mapId: "ice-map-v1", text: "Needs more maps", rating: 3 }) }), database);
	const rejected = await serveFeedback(new Request("http://localhost/api/feedback", { method: "POST", body: JSON.stringify({ gameId: game.id, userId: "not-a-member", text: "No" }) }), database);
	expect(first?.status).toBe(200);
	expect(second?.status).toBe(200);
	expect(rejected?.status).toBe(403);
	expect(database.listFeedback()).toHaveLength(2);
	expect(database.listFeedback()[0]).toMatchObject({ rating: 3 });
	const invalidRating = await serveFeedback(new Request("http://localhost/api/feedback", { method: "POST", body: JSON.stringify({ mode: "hotseat", text: "bad", rating: 6 }) }), database);
	expect(invalidRating?.status).toBe(400);
	database.close();
});
