import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";

const userOne = "11111111-1111-4111-8111-111111111111";
const userTwo = "22222222-2222-4222-8222-222222222222";

test.serial("legacy SQLite rows migrate to versioned sleeping lifecycle records without losing their snapshot", () => {
	const path = join(mkdtempSync(join(tmpdir(), "kore-lifecycle-migration-")), "legacy.db");
	const legacySettings = createDefaultGameSettings(2, 1);
	const raw = new Database(path);
	raw.run("CREATE TABLE games (id TEXT PRIMARY KEY NOT NULL, snapshot BLOB NOT NULL, current_team INTEGER NOT NULL, turn_number INTEGER NOT NULL, updated_at INTEGER NOT NULL)");
	raw.run("CREATE TABLE game_players (game_id TEXT NOT NULL, user_id TEXT PRIMARY KEY NOT NULL, team INTEGER NOT NULL)");
	raw.run("INSERT INTO games VALUES (?1, ?2, 0, 0, 42)", ["legacy-game", gzipSync(JSON.stringify({ settings: legacySettings, actions: [] }))]);
	raw.run("INSERT INTO game_players VALUES ('legacy-game', ?1, 0), ('legacy-game', ?2, 1)", [userOne, userTwo]);
	raw.close();

	const database = new GameDatabase(path);
	expect(database.getLifecycle("legacy-game")).toEqual({
		version: 1,
		status: "sleeping",
		createdAt: null,
		statusChangedAt: 42,
		completedAt: null,
	});
	const registry = new GameRegistry(database);
	expect(registry.getMetrics(1)).toMatchObject({ allTime: 1, now: 0, paused: 0, sleeping: 1 });
	const restored = registry.connectUser(userOne)!;
	expect(restored.handler.toSettings().players).toEqual(legacySettings.players);
	expect(registry.getMetrics(2)).toMatchObject({ allTime: 1, now: 1, paused: 0, sleeping: 0 });
	database.close();
});

test.serial("eviction, process restart, reconnect, and rematch preserve one lifecycle row", () => {
	const path = join(mkdtempSync(join(tmpdir(), "kore-lifecycle-restart-")), "games.db");
	let database = new GameDatabase(path);
	let registry = new GameRegistry(database, 1);
	const record = registry.create(createDefaultGameSettings(2, 1), [userOne, userTwo]);
	const id = record.id;
	const before = record.handler.toSettings();
	registry.evictInactive(Date.now() + 2);
	expect(database.getLifecycle(id)?.status).toBe("sleeping");
	database.close();

	database = new GameDatabase(path);
	registry = new GameRegistry(database, 1);
	expect(registry.getMetrics(10)).toMatchObject({ allTime: 1, now: 0, paused: 0, sleeping: 1 });
	const restored = registry.connectUser(userOne)!;
	expect(restored.id).toBe(id);
	expect(restored.handler.toSettings()).toEqual(before);
	expect(database.getLifecycle(id)?.status).toBe("resident");
	expect(registry.rematch(userOne).ok).toBe(true);
	expect(registry.getMetrics(11)).toMatchObject({ allTime: 1, now: 1, paused: 0, sleeping: 0 });
	database.close();
});
