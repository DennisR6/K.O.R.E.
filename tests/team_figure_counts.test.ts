import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createDefaultGameSettings, GameSettings, validateFigureCounts } from "../src/settings/settings.ts";

test("player and figure counts persist through engine settings snapshots", () => {
	const configured = { ...GameSettings, playerCount: 1, figuresPerPlayer: 3 };
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(configured).build();
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(handler.toSettings()).build();

	expect(handler.toSettings()).toMatchObject({ playerCount: 1, figuresPerPlayer: 3 });
	expect(restored.toSettings()).toMatchObject({ playerCount: 1, figuresPerPlayer: 3 });
});

test("player and figure counts must be positive integers", () => {
	expect(() => validateFigureCounts(0, 1)).toThrow("Player count and figures per player must be positive integers");
	expect(() => validateFigureCounts(1, 0)).toThrow("Player count and figures per player must be positive integers");
	expect(() => validateFigureCounts(1.5, 2)).toThrow("Player count and figures per player must be positive integers");
});

test("default layouts generate the configured figures for each player", () => {
	const settings = createDefaultGameSettings(2, 3);

	expect(settings.players).toHaveLength(6);
	expect(settings.players.filter(player => player.team.includes(0))).toHaveLength(3);
	expect(settings.players.filter(player => player.team.includes(1))).toHaveLength(3);
	expect(new Set(settings.players.map(player => `${player.position.x},${player.position.y}`)).size).toBe(6);
});
