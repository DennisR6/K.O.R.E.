import { describe, expect, test } from "bun:test";
import { MAP_CATALOG } from "../src/content/mapCatalog.js";
import { GameState } from "../src/engine/types.js";
import { createAiBattleHandler } from "../src/scenes/LocalMatchSceneRouter.js";

/**
 * KI-vs-KI battle map gate.
 *
 * Every catalog map marked `battleAvailable` must play a terminating
 * autonomous battle: the battle map selection exposes exactly these maps, so
 * a battle started from the menu must always reach a winner or draw instead
 * of spinning forever. Maps whose geometry blocks every AI kill route (e.g.
 * symmetric-duel's wall-sealed direct lines) stay selectable for human local
 * play but must not be marked `battleAvailable`.
 */
describe("KI vs KI battle map selection", () => {
	const battleMaps = MAP_CATALOG.filter(entry => entry.browserAvailable && entry.battleAvailable);

	test("every battle-selectable map terminates an AI battle with a result", () => {
		expect(battleMaps.length).toBeGreaterThan(0);
		for (const entry of battleMaps) {
			const handler = createAiBattleHandler(entry.id, 777);
			let ticks = 0;
			while (handler.getState() !== GameState.Game_over && ticks < 100_000) {
				handler.tick();
				ticks++;
			}
			expect(handler.getState(), `${entry.id} must terminate`).toBe(GameState.Game_over);
			expect(handler.getMatchResult(), `${entry.id} must produce a result`).toBeDefined();
			for (const entity of handler.getEntityManager().getEntities()) {
				const position = entity.getPos();
				const velocity = entity.getVel();
				expect(Number.isFinite(position.x), entry.id).toBe(true);
				expect(Number.isFinite(position.y), entry.id).toBe(true);
				expect(Number.isFinite(velocity.x), entry.id).toBe(true);
				expect(Number.isFinite(velocity.y), entry.id).toBe(true);
			}
		}
	}, 120_000);
});
