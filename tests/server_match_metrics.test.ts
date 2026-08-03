import { expect, test } from "bun:test";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";

const users = Array.from({ length: 8 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);

function settingsWithOneDeadTeam() {
	const settings = createDefaultGameSettings(2, 1);
	settings.players.find(player => player.team.includes(1))!.isDead = true;
	return settings;
}

test.serial("dashboard metrics are mutually exclusive across resident, paused, sleeping, and completed games", () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database, 1);
	expect(registry.getMetrics(10)).toEqual({
		allTime: 0,
		now: 0,
		paused: 0,
		sleeping: 0,
		measuredAt: 10,
		consistency: "now is scoped to this server process's resident registry cache",
	});

	const live = registry.create(createDefaultGameSettings(2, 1), users.slice(0, 2));
	const paused = registry.create(createDefaultGameSettings(2, 1), users.slice(2, 4));
	const sleeping = registry.create(createDefaultGameSettings(2, 1), users.slice(4, 6));
	const completed = registry.create(settingsWithOneDeadTeam(), users.slice(6, 8));
	registry.setPaused(paused.id, true, 20);
	registry.connectUser(users[4]);
	registry.connectUser(users[5]);
	registry.disconnectUser(users[4]);
	registry.disconnectUser(users[5]);

	const actorId = completed.handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!.getId();
	expect(registry.submitTurn(users[6], { actorId, angle: 0, power: 1 }).ok).toBe(true);

	expect(registry.getMetrics(30)).toEqual({
		allTime: 4,
		now: 1,
		paused: 1,
		sleeping: 1,
		measuredAt: 30,
		consistency: "now is scoped to this server process's resident registry cache",
	});
	expect(database.getLifecycle(live.id)?.status).toBe("resident");
	expect(database.getLifecycle(paused.id)?.status).toBe("paused");
	expect(database.getLifecycle(sleeping.id)?.status).toBe("sleeping");
	expect(database.getLifecycle(completed.id)?.status).toBe("completed");
	database.close();
});

test.serial("lifecycle transitions are idempotent and paused games reject actions without mutation", () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database, 1);
	const record = registry.create(createDefaultGameSettings(2, 1), users.slice(0, 2));
	registry.connectUser(users[0]);
	registry.connectUser(users[0]);
	registry.connectUser(users[1]);
	registry.setPaused(record.id, true, 50);
	registry.setPaused(record.id, true, 51);
	const before = record.handler.toSettings();
	const actions = record.recorder.getReplay().actions;
	const actorId = record.handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!.getId();

	expect(registry.submitTurn(users[0], { actorId, angle: 0, power: 1 })).toEqual({ ok: false, error: "The game is paused" });
	expect(registry.submitItemUse(users[0], actorId, "anchor", {})).toEqual({ ok: false, error: "The game is paused" });
	expect(record.handler.toSettings()).toEqual(before);
	expect(record.recorder.getReplay().actions).toEqual(actions);
	expect(database.getLifecycle(record.id)).toMatchObject({ status: "paused", statusChangedAt: 50 });

	registry.disconnectUser(users[0]);
	registry.disconnectUser(users[0]);
	registry.disconnectUser(users[1]);
	registry.evictInactive(100);
	expect(registry.getMetrics(101)).toMatchObject({ allTime: 1, now: 0, paused: 1, sleeping: 0 });

	const restored = registry.connectUser(users[0])!;
	expect(restored.id).toBe(record.id);
	expect(registry.getMetrics(102)).toMatchObject({ allTime: 1, now: 0, paused: 1, sleeping: 0 });
	registry.setPaused(record.id, false, 103);
	expect(registry.getMetrics(104)).toMatchObject({ allTime: 1, now: 1, paused: 0, sleeping: 0 });
	database.close();
});
