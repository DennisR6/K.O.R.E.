import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { MatchEndReason, MatchStatus } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { servePublicReplayShare } from "../src/server/replayShares.ts";

function shareFixture() {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings()).build();
	handler.finishMatch({ status: MatchStatus.Draw, winnerTeam: null, reason: MatchEndReason.Draw, turnNumber: 0 });
	const finalSettings = handler.toSettings();
	const db = new GameDatabase(":memory:");
	db.createGame({ id: "secret-game", settings: finalSettings, users: ["private-a", "private-b"], currentTeam: 0, turnNumber: 0, updatedAt: 1, lifecycle: { version: 1, status: "completed", createdAt: 1, statusChangedAt: 1, completedAt: 1 } });
	const share = db.createReplayShare("secret-game", { schemaVersion: 1, initialSettings: createDefaultGameSettings(), seed: 1, actions: [], finalSettings, result: finalSettings.matchResult!, completedAt: 1 });
	return { db, registry: new GameRegistry(db), token: share.token };
}

test("public replay route exposes only deliberately public replay data", async () => {
	const { db, registry, token } = shareFixture();
	const response = servePublicReplayShare(new Request(`https://example.test/replays/${token}`), registry)!;
	expect(response.status).toBe(200);
	const body = await response.json() as Record<string, unknown>;
	expect(JSON.stringify(body)).not.toContain("secret-game");
	expect(JSON.stringify(body)).not.toContain("private-a");
	expect(JSON.stringify(body)).not.toContain("finalSettings");
	expect(db.revokeReplayShare(token)).toBe(true);
	expect(servePublicReplayShare(new Request(`https://example.test/replays/${token}`), registry)!.status).toBe(404);
	db.close();
});

test("public replay route uniformly rejects malformed and unsupported requests", () => {
	const { db, registry } = shareFixture();
	for (const path of ["/replays/nope", `/replays/${"a".repeat(33)}`, `/replays/${"f".repeat(32)}`]) {
		expect(servePublicReplayShare(new Request(`https://example.test${path}`), registry)!.status).toBe(404);
	}
	expect(servePublicReplayShare(new Request("https://example.test/replays/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { method: "POST" }), registry)!.status).toBe(405);
	db.close();
});
