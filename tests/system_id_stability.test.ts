import { expect, test } from "bun:test";
import { GameStateManager } from "../src/systems/GameStateManager.ts";

test("serializable system IDs are explicit protocol constants", () => {
	const system = new GameStateManager() as unknown as { systemId?: string };
	expect(system.systemId).toBe("core.game-state-manager");
});
