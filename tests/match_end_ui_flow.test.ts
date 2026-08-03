import { expect, test } from "bun:test";
import { GameState } from "../src/engine/types.ts";
import { MatchEndReason, MatchStatus } from "../src/rules/types.ts";
import { MatchResultOverlay } from "../src/ui/MatchResultOverlay.ts";
import { LocalMatchSceneRouter } from "../src/scenes/LocalMatchSceneRouter.ts";
import { createCanonicalPlayableMatchHandler } from "../src/settings/canonicalPlayableMatch.ts";

function renderer(labels: string[]) {
	return {
		WORLD_SIZE_X: 800, WORLD_SIZE_Y: 450,
		push() { }, pop() { }, setFillColor() { }, setNoFill() { }, setStrokeColor() { }, setStroke() { },
		drawCircle() { }, drawRect() { }, drawText(text: string) { labels.push(text); }, line() { }, rotate() { }, scale() { }, translate() { },
		drawImage() { }, getScreenSize: () => ({ width: 800, height: 450 }), clear() { }, resizeCanvas() { }, setScaleFactor() { }, getScaleFactor: () => 1,
		toWorld: (value: number) => value, toPixel: (value: number) => value, windowScale: () => 1, beginClip() { }, endClip() { }, mouseWheel() { },
	};
}

function completedHandler() {
	const handler = createCanonicalPlayableMatchHandler();
	handler.setMatchResult({ status: MatchStatus.Winner, winnerTeam: 1, reason: MatchEndReason.LastTeamStanding, turnNumber: 3 });
	handler.setState(GameState.Game_over);
	return handler;
}

test("result overlay renders the authoritative winner or draw only after game over", () => {
	const handler = createCanonicalPlayableMatchHandler();
	const actions: string[] = [];
	const overlay = new MatchResultOverlay(handler, action => actions.push(action));
	const before: string[] = [];
	overlay.draw(renderer(before));
	expect(before).toEqual([]);

	handler.setMatchResult({ status: MatchStatus.Winner, winnerTeam: 1, reason: MatchEndReason.LastTeamStanding, turnNumber: 3 });
	handler.setState(GameState.Game_over);
	const winner: string[] = [];
	overlay.draw(renderer(winner));
	expect(winner).toContain("Team 2 wins");

	handler.setMatchResult({ status: MatchStatus.Draw, winnerTeam: null, reason: MatchEndReason.Draw, turnNumber: 3 });
	const draw: string[] = [];
	overlay.draw(renderer(draw));
	expect(draw).toContain("Draw");
	expect(draw.some(label => label.includes("Team"))).toBe(false);
	overlay.updateMouse(250, 310);
	overlay.handleMousePressed();
	expect(actions).toEqual(["rematch"]);
	overlay.updateMouse(250, 365);
	overlay.handleMousePressed();
	overlay.updateMouse(420, 365);
	overlay.handleMousePressed();
	expect(actions).toEqual(["rematch", "replay", "share"]);
});

test("router rematch clears the result and menu action disposes the match handler", () => {
	let created = 0;
	const router = new LocalMatchSceneRouter(() => { created++; return createCanonicalPlayableMatchHandler(); });
	expect(router.startLocalMatch()).toBe(true);
	const handler = router.getHandler();
	handler.setMatchResult({ status: MatchStatus.Winner, winnerTeam: 0, reason: MatchEndReason.LastTeamStanding, turnNumber: 2 });
	handler.setState(GameState.Game_over);
	expect(router.isResultVisible()).toBe(true);
	handler.updateMouse(250, 310);
	handler.handleMousePressed();
	expect(router.getHandler()).toBe(handler);
	expect(handler.getMatchResult()).toBeUndefined();
	expect(handler.getState()).toBe(GameState.Your_turn);

	handler.setMatchResult({ status: MatchStatus.Draw, winnerTeam: null, reason: MatchEndReason.Draw, turnNumber: 2 });
	handler.setState(GameState.Game_over);
	handler.updateMouse(410, 310);
	handler.handleMousePressed();
	expect(router.getHandler()).not.toBe(handler);
	expect(router.isLocalMatch()).toBe(false);
	expect(created).toBe(1);
});

test("completed result overlay consumes gameplay input", () => {
	const handler = completedHandler();
	const overlay = new MatchResultOverlay(handler, () => { });
	overlay.updateMouse(40, 40);
	overlay.handleMousePressed();
	overlay.handleMouseReleased();
	expect(handler.getState()).toBe(GameState.Game_over);
});
