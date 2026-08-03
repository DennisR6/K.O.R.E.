import { expect, test } from "bun:test";
import { GameStateManager } from "../src/systems/GameStateManager.ts";
import { BoundarySystem } from "../src/systems/BoundarySystem.ts";
import { PlaybackSystem } from "../src/systems/PlayBackSystem.ts";
import { WinningSystem } from "../src/systems/WinningSystem.ts";
import { UiSystem } from "../src/systems/UiSystem.ts";

test("serializable system IDs are explicit protocol constants", () => {
	const system = new GameStateManager() as unknown as { systemId?: string };
	expect(system.systemId).toBe("core.game-state-manager");
	expect(new BoundarySystem().toSettings()).toEqual({ systemId: "core.boundary", schemaVersion: 1, state: {} });
	expect(new PlaybackSystem().toSettings().systemId).toBe("core.playback");
	expect(new WinningSystem(2).toSettings()).toMatchObject({ systemId: "core.winning", state: { teamCount: 2 } });
	expect(new UiSystem().toSettings().systemId).toBe("ui.pointer-input");
});
