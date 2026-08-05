import { expect, test } from "bun:test";
import { GameState } from "../src/engine/types.ts";
import { MatchEndReason, MatchStatus } from "../src/rules/types.ts";
import { LocalMatchSceneRouter, createLocalGameplayHandler } from "../src/scenes/LocalMatchSceneRouter.ts";

/** Minimal render context: the SDK HUD refreshes its projection on every drawn frame. */
function renderer() {
	return {
		WORLD_SIZE_X: 800, WORLD_SIZE_Y: 450,
		clear() { }, push() { }, pop() { }, setFillColor() { }, setNoFill() { }, setStrokeColor() { }, setStroke() { },
		drawCircle() { }, drawRect() { }, drawText() { }, line() { }, rotate() { }, scale() { }, translate() { },
		drawImage() { }, getScreenSize: () => ({ width: 800, height: 450 }), resizeCanvas() { }, setScaleFactor() { }, getScaleFactor: () => 1,
		toWorld: (value: number) => value, toPixel: (value: number) => value, windowScale: () => 1, beginClip() { }, endClip() { }, mouseWheel() { },
	};
}

function finish(handler: ReturnType<typeof createLocalGameplayHandler>): void {
	handler.setMatchResult({ status: MatchStatus.Winner, winnerTeam: 1, reason: MatchEndReason.LastTeamStanding, turnNumber: 1 });
	handler.setState(GameState.Game_over);
}

test("repeated match lifecycle tears down old scene ownership and resets input", () => {
	let created = 0;
	const router = new LocalMatchSceneRouter(() => { created++; return createLocalGameplayHandler(); });

	for (let cycle = 0; cycle < 3; cycle++) {
		expect(router.startLocalMatch()).toBe(true);
		const match = router.getHandler();
		let ticks = 0;
		match.addPreTicker({ tick: () => { ticks++; } });
		// A finished match freezes its tick loop; the SDK HUD overlay becomes
		// interactive on the next drawn frame, exactly like the browser loop.
		finish(match);
		match.drawWorld(renderer() as never);

		match.updateMouse(410, 310);
		match.handleMousePressed();
		expect(match.isDisposed()).toBe(true);
		expect(router.isLocalMatch()).toBe(false);
		match.tick();
		match.handleMousePressed();
		expect(ticks).toBe(0);

		expect(router.startLocalMatch()).toBe(true);
		const rematch = router.getHandler();
		const rematchInput = (rematch.getMouseHandler() as { getGameplayInput(): { selectedActorId?: string | null } }).getGameplayInput();
		finish(rematch);
		rematch.drawWorld(renderer() as never);
		rematch.updateMouse(250, 310);
		rematch.handleMousePressed();
		expect(rematchInput?.selectedActorId).toBeNull();
		expect(rematch.getState()).toBe(GameState.Your_turn);
		finish(rematch);
		rematch.drawWorld(renderer() as never);
		rematch.updateMouse(410, 310);
		rematch.handleMousePressed();
		expect(rematch.isDisposed()).toBe(true);
		expect(router.isLocalMatch()).toBe(false);
	}

	expect(created).toBe(6);
});