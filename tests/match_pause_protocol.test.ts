import { expect, test } from "bun:test";
import { GameSettings } from "../src/settings/settings.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";

test.serial("pause and resume require both authenticated match members and block turns", () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database);
	const users = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
	const record = registry.create(GameSettings, users);
	expect(registry.requestPause(users[0], "pause")).toMatchObject({ ok: true, paused: false, waitingForOtherPlayer: true });
	expect(registry.requestPause(users[1], "pause")).toMatchObject({ ok: true, paused: true, waitingForOtherPlayer: false });
	expect(record.lifecycle.status).toBe("paused");
	const actor = record.handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!.getId();
	expect(registry.submitTurn(users[0], { actorId: actor, angle: 0, power: 1 })).toEqual({ ok: false, error: "The game is paused" });
	expect(registry.requestPause(users[0], "resume")).toMatchObject({ ok: true, paused: true, waitingForOtherPlayer: true });
	expect(registry.requestPause(users[1], "resume")).toMatchObject({ ok: true, paused: false, waitingForOtherPlayer: false });
	expect(record.lifecycle.status).toBe("resident");
	database.close();
});
