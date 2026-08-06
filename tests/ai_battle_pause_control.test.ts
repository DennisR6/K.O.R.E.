import { expect, test } from "bun:test";
import { createAiBattleHandler, LocalMatchSceneRouter } from "../src/scenes/LocalMatchSceneRouter.js";
import { installGameplayHud } from "../src/scenes/gameplayHud.js";
import { GameState } from "../src/engine/types.js";

function click(handler: ReturnType<typeof createAiBattleHandler>, x: number, y: number): void {
	handler.updateMouse(x, y);
	handler.handleMousePressed();
}

function activeBattle(): ReturnType<typeof createAiBattleHandler> {
	const handler = createAiBattleHandler("ice-map-v1", 4040);
	installGameplayHud(handler);
	handler.tick();
	handler.tick();
	if (handler.getState() !== GameState.Playing) throw new Error("AI fixture did not enter playback");
	return handler;
}

function recordedActionCount(handler: ReturnType<typeof createAiBattleHandler>): number {
	const system = handler.getSystems().find(candidate => (candidate as { systemId?: string }).systemId === "core.emitter") as { emitter?: { recorder?: { getReplay(): { actions: unknown[] } } } } | undefined;
	return system?.emitter?.recorder?.getReplay().actions.length ?? -1;
}

test("pausing an active AI battle freezes ticks, snapshots, and AI scheduling", () => {
	const handler = activeBattle();
	const beforePause = JSON.stringify(handler.toSettings());
	const actionsBeforePause = recordedActionCount(handler);
	click(handler, 748, 25);
	expect(handler.isPaused()).toBe(true);
	expect(JSON.stringify(handler.toSettings())).toBe(beforePause);
	for (let index = 0; index < 20; index++) handler.tick();
	expect(JSON.stringify(handler.toSettings())).toBe(beforePause);
	expect(recordedActionCount(handler)).toBe(actionsBeforePause);

	// A repeated pause command is harmless even before the next projection tick.
	click(handler, 748, 25);
	expect(handler.isPaused()).toBe(true);
	expect(JSON.stringify(handler.toSettings())).toBe(beforePause);
	expect(recordedActionCount(handler)).toBe(actionsBeforePause);

	click(handler, 400, 261);
	expect(handler.isPaused()).toBe(false);
	const actionsAfterResume = recordedActionCount(handler);
	click(handler, 400, 261);
	expect(handler.isPaused()).toBe(false);
	expect(recordedActionCount(handler)).toBe(actionsAfterResume);
	handler.tick();
	expect(JSON.stringify(handler.toSettings())).not.toBe(beforePause);
});

test("returning to the menu while an AI battle is paused disposes the battle", () => {
	const router = new LocalMatchSceneRouter(undefined, () => 5050);
	expect(router.startAiBattle("ice-map-v1")).toBe(true);
	const battle = router.getHandler();
	battle.tick();
	battle.tick();
	if (battle.getState() !== GameState.Playing) throw new Error("AI fixture did not enter playback");
	click(battle, 748, 25);
	expect(battle.isPaused()).toBe(true);
	click(battle, 482, 324);
	expect(battle.isDisposed()).toBe(true);
	expect(router.getMapId()).toBeNull();
	expect(router.getHandler()).not.toBe(battle);
	for (let index = 0; index < 10; index++) battle.tick();
	expect(battle.isDisposed()).toBe(true);
});
