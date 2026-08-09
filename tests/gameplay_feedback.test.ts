import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState, type IInputEmitter } from "../src/engine/types.ts";
import { UiSystem } from "../src/systems/UiSystem.ts";
import { EmitterSystem } from "../src/systems/Emitter.ts";
import { MatchEndReason, MatchStatus, RulePhase } from "../src/rules/types.ts";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.ts";
import { createKoreHudProjection, hudResultText } from "../src/kore/ui/gameHudProjection.ts";

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

test("HUD projection exposes authoritative turn, selection, aim, power, and items", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createCanonicalPlayableMatchSettings()).build();
	const ui = new UiSystem();
	const actor = handler.getEntityManager().getEntities()[0]!;
	ui.setAimAngle(actor.getId(), 45);
	ui.setChargePower(7.5);
	const state = createKoreHudProjection(handler, ui);

	expect(state.turn.activeTeam).toBe(0);
	expect(state.turn.phase).toBe(RulePhase.Item);
	expect(state.turn.selectedActorId).toBe(actor.getId());
	expect(state.turn.aimAngle).toBe(45);
	expect(state.turn.power).toBe(7.5);
	expect(state.inventory).toEqual([
		{ itemId: "power-dash", name: "Power-Dash", description: "Boosts the next applied force by a configured multiplier.", targetType: "self", remainingUses: 1, enabled: true, showLabel: true },
	]);
	expect(state.match.inputLocked).toBe(false);
});

test("HUD projection marks playback as locked and clears results after rematch", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createCanonicalPlayableMatchSettings()).build();
	handler.setState(GameState.Playing);
	expect(createKoreHudProjection(handler, new UiSystem()).match.inputLocked).toBe(true);

	handler.setMatchResult({ status: MatchStatus.Winner, winnerTeam: 1, reason: MatchEndReason.LastTeamStanding, turnNumber: 0 });
	expect(hudResultText(createKoreHudProjection(handler).match.result)).toBe("Team 2 wins");

	handler.setMatchResult({ status: MatchStatus.Draw, winnerTeam: null, reason: MatchEndReason.Draw, turnNumber: 0 });
	expect(hudResultText(createKoreHudProjection(handler).match.result)).toBe("Draw");

	handler.rematch();
	expect(createKoreHudProjection(handler).match.result).toBeUndefined();
	expect(createKoreHudProjection(handler).match.inputLocked).toBe(false);
});

test("rejected emitter actions return to the turn and expose only an actionable message", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createCanonicalPlayableMatchSettings()).build();
	const ui = new UiSystem();
	let rejection: unknown;
	const emitter: IInputEmitter = { sendShot: () => { throw new Error("Invalid shot input\nsecret stack trace"); } };
	const system = new EmitterSystem(emitter, error => { rejection = error; });
	const context = handler.getContext();
	context.state = GameState.Turn_done;
	context.mouse.turn = { actorId: "actor", angle: 10, power: 4 };
	system.ticker(context, 1, 0);

	expect(context.state).toBe(GameState.Your_turn);
	const state = createKoreHudProjection(handler, ui, rejection instanceof Error ? rejection.message : undefined);
	expect(state.rejection).toBe("Invalid shot input secret stack trace");
	expect(state.rejection).not.toContain("Error:");
	expect(state.rejection).not.toContain("\n");
});
