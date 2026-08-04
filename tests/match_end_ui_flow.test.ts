import { expect, test } from "bun:test";
import { GameState } from "../src/engine/types.ts";
import { MatchEndReason, MatchStatus } from "../src/rules/types.ts";
import { LocalMatchSceneRouter } from "../src/scenes/LocalMatchSceneRouter.ts";
import { createCanonicalPlayableMatchHandler } from "../src/settings/canonicalPlayableMatch.ts";
import { createKoreGameHudSurface } from "../src/kore/ui/KoreGameHudSurface.ts";
import { createKoreHudProjection } from "../src/kore/ui/gameHudProjection.ts";
import { KoreHudCommand } from "../src/kore/ui/hudCommands.ts";

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

test("HUD result controls render the authoritative winner or draw and consume gameplay input", () => {
	const handler = createCanonicalPlayableMatchHandler();
	const actions: unknown[] = [];
	let gameplayPresses = 0;
	const overlay = createKoreGameHudSurface({ handle: action => actions.push(action) }, { updateMouse() {}, handleMousePressed() { gameplayPresses++; }, handleMouseReleased() {}, handleMouseWheel() {} });
	const before: string[] = [];
	overlay.applyProjection(createKoreHudProjection(handler));
	overlay.draw(renderer(before));
	expect(before.some(text => text.includes("wins") || text === "Draw")).toBe(false);

	handler.setMatchResult({ status: MatchStatus.Winner, winnerTeam: 1, reason: MatchEndReason.LastTeamStanding, turnNumber: 3 });
	handler.setState(GameState.Game_over);
	overlay.applyProjection(createKoreHudProjection(handler));
	const winner: string[] = []; overlay.draw(renderer(winner));
	expect(winner).toContain("Team 2 wins");

	handler.setMatchResult({ status: MatchStatus.Draw, winnerTeam: null, reason: MatchEndReason.Draw, turnNumber: 3 });
	overlay.applyProjection(createKoreHudProjection(handler));
	const draw: string[] = []; overlay.draw(renderer(draw));
	expect(draw).toContain("Draw");
	overlay.updateMouse(250, 310);
	overlay.handleMousePressed();
	expect(actions).toEqual([{ type: KoreHudCommand.Rematch, payload: undefined }]);
	overlay.updateMouse(250, 365);
	overlay.handleMousePressed();
	overlay.updateMouse(420, 365);
	overlay.handleMousePressed();
	expect(actions).toEqual([
		{ type: KoreHudCommand.Rematch, payload: undefined },
		{ type: KoreHudCommand.Replay, payload: undefined },
		{ type: KoreHudCommand.Share, payload: undefined },
	]);
	expect(gameplayPresses).toBe(0);
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
