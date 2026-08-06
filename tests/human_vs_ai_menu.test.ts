import { expect, test } from "bun:test";
import { GameState } from "../src/engine/types.ts";
import { createKoreMainMenuSurface, type KoreMainMenuSurface } from "../src/kore/ui/KoreMainMenuSurface.ts";
import { RulePhase } from "../src/rules/types.ts";
import { createHumanVsAiHandler } from "../src/scenes/LocalMatchSceneRouter.ts";
import { MAP_CATALOG } from "../src/content/mapCatalog.ts";

const firstMapId = MAP_CATALOG.find(entry => entry.browserAvailable)!.id;

function press(menu: KoreMainMenuSurface, x: number, y: number): void {
	menu.updateMouse(x, y);
	menu.handleMousePressed();
}

test("1 vs KI menu selects difficulty before starting the selected map", () => {
	const starts: Array<{ difficulty: string; mapId: string }> = [];
	const menu = createKoreMainMenuSurface({ onPlayAiOpponent: (difficulty, mapId) => starts.push({ difficulty, mapId }) });
	press(menu, 400, 100); // landing -> main menu
	press(menu, 400, 141); // 1 vs KI
	press(menu, 400, 214); // medium KI
	press(menu, 400, 100); // first map
	expect(starts).toEqual([{ difficulty: "medium", mapId: firstMapId }]);
});

test("human-vs-KI handler accepts only team 0 input and lets team 1 act automatically", () => {
	const handler = createHumanVsAiHandler("ice-map-v1", "easy", 1234);
	expect(handler.getTeam()).toEqual([0]);
	expect(handler.toSettings().ai).toMatchObject({ difficulty: "easy", team: 1, seed: 1234 });
	handler.startTurn({ phase: RulePhase.Physics, activeTeam: 1, turnNumber: 1, itemUses: 0 });
	handler.setState(GameState.Opponents_turn);
	handler.tick();
	expect(handler.getState()).toBe(GameState.Playing);
	expect(handler.getPlaybackFramesRemaining()).toBeGreaterThanOrEqual(0);
});
