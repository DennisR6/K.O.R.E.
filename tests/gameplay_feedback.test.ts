import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState, type IInputEmitter } from "../src/engine/types.ts";
import { GameplayFeedback } from "../src/ui/GameplayFeedback.ts";
import { UiSystem } from "../src/systems/UiSystem.ts";
import { EmitterSystem } from "../src/systems/Emitter.ts";
import { MatchEndReason, MatchStatus, RulePhase } from "../src/rules/types.ts";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.ts";

function renderer(labels: string[]) {
	return {
		WORLD_SIZE_X: 800,
		WORLD_SIZE_Y: 450,
		push() { }, pop() { }, setFillColor() { }, setNoFill() { }, setStrokeColor() { }, setStroke() { },
		drawCircle() { }, drawRect() { }, drawText(text: string) { labels.push(text); }, line() { }, rotate() { }, scale() { }, translate() { },
		drawImage() { }, getScreenSize: () => ({ width: 800, height: 450 }), clear() { }, resizeCanvas() { }, setScaleFactor() { }, getScaleFactor: () => 1,
		toWorld: (value: number) => value, toPixel: (value: number) => value, windowScale: () => 1, beginClip() { }, endClip() { }, mouseWheel() { },
	};
}

test("GameplayFeedback exposes authoritative turn, selection, aim, power, and items", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createCanonicalPlayableMatchSettings()).build();
	const ui = new UiSystem();
	const actor = handler.getEntityManager().getEntities()[0]!;
	ui.setAimAngle(actor.getId(), 45);
	ui.setChargePower(7.5);
	const feedback = new GameplayFeedback(handler, ui);
	const state = feedback.getState();

	expect(state.activeTeam).toBe(0);
	expect(state.phase).toBe(RulePhase.Item);
	expect(state.selectedActorId).toBe(actor.getId());
	expect(state.aimAngle).toBe(45);
	expect(state.power).toBe(7.5);
	expect(state.availableItems).toEqual(["power-dash (1)"]);
	expect(state.playbackLocked).toBe(false);
});

test("GameplayFeedback marks playback as locked and renders winner or draw without stale results after rematch", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createCanonicalPlayableMatchSettings()).build();
	const feedback = new GameplayFeedback(handler, new UiSystem());
	handler.setState(GameState.Playing);
	expect(feedback.getState().playbackLocked).toBe(true);

	handler.setMatchResult({ status: MatchStatus.Winner, winnerTeam: 1, reason: MatchEndReason.LastTeamStanding, turnNumber: 0 });
	const winnerLabels: string[] = [];
	feedback.draw(renderer(winnerLabels));
	expect(winnerLabels).toContain("Winner: Team 2");

	handler.setMatchResult({ status: MatchStatus.Draw, winnerTeam: null, reason: MatchEndReason.Draw, turnNumber: 0 });
	const drawLabels: string[] = [];
	feedback.draw(renderer(drawLabels));
	expect(drawLabels).toContain("Draw");
	expect(drawLabels.some(label => label.includes("Winner:"))).toBe(false);

	handler.rematch();
	expect(feedback.getState().result).toBeUndefined();
	expect(feedback.getState().playbackLocked).toBe(false);
});

test("rejected emitter actions return to the turn and expose only an actionable message", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createCanonicalPlayableMatchSettings()).build();
	const ui = new UiSystem();
	const feedback = new GameplayFeedback(handler, ui);
	const emitter: IInputEmitter = { sendShot: () => { throw new Error("Invalid shot input\nsecret stack trace"); } };
	const system = new EmitterSystem(emitter, error => feedback.setRejection(error));
	const context = handler.getContext();
	context.state = GameState.Turn_done;
	context.mouse.turn = { actorId: "actor", angle: 10, power: 4 };
	system.ticker(context, 1, 0);

	expect(context.state).toBe(GameState.Your_turn);
	const state = feedback.getState();
	expect(state.rejection).toBe("Invalid shot input secret stack trace");
	expect(state.rejection).not.toContain("Error:");
	expect(state.rejection).not.toContain("\n");
	const labels: string[] = [];
	feedback.draw(renderer(labels));
	expect(labels).toContain("Input: Ready");
	expect(labels.some(label => label.startsWith("Action rejected: Invalid shot input"))).toBe(true);
});
