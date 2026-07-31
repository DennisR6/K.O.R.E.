import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { GameSettings, createDefaultGameSettings } from "../src/settings/settings.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { RulePhase } from "../src/rules/types.ts";

const userOne = "11111111-1111-4111-8111-111111111111";
const userTwo = "22222222-2222-4222-8222-222222222222";

/**
 * Cross-system validation 11.6: a persisted SQLite snapshot must restore a
 * running match with identical rule state and entity state, the restored
 * match must continue turn progression exactly like a never-evicted match,
 * and malformed persisted snapshots must be rejected.
 */
describe("Persisted Match Continuation", () => {
	function createRunningMatch(registry: GameRegistry) {
		const record = registry.create(GameSettings, [userOne, userTwo]);
		const actorId = record.handler.getEntityManager().getEntities()
			.find(entity => entity.getTeam().includes(0))!.getId();
		const result = registry.submitTurn(userOne, { actorId, angle: 0, power: 1 });
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(result.error);
		return { record, actorId };
	}

	test("persisted snapshot restores a running match with identical rule state", () => {
		const database = new GameDatabase(":memory:");
		const registry = new GameRegistry(database, 1);
		const { record } = createRunningMatch(registry);

		// Snapshot everything the persisted game must reproduce.
		const snapshotBeforeEviction = record.handler.toSettings();
		const ruleStateBefore = { ...record.ruleState };
		expect(ruleStateBefore).toEqual({ phase: RulePhase.Physics, activeTeam: 1, turnNumber: 1, itemUses: 0 });
		const entityStateBefore = record.handler.getEntityManager().serialize();
		expect(database.getCompressedSnapshotSize(record.id)).toBeGreaterThan(0);

		// Evict the in-memory handler; the match now only exists in SQLite.
		registry.evictInactive(Date.now() + 2);
		expect(registry.isCached(record.id)).toBe(false);

		const restored = registry.get(record.id)!;
		expect(restored.id).toBe(record.id);
		expect(restored.handler).not.toBe(record.handler);

		// Complete engine state is identical: rule state, turn, team, entities.
		expect(restored.handler.toSettings()).toEqual(snapshotBeforeEviction);
		expect(restored.ruleState).toEqual(ruleStateBefore);
		expect(restored.ruleState).toEqual(snapshotBeforeEviction.ruleState);
		expect(restored.currentTeam).toBe(1);
		expect(restored.turnNumber).toBe(1);
		expect(restored.handler.getActiveTeam()).toBe(1);
		expect(restored.handler.getTurnNumber()).toBe(1);
		expect(restored.handler.getEntityManager().serialize()).toEqual(entityStateBefore);

		// User/team mapping and the recorded replay survive the restore.
		expect(restored.teamByUser.get(userOne)).toBe(0);
		expect(restored.teamByUser.get(userTwo)).toBe(1);
		expect(restored.recorder.getReplay().actions).toHaveLength(1);
		database.close();
	});

	test("a restored match continues turn progression exactly like the original", () => {
		const database = new GameDatabase(":memory:");
		const registry = new GameRegistry(database, 1);
		const { record } = createRunningMatch(registry);
		registry.evictInactive(Date.now() + 2);
		const restored = registry.get(record.id)!;

		// The restored match accepts the next authoritative turn.
		const secondActorId = restored.handler.getEntityManager().getEntities()
			.find(entity => entity.getTeam().includes(1))!.getId();
		const continued = registry.submitTurn(userTwo, { actorId: secondActorId, angle: 180, power: 1 });
		expect(continued.ok).toBe(true);
		if (!continued.ok) throw new Error(continued.error);
		expect(restored.ruleState).toEqual({ phase: RulePhase.Physics, activeTeam: 0, turnNumber: 2, itemUses: 0 });
		expect(restored.handler.getActiveTeam()).toBe(0);

		// A never-evicted match receiving the same two turns must end up
		// byte-identical (game ids differ, so compare state fields).
		const referenceRegistry = new GameRegistry(new GameDatabase(":memory:"));
		const reference = createRunningMatch(referenceRegistry).record;
		const referenceActorId = reference.handler.getEntityManager().getEntities()
			.find(entity => entity.getTeam().includes(1))!.getId();
		const referenceResult = referenceRegistry.submitTurn(userTwo, { actorId: referenceActorId, angle: 180, power: 1 });
		expect(referenceResult.ok).toBe(true);

		const stripId = (settings: ReturnType<typeof restored.handler.toSettings>) => ({ ...settings, id: "same" });
		expect(stripId(restored.handler.toSettings())).toEqual(stripId(reference.handler.toSettings()));
		expect(restored.ruleState).toEqual(reference.ruleState);
		expect(restored.recorder.getReplay().actions).toEqual(reference.recorder.getReplay().actions);
		database.close();
		referenceRegistry.getDatabase().close();
	});

	test("malformed persisted snapshots are rejected at the load boundary", () => {
		const dir = mkdtempSync(join(tmpdir(), "kore-persist-test-"));
		const path = join(dir, "corrupt.db");
		const seedDatabase = new GameDatabase(path);
		seedDatabase.createGame({
			id: "game-1",
			settings: createDefaultGameSettings(2, 1) as never,
			users: [userOne, userTwo],
			currentTeam: 0,
			turnNumber: 0,
			updatedAt: 1,
		});
		seedDatabase.close();

		const corrupt = (snapshot: Uint8Array) => {
			const raw = new Database(path);
			raw.run("UPDATE games SET snapshot = ? WHERE id = 'game-1'", [snapshot]);
			raw.close();
		};

		// 1. Blob is not gzip data: decompression must fail.
		corrupt(new Uint8Array([1, 2, 3, 4, 5, 6]));
		let database = new GameDatabase(path);
		expect(() => database.loadGame("game-1")).toThrow();
		database.close();

		// 2. Gzip-compressed data that is not JSON: parsing must fail.
		corrupt(gzipSync("{ definitely not json"));
		database = new GameDatabase(path);
		expect(() => database.loadGame("game-1")).toThrow();
		database.close();

		// 3. Valid JSON whose settings are structurally invalid: the registry
		// must reject the snapshot instead of restoring a broken handler.
		corrupt(gzipSync(JSON.stringify({ settings: { players: 1 } })));
		database = new GameDatabase(path);
		const registry = new GameRegistry(database, 1);
		expect(() => registry.get("game-1")).toThrow();
		database.close();
	});
});
