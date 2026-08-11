/**
 * Hardened WinningSystem tests: covers all required contract boundaries
 * from the spec – evaluation state machine, invalid inputs, idempotency,
 * rematch clearing, atomic finishMatch, and local lifecycle integration.
 *
 * Physics-driven kill-zone integration is already covered extensively by
 * tests/winner_state_unification.test.ts and
 * tests/winning_lifecycle_validation.test.ts; this suite focuses on the
 * contract boundaries and state machine behaviour.
 */

import { describe, expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { GameState } from "../src/kore/runtime/types.ts";
import { EffectTrigger, EffectType } from "../src/effects/types.ts";
import { SHAPE } from "../src/physics/physics.ts";
import {
	MatchEndReason,
	MatchStatus,
	RulePhase,
	WinCondition,
	type GameModeSettings,
} from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import {
	WinningSystem,
	evaluateLastTeamStanding,
	type LastTeamStandingEvaluation,
} from "../src/systems/WinningSystem.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stubEntity(team: number[], dead: boolean): { isDead: () => boolean; getTeam: () => number[] } {
	return { isDead: () => dead, getTeam: () => team }
}

/**
 * Builds a safe open arena: no hazards, no kill zones.
 * Death is only ever triggered by calling setIsDead() externally.
 * This gives us full, deterministic control over match-completion timing.
 */
function buildSafeArena() {
	const settings = createDefaultGameSettings(2, 1)
	const tiles = {
		trigger: EffectTrigger.Always,
		triggerValue: [],
		type: EffectType.Physics,
		typeValue: { friction: 0.98, linearDrag: 0.05, stopThreshold: 0.15 },
	}
	const move = {
		trigger: EffectTrigger.Always,
		triggerValue: [],
		type: EffectType.Movement,
		typeValue: { deltaTime: 0, x: 0, y: 0 },
	}
	settings.players[0]!.effects = [move, tiles]
	settings.players[1]!.effects = [move, tiles]
	settings.screenResolution = { x: 3000, y: 1600 }
	settings.worldSize = { x: 3000, y: 1600 }
	settings.mapBoundarys = [
		{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: 3000, h: 1600, effects: [], role: "containment" },
	]
	// Both figures well inside the arena, far from each other.
	settings.players[0]!.position = { x: 750, y: 800 }
	settings.players[1]!.position = { x: 2250, y: 800 }
	settings.items = []
	const gameMode: GameModeSettings = {
		id: "safe-arena-test",
		phases: [RulePhase.Physics],
		maxItemsPerTurn: 0,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: { fixedLoadouts: [], mapPickups: [] },
	}
	settings.gameMode = gameMode
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new WinningSystem(2))
		.fromSettings(settings)
		.build()
	return { handler, settings, gameMode }
}

// ---------------------------------------------------------------------------
// 1. Two or more teams alive
// ---------------------------------------------------------------------------

describe("evaluateLastTeamStanding – two or more teams alive", () => {
	test("two alive teams → Ongoing", () => {
		const entities = [stubEntity([0], false), stubEntity([1], false)] as never
		expect(evaluateLastTeamStanding(entities, 2)).toEqual({ status: MatchStatus.Ongoing })
	})

	test("three alive teams → Ongoing", () => {
		const entities = [
			stubEntity([0], false),
			stubEntity([1], false),
			stubEntity([2], false),
		] as never
		expect(evaluateLastTeamStanding(entities, 3)).toEqual({ status: MatchStatus.Ongoing })
	})

	test("dead figures from both teams still covered by live figures → Ongoing", () => {
		const entities = [
			stubEntity([0], false),
			stubEntity([0], true),
			stubEntity([1], false),
		] as never
		expect(evaluateLastTeamStanding(entities, 2)).toEqual({ status: MatchStatus.Ongoing })
	})

	test("WinningSystem does not finish match while both teams are alive", () => {
		const { handler } = buildSafeArena()
		// Safe arena: both figures alive across multiple ticks.
		expect(handler.getState()).not.toBe(GameState.Game_over)
		handler.tick()
		expect(handler.getState()).not.toBe(GameState.Game_over)
		handler.tick()
		expect(handler.getState()).not.toBe(GameState.Game_over)
		expect(handler.getMatchResult()).toBeUndefined()
	})

	test("no MatchResult is created while match is Ongoing", () => {
		const { handler } = buildSafeArena()
		handler.tick()
		handler.tick()
		handler.tick()
		expect(handler.getMatchResult()).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// 2. Exactly one team alive
// ---------------------------------------------------------------------------

describe("evaluateLastTeamStanding – exactly one team alive", () => {
	test("team 0 alive, team 1 dead → Winner(0)", () => {
		const entities = [stubEntity([0], false), stubEntity([1], true)] as never
		expect(evaluateLastTeamStanding(entities, 2)).toEqual({ status: MatchStatus.Winner, winnerTeam: 0 })
	})

	test("team 1 alive, team 0 dead → Winner(1)", () => {
		const entities = [stubEntity([0], true), stubEntity([1], false)] as never
		expect(evaluateLastTeamStanding(entities, 2)).toEqual({ status: MatchStatus.Winner, winnerTeam: 1 })
	})

	test("multiple figures, only team 2 has any alive → Winner(2)", () => {
		const entities = [
			stubEntity([0], true),
			stubEntity([1], true),
			stubEntity([2], false),
			stubEntity([2], true),
		] as never
		expect(evaluateLastTeamStanding(entities, 3)).toEqual({ status: MatchStatus.Winner, winnerTeam: 2 })
	})
})

describe("WinningSystem – winner match completion", () => {
	test("transitions to Game_over when team 1 is killed", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		expect(handler.getState()).toBe(GameState.Game_over)
	})

	test("transitions to Game_over when team 0 is killed", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[0]!.setIsDead(true)
		handler.tick()
		expect(handler.getState()).toBe(GameState.Game_over)
	})

	test("MatchResult carries correct winner, reason, and turnNumber for team 0 win", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		const result = handler.getMatchResult()!
		expect(result.status).toBe(MatchStatus.Winner)
		expect(result.winnerTeam).toBe(0)
		expect(result.reason).toBe(MatchEndReason.LastTeamStanding)
		expect(result.turnNumber).toBe(0)
	})

	test("MatchResult carries correct winner, reason, and turnNumber for team 1 win", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[0]!.setIsDead(true)
		handler.tick()
		const result = handler.getMatchResult()!
		expect(result.status).toBe(MatchStatus.Winner)
		expect(result.winnerTeam).toBe(1)
		expect(result.reason).toBe(MatchEndReason.LastTeamStanding)
		expect(result.turnNumber).toBe(0)
	})

	test("Game_over always implies a defined MatchResult (invariant)", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		if (handler.getState() === GameState.Game_over) {
			expect(handler.getMatchResult()).toBeDefined()
		}
	})
})

// ---------------------------------------------------------------------------
// 3. No teams alive → draw
// ---------------------------------------------------------------------------

describe("evaluateLastTeamStanding – no teams alive (draw)", () => {
	test("empty entity list → Draw", () => {
		expect(evaluateLastTeamStanding([], 2)).toEqual({ status: MatchStatus.Draw })
	})

	test("all entities dead → Draw", () => {
		const entities = [stubEntity([0], true), stubEntity([1], true)] as never
		expect(evaluateLastTeamStanding(entities, 2)).toEqual({ status: MatchStatus.Draw })
	})

	test("draw evaluation has no winnerTeam property", () => {
		const result = evaluateLastTeamStanding([], 3) as LastTeamStandingEvaluation & { status: MatchStatus.Draw }
		expect(result.status).toBe(MatchStatus.Draw)
		expect("winnerTeam" in result).toBe(false)
	})

	test("handler-produced draw has null winnerTeam, reason Draw, status Draw", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[0]!.setIsDead(true)
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		expect(handler.getState()).toBe(GameState.Game_over)
		const result = handler.getMatchResult()!
		expect(result.status).toBe(MatchStatus.Draw)
		expect(result.winnerTeam).toBeNull()
		expect(result.reason).toBe(MatchEndReason.Draw)
	})

	test("draw winnerTeam is null and never a fake team number", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[0]!.setIsDead(true)
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		const result = handler.getMatchResult()!
		expect(result.winnerTeam).toBeNull()
		expect(typeof result.winnerTeam === "number").toBe(false)
	})
})

// ---------------------------------------------------------------------------
// 4. Invalid teamCount
// ---------------------------------------------------------------------------

describe("evaluateLastTeamStanding – invalid teamCount", () => {
	test("zero throws", () => {
		expect(() => evaluateLastTeamStanding([], 0)).toThrow("at least one team")
	})
	test("negative throws", () => {
		expect(() => evaluateLastTeamStanding([], -1)).toThrow("at least one team")
	})
	test("fractional throws", () => {
		expect(() => evaluateLastTeamStanding([], 1.5)).toThrow("at least one team")
	})
	test("NaN throws", () => {
		expect(() => evaluateLastTeamStanding([], NaN)).toThrow("at least one team")
	})
	test("Infinity throws", () => {
		expect(() => evaluateLastTeamStanding([], Infinity)).toThrow("at least one team")
	})
	test("unsafe integer throws", () => {
		expect(() => evaluateLastTeamStanding([], Number.MAX_SAFE_INTEGER + 1)).toThrow("at least one team")
	})
})

// ---------------------------------------------------------------------------
// 5. Entity team IDs outside configured range
// ---------------------------------------------------------------------------

describe("evaluateLastTeamStanding – entity team IDs outside configured range", () => {
	test("entity with team ID >= teamCount is ignored → Draw", () => {
		const entities = [stubEntity([2], false)] as never
		expect(evaluateLastTeamStanding(entities, 2)).toEqual({ status: MatchStatus.Draw })
	})

	test("entity with negative team ID is ignored → Draw", () => {
		const entities = [stubEntity([-1], false)] as never
		expect(evaluateLastTeamStanding(entities, 2)).toEqual({ status: MatchStatus.Draw })
	})

	test("mix of valid and invalid team IDs: only valid IDs count → Winner(0)", () => {
		const entities = [
			stubEntity([0], false),
			stubEntity([5], false),
			stubEntity([-1], false),
		] as never
		expect(evaluateLastTeamStanding(entities, 3)).toEqual({ status: MatchStatus.Winner, winnerTeam: 0 })
	})

	test("entity with valid+invalid team array: only valid ID is counted", () => {
		const entities = [stubEntity([0, 99], false)] as never
		expect(evaluateLastTeamStanding(entities, 2)).toEqual({ status: MatchStatus.Winner, winnerTeam: 0 })
	})

	test("out-of-range alive entity beside in-range alive entity → Ongoing", () => {
		const entities = [
			stubEntity([0], false),   // valid, alive
			stubEntity([10], false),  // out of range (teamCount=2), ignored
			stubEntity([1], false),   // valid, alive
		] as never
		expect(evaluateLastTeamStanding(entities, 2)).toEqual({ status: MatchStatus.Ongoing })
	})
})

// ---------------------------------------------------------------------------
// 6. Idempotency
// ---------------------------------------------------------------------------

describe("WinningSystem – idempotency after match completion", () => {
	test("ticking a completed match does not change the result", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		const result = handler.getMatchResult()
		for (let i = 0; i < 50; i++) handler.tick()
		expect(handler.getState()).toBe(GameState.Game_over)
		expect(handler.getMatchResult()).toEqual(result)
	})

	test("state stays Game_over across 100 extra ticks", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		for (let i = 0; i < 100; i++) {
			handler.tick()
			expect(handler.getState()).toBe(GameState.Game_over)
		}
	})

	test("snapshot is stable after many extra ticks", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		const snapshot = handler.toSettings()
		for (let i = 0; i < 100; i++) handler.tick()
		expect(handler.toSettings()).toEqual(snapshot)
	})

	test("completion is not applied twice: re-killing remaining entity after game-over does not change result", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		// Record result
		const result = handler.getMatchResult()
		// Kill team 0 as well; WinningSystem must not re-evaluate.
		handler.getEntityManager().getEntities()[0]!.setIsDead(true)
		handler.tick()
		expect(handler.getMatchResult()).toEqual(result)
		expect(handler.getState()).toBe(GameState.Game_over)
	})
})

// ---------------------------------------------------------------------------
// 7. Rematch clears completion state
// ---------------------------------------------------------------------------

describe("WinningSystem – rematch clears prior completion state", () => {
	test("rematch clears Game_over and MatchResult", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		expect(handler.getState()).toBe(GameState.Game_over)
		handler.rematch()
		expect(handler.getState()).toBe(GameState.Your_turn)
		expect(handler.getMatchResult()).toBeUndefined()
	})

	test("rematch resets turn number and active team", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		handler.rematch()
		expect(handler.getTurnNumber()).toBe(0)
		expect(handler.getActiveTeam()).toBe(0)
	})

	test("rematch revives all dead entities", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[0]!.setIsDead(true)
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		handler.rematch()
		expect(handler.getEntityManager().getEntities().every(e => !e.isDead())).toBe(true)
	})

	test("subsequent match after rematch can produce a different winner", () => {
		const { handler } = buildSafeArena()
		// First match: team 1 wins
		handler.getEntityManager().getEntities()[0]!.setIsDead(true)
		handler.tick()
		const firstResult = handler.getMatchResult()
		expect(firstResult!.winnerTeam).toBe(1)

		handler.rematch()
		expect(handler.getMatchResult()).toBeUndefined()

		// Second match: team 0 wins
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		const secondResult = handler.getMatchResult()
		expect(secondResult!.winnerTeam).toBe(0)
		expect(firstResult!.winnerTeam).not.toBe(secondResult!.winnerTeam)
	})

	test("rematch followed by draw produces draw result, not the previous winner result", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		expect(handler.getMatchResult()!.status).toBe(MatchStatus.Winner)

		handler.rematch()
		handler.getEntityManager().getEntities()[0]!.setIsDead(true)
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		const drawResult = handler.getMatchResult()!
		expect(drawResult.status).toBe(MatchStatus.Draw)
		expect(drawResult.winnerTeam).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// 8. Local lifecycle integration
// ---------------------------------------------------------------------------

describe("WinningSystem – local lifecycle integration", () => {
	test("WinningSystem ends match automatically after manual elimination", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		expect(handler.getState()).toBe(GameState.Game_over)
		expect(handler.getMatchResult()).toBeDefined()
	})

	test("snapshot restoration preserves Game_over and MatchResult", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		const result = handler.getMatchResult()
		const restored = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(2))
			.fromSettings(handler.toSettings())
			.build()
		expect(restored.getState()).toBe(GameState.Game_over)
		expect(restored.getMatchResult()).toEqual(result)
	})

	test("restored completed match stays frozen after further ticks", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		const restored = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(2))
			.fromSettings(handler.toSettings())
			.build()
		const frozenResult = restored.getMatchResult()
		const frozenState = restored.getState()
		for (let i = 0; i < 50; i++) restored.tick()
		expect(restored.getMatchResult()).toEqual(frozenResult)
		expect(restored.getState()).toBe(frozenState)
		expect(restored.getState()).toBe(GameState.Game_over)
	})

	test("rematch after WinningSystem completion resets to a clean match", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		handler.rematch()
		expect(handler.getState()).toBe(GameState.Your_turn)
		expect(handler.getMatchResult()).toBeUndefined()
		expect(handler.getTurnNumber()).toBe(0)
		expect(handler.getEntityManager().getEntities().every(e => !e.isDead())).toBe(true)
	})

	test("draw match snapshot restoration preserves draw result", () => {
		const { handler } = buildSafeArena()
		handler.getEntityManager().getEntities()[0]!.setIsDead(true)
		handler.getEntityManager().getEntities()[1]!.setIsDead(true)
		handler.tick()
		const drawResult = handler.getMatchResult()
		const restored = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(2))
			.fromSettings(handler.toSettings())
			.build()
		expect(restored.getState()).toBe(GameState.Game_over)
		expect(restored.getMatchResult()).toEqual(drawResult)
	})
})

// ---------------------------------------------------------------------------
// finishMatch atomicity contract
// ---------------------------------------------------------------------------

describe("finishMatch – atomic match completion invariant", () => {
	test("finishMatch stores result and sets Game_over atomically", () => {
		const { handler } = buildSafeArena()
		const result = {
			status: MatchStatus.Winner as const,
			winnerTeam: 0,
			reason: MatchEndReason.LastTeamStanding,
			turnNumber: 7,
		}
		handler.finishMatch(result)
		// Both state and result are always set together.
		expect(handler.getState()).toBe(GameState.Game_over)
		expect(handler.getMatchResult()).toEqual(result)
	})

	test("finishMatch with Draw produces null winnerTeam and correct status", () => {
		const { handler } = buildSafeArena()
		const drawResult = {
			status: MatchStatus.Draw as const,
			winnerTeam: null as null,
			reason: MatchEndReason.Draw,
			turnNumber: 3,
		}
		handler.finishMatch(drawResult)
		expect(handler.getState()).toBe(GameState.Game_over)
		const stored = handler.getMatchResult()!
		expect(stored.status).toBe(MatchStatus.Draw)
		expect(stored.winnerTeam).toBeNull()
	})

	test("finishMatch result is reflected in toSettings snapshot", () => {
		const { handler } = buildSafeArena()
		const result = {
			status: MatchStatus.Winner as const,
			winnerTeam: 1,
			reason: MatchEndReason.LastTeamStanding,
			turnNumber: 5,
		}
		handler.finishMatch(result)
		const snapshot = handler.toSettings()
		expect(snapshot.state).toBe(GameState.Game_over)
		expect(snapshot.matchResult).toEqual(result)
	})
})
