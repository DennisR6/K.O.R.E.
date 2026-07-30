import { test, expect, describe } from "bun:test";
import { GameRegistry } from "../src/server/gameRegistry.js";
import { GameDatabase } from "../src/server/db.js";
import { createDefaultGameSettings } from "../src/settings/settings.js";
import { validateReplayDocument } from "../src/replay/types.js";

describe("Record Network Replays", () => {
	test("records authoritative network turns into persisted replay document", () => {
		const db = new GameDatabase(":memory:");
		const registry = new GameRegistry(db);
		const settings = createDefaultGameSettings();
		const record = registry.create(settings, ["user-1", "user-2"]);

		const actorId = record.handler.getEntityManager().getEntities()[0]?.getId()!;
		const res = registry.submitTurn("user-1", { actorId, angle: 90, power: 5 });
		expect(res.ok).toBe(true);

		const replay = registry.getReplay(record.id);
		expect(replay).toBeDefined();
		expect(() => validateReplayDocument(replay)).not.toThrow();
		expect(replay?.actions.length).toBe(1);
		expect(replay?.actions[0]?.type).toBe("shoot");
	});
});
