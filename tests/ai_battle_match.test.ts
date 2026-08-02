import { describe, expect, test } from "bun:test";
import { GameHandler, GameHandlerBuilder } from "../src/engine/Handler.js";
import { GameState } from "../src/engine/types.js";
import { MatchStatus, RulePhase } from "../src/rules/types.js";
import { createAiBattleHandler } from "../src/scenes/LocalMatchSceneRouter.js";

/**
 * Headless KI-vs-KI battle verification.
 *
 * The browser battle path (`createAiBattleHandler`) must play a complete,
 * deterministic match without any human input: the `AiBattleSystem` drives
 * both teams through the shared `AiTurnEmitter` boundary, skipping the item
 * phase and submitting one legal shot per physics phase.
 */

function runBattle(seed: number, maxTicks = 400_000): { handler: GameHandler; ticks: number } {
	const handler = createAiBattleHandler("ice-map-v1", seed);
	let ticks = 0;
	while (handler.getState() !== GameState.Game_over && ticks < maxTicks) {
		handler.tick();
		ticks++;
	}
	return { handler, ticks };
}

describe("KI vs KI battle handler", () => {
	test("plays a deterministic battle to completion with a consistent result", () => {
		const { handler, ticks } = runBattle(4242);
		expect(handler.getState()).toBe(GameState.Game_over);
		const result = handler.getMatchResult();
		expect(result).toBeDefined();
		expect(ticks).toBeGreaterThan(0);
		if (result!.status === MatchStatus.Winner) {
			expect(result!.winnerTeam).toBeGreaterThanOrEqual(0);
			expect(result!.winnerTeam).toBeLessThan(2);
		} else {
			expect(result!.status).toBe(MatchStatus.Draw);
			expect(result!.winnerTeam).toBeNull();
		}
		// The rule state must have left the per-turn phases (item allowance
		// reset), i.e. the last turn completed its physics phase.
		expect(handler.getRuleState().phase).toBe(RulePhase.Physics);
	});

	test("keeps every entity state finite throughout the battle", () => {
		const handler = createAiBattleHandler("ice-map-v1", 1337);
		for (let tick = 0; tick < 5_000; tick++) {
			handler.tick();
			for (const entity of handler.getEntityManager().getEntities()) {
				const position = entity.getPos();
				const velocity = entity.getVel();
				expect(Number.isFinite(position.x)).toBe(true);
				expect(Number.isFinite(position.y)).toBe(true);
				expect(Number.isFinite(velocity.x)).toBe(true);
				expect(Number.isFinite(velocity.y)).toBe(true);
			}
			if (handler.getState() === GameState.Game_over) break;
		}
	});

	test("both teams take turns through the battle", () => {
		const handler = createAiBattleHandler("ice-map-v1", 4242);
		const teamsActed = new Set<number>();
		for (let tick = 0; tick < 20_000; tick++) {
			handler.tick();
			const rule = handler.getRuleState();
			if (rule.turnNumber > 0 && rule.phase === RulePhase.Physics) teamsActed.add(rule.activeTeam);
			if (teamsActed.size === 2) break;
			if (handler.getState() === GameState.Game_over) break;
		}
		expect(teamsActed.size).toBe(2);
	});

	test("persistence round trip restores the completed battle", () => {
		const { handler } = runBattle(4242);
		const finalSnapshot = JSON.parse(JSON.stringify(handler.toSettings()));
		const rebuilt = new GameHandlerBuilder().defaultSystems().fromSettings(finalSnapshot).build();
		expect(JSON.stringify(rebuilt.toSettings())).toBe(JSON.stringify(finalSnapshot));
		expect(rebuilt.getMatchResult()).toEqual(handler.getMatchResult());
	});

	test("rematch resets the completed battle and plays it again", () => {
		const { handler } = runBattle(4242);
		expect(handler.getState()).toBe(GameState.Game_over);
		handler.rematch();
		expect(handler.getTurnNumber()).toBe(0);
		expect(handler.getState()).toBe(GameState.Your_turn);
		expect(handler.getMatchResult()).toBeUndefined();
		// The battle must keep playing after a rematch.
		let ticks = 0;
		while (handler.getState() !== GameState.Game_over && ticks < 400_000) {
			handler.tick();
			ticks++;
		}
		expect(handler.getState()).toBe(GameState.Game_over);
		expect(handler.getMatchResult()).toBeDefined();
	});
});
