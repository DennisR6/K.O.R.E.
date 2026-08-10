import { expect, test } from "bun:test";
import { CombiEmitter } from "../src/emitter/InputEmitter.ts";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameState } from "../src/engine/types.ts";
import type { RenderContext } from "../src/engine/RenderContext.ts";
import { ItemPhaseUI } from "../src/ui/ItemPhaseUI.ts";
import { LocalMatchSceneRouter } from "../src/scenes/LocalMatchSceneRouter.ts";
import { RulePhase } from "../src/rules/types.ts";
import { createCanonicalPlayableMatchHandler } from "../src/settings/canonicalPlayableMatch.ts";
import { EmitterSystem } from "../src/systems/Emitter.ts";
import { UiSystem } from "../src/systems/UiSystem.ts";

function renderer(text: string[]): RenderContext {
	return {
		WORLD_SIZE_X: 800, WORLD_SIZE_Y: 450,
		push() { }, pop() { }, clear() { }, setFillColor() { }, setNoFill() { }, setStrokeColor() { }, setStroke() { },
		drawCircle() { }, drawRect() { }, drawText(value: string) { text.push(value); }, line() { }, rotate() { }, scale() { }, translate() { }, setOpacity() { },
		drawImage() { }, getScreenSize: () => ({ width: 800, height: 450 }), resizeCanvas() { }, setScaleFactor() { }, getScaleFactor: () => 1,
		toWorld: (value: number) => value, toPixel: (value: number) => value, windowScale: () => 1, beginClip() { }, endClip() { }, mouseWheel() { },
		noStroke() { }, getTextWidth: (text: string, size: number) => text.length * size * 0.6,
	};
}

function createHarness() {
	let itemUI: ItemPhaseUI | undefined;
	let ui: UiSystem | undefined;
	const router = new LocalMatchSceneRouter(() => {
		const handler = createCanonicalPlayableMatchHandler();
		ui = new UiSystem();
		const emitters = new CombiEmitter();
		emitters.addEmitter(new GameEmitter(handler, handler.getSettings()!.gameMode, 2));
		itemUI = new ItemPhaseUI(handler, emitters);
		handler.addSystem(ui);
		handler.setMouseHandler(ui);
		handler.addSystem(new EmitterSystem(emitters));
		return handler;
	});
	return { router, getItemUI: () => itemUI!, getUi: () => ui! };
}

function click(router: LocalMatchSceneRouter, x: number, y: number): void {
	router.getHandler().updateMouse(x, y);
	router.getHandler().handleMousePressed();
}

function completeMatch(router: LocalMatchSceneRouter, itemUI: ItemPhaseUI, ui: UiSystem): number {
	const match = router.getHandler();
	let turns = 0;
	while (match.getState() !== GameState.Game_over && turns < 100) {
		expect(match.getState()).toBe(GameState.Your_turn);
		if (match.getRuleState().phase === RulePhase.Item) itemUI.skip();
		expect(match.getRuleState().phase).toBe(RulePhase.Physics);
		const actor = match.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(match.getActiveTeam()));
		expect(actor).toBeDefined();
		const position = actor!.getPos();
		match.updateMouse(position.x, position.y);
		match.handleMousePressed();
		ui.setAimAngle(actor!.getId(), 220);
		ui.setChargePower(10);
		match.tick();
		while (match.getState() === GameState.Playing) match.tick();
		turns++;
	}
	return turns;
}

test("menu to canonical match to result and back through the application surface", () => {
	const { router, getItemUI, getUi } = createHarness();
	const menuText: string[] = [];
	router.getHandler().drawWorld(renderer(menuText));
	expect(router.isLocalMatch()).toBe(false);

	click(router, 10, 10);
	expect(router.isLocalMatch()).toBe(false);
	const mainMenuText: string[] = [];
	router.getHandler().drawWorld(renderer(mainMenuText));
	expect(mainMenuText).toEqual(expect.arrayContaining(["Play", "Local", "Game"]));
	click(router, 463, 368);

	const match = router.getHandler();
	const mapText: string[] = [];
	match.drawWorld(renderer(mapText));
	expect(router.isLocalMatch()).toBe(true);
	expect(mapText).toContain("Team 1 | item | Turn 1");
	expect(match.getRuleState().phase).toBe(RulePhase.Item);

	const turns = completeMatch(router, getItemUI(), getUi());

	expect(turns).toBeLessThan(100);
	expect(match.getState()).toBe(GameState.Game_over);
	expect(router.isResultVisible()).toBe(true);
	const resultText: string[] = [];
	match.drawWorld(renderer(resultText));
	expect(resultText.some(text => text === "Draw" || text.includes("wins"))).toBe(true);

	click(router, 300, 320);
	expect(router.isLocalMatch()).toBe(true);
	expect(router.getHandler().getState()).toBe(GameState.Your_turn);
	completeMatch(router, getItemUI(), getUi());
	expect(router.isResultVisible()).toBe(true);
	click(router, 450, 320);
	expect(router.isLocalMatch()).toBe(false);
}, { timeout: 30_000 });
