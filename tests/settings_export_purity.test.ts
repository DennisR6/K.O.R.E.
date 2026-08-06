import { describe, expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import { powerDashItem } from "../src/item/officialItems.ts";
import { RulePhase, WinCondition, type GameModeSettings } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { WinningSystem } from "../src/systems/WinningSystem.ts";

/**
 * Task 12.10 - Make Settings Export Pure.
 *
 * `handler.toSettings()` is a pure export: repeated exports are equal, they
 * never mutate stored settings or internal state, and caller mutations of a
 * returned export can never leak into later exports or the live handler.
 */

function midMatch() {
	const settings = createDefaultGameSettings(2, 1);
	const gameMode: GameModeSettings = {
		id: "export-purity",
		phases: [RulePhase.Item, RulePhase.Physics],
		maxItemsPerTurn: 1,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: {
			fixedLoadouts: [
				{ team: 0, items: [{ itemId: "power-dash", uses: 2 }] },
				{ team: 1, items: [{ itemId: "power-dash", uses: 2 }] },
			],
			mapPickups: [],
			randomDraw: { seed: 7, itemIds: ["power-dash"], drawsPerTurn: 1 },
		},
	};
	settings.gameMode = gameMode;
	settings.items = [powerDashItem];
	const handler = new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(settings).build();
	const emitter = new GameEmitter(handler, gameMode, 2, 12345);
	return { handler, emitter };
}

function playOneTurn(handler: ReturnType<typeof midMatch>["handler"], emitter: ReturnType<typeof midMatch>["emitter"]) {
	const entities = handler.getEntityManager().getEntities();
	emitter.sendItemUse(entities[0]!.getId(), "power-dash", { type: "self" });
	handler.skipCurrentPhase();
	emitter.sendShot(entities[0]!.getId(), 30, 6);
	let guard = 0;
	while (handler.getState() === GameState.Playing && guard < 10_000) {
		handler.tick();
		guard++;
	}
	expect(guard).toBeLessThan(10_000);
}

describe("settings export purity", () => {
	test("repeated exports are identical and mutate nothing", () => {
		const { handler, emitter } = midMatch();
		playOneTurn(handler, emitter);

		const before = handler.toSettings();
		const positions = handler.getEntityManager().getEntities().map(entity => ({ ...entity.getPos() }));
		const ruleState = handler.getRuleState();
		const matchResult = handler.getMatchResult();

		for (let i = 0; i < 5; i++) {
			expect(handler.toSettings()).toEqual(before);
		}
		// Internal state is untouched by the exports.
		expect(handler.getRuleState()).toEqual(ruleState);
		expect(handler.getMatchResult()).toEqual(matchResult);
		expect(handler.getEntityManager().getEntities().map(entity => entity.getPos())).toEqual(positions);
		expect(handler.getState()).toBe(GameState.Opponents_turn);
	});

	test("mutating a returned export never leaks into stored settings or later exports", () => {
		const { handler, emitter } = midMatch();
		playOneTurn(handler, emitter);
		const before = handler.toSettings();

		const exportOne = handler.toSettings();
		(exportOne.gameMode as GameModeSettings).phases.push(RulePhase.Aim);
		exportOne.players[0]!.position.x = 9999;
		exportOne.ruleState!.turnNumber = 77;
		exportOne.background = { type: "color", color: "#000" };
		exportOne.items.push({ ...powerDashItem, id: "polluted-item" });
		exportOne.matchResult = { status: "winner" as never, winnerTeam: 0, reason: "last-team-standing" as never, turnNumber: 1 };

		// Neither later exports nor the stored settings see any pollution.
		expect(handler.toSettings()).toEqual(before);
		const stored = handler.getSettings();
		expect(stored?.gameMode).toEqual(before.gameMode);
		expect(stored?.players).toEqual(before.players);
		expect(stored?.matchResult).toEqual(before.matchResult);

		// The live handler is untouched too.
		expect(handler.getTurnNumber()).toBe(1);
		expect(handler.getRuleState().turnNumber).toBe(1);
		expect(handler.getMatchResult()).toEqual(before.matchResult);
	});

	test("the export is deep-detached from internal state", () => {
		const { handler, emitter } = midMatch();
		playOneTurn(handler, emitter);
		const entities = handler.getEntityManager().getEntities();
		const beforePosition = { ...entities[0]!.getPos() };
		const beforeRule = handler.getRuleState();
		const beforeFriction = handler.toSettings().friction.friction;

		const exported = handler.toSettings();
		exported.players[0]!.position.x = 1;
		exported.ruleState!.phase = RulePhase.Complete;
		exported.mapBoundarys[0]!.effects = [];
		exported.friction.friction = 0.001;

		expect(entities[0]!.getPos()).toEqual(beforePosition);
		expect(handler.getRuleState()).toEqual(beforeRule);
		expect(handler.toSettings().friction.friction).toBe(beforeFriction);
		expect(handler.toSettings().players[0]!.position.x).toBe(beforePosition.x);
	});

	test("item economy and draw state stay stable across exports", () => {
		const { handler, emitter } = midMatch();
		playOneTurn(handler, emitter);

		const before = handler.toSettings();
		expect(before.itemDrawState).toBeDefined();
		expect(before.players[0]!.inventory).toBeDefined();

		// Exports are stable within the same match state...
		expect(handler.toSettings()).toEqual(before);

		// ...and the deterministic draw pool only advances by consuming a
		// turn, never by exporting.
		const nextTurn = handler.toSettings();
		expect(handler.toSettings()).toEqual(nextTurn);
		playOneTurn(handler, emitter);
		const after = handler.toSettings();
		expect(after.turnNumber).toBe(2);
		expect(after.itemDrawState).not.toEqual(nextTurn.itemDrawState);

		// And exports remain stable for this richer state.
		expect(handler.toSettings()).toEqual(after);
	});

	test("restored handlers export purely too", () => {
		const { handler, emitter } = midMatch();
		playOneTurn(handler, emitter);

		const restored = new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(handler.toSettings()).build();
		const before = restored.toSettings();
		const polluted = restored.toSettings();
		polluted.players[1]!.position.y = -1;
		expect(restored.toSettings()).toEqual(before);
		expect(restored.getEntityManager().getEntities()[1]!.getPos().y).not.toBe(-1);
	});
});
