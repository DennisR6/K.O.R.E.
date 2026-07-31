import { expect, test } from "bun:test";
import { GameState } from "../src/engine/types.ts";
import { MatchEndReason, MatchStatus } from "../src/rules/types.ts";
import { LocalMatchSceneRouter, createLocalGameplayHandler } from "../src/scenes/LocalMatchSceneRouter.ts";

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
		const input = match.getMouseHandler() as { selectedActorId?: string | null };
		input.selectedActorId = "stale-selection";
		finish(match);

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
		rematch.updateMouse(250, 310);
		rematch.handleMousePressed();
		expect(rematchInput?.selectedActorId).toBeNull();
		expect(rematch.getState()).toBe(GameState.Your_turn);
		finish(rematch);
		rematch.updateMouse(410, 310);
		rematch.handleMousePressed();
		expect(rematch.isDisposed()).toBe(true);
		expect(router.isLocalMatch()).toBe(false);
	}

	expect(created).toBe(6);
});
