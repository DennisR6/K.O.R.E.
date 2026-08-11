import { describe, expect, test } from "bun:test";
import { AiTurnEmitter } from "../src/ai/aiEmitter.ts";
import { HardAi } from "../src/ai/hardAi.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import type { IInputEmitter } from "../src/kore/runtime/types.ts";
import type { AiSettings } from "../src/ai/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

function buildHandler() {
	const settings = createDefaultGameSettings(2, 2);
	settings.friction = { friction: 0.98, linearDrag: 0.05, stopThreshold: 0.2 };
	settings.drift = 0.3;
	// Distinct non-default positions so the AI faces a real decision
	settings.players[0]!.position = { x: 220, y: 200 };
	settings.players[1]!.position = { x: 280, y: 260 };
	settings.players[2]!.position = { x: 620, y: 180 };
	settings.players[3]!.position = { x: 560, y: 300 };
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	return handler;
}

const aiTeam0: AiSettings = {
	difficulty: "hard",
	seed: 7,
	team: 0,
	decisionLimits: { maxSimulations: 30, maxAngleSamples: 10, maxForceSamples: 3 },
};

describe("Hard AI Snapshot Validation", () => {
	test("computes identical decisions on live and snapshot-restored handlers", () => {
		const handler = buildHandler();
		const liveDecision = new HardAi().computeTurn(handler, aiTeam0);
		expect(liveDecision).toBeDefined();
		expect(liveDecision!.shot).toBeDefined();
		expect(liveDecision!.shot!.actorId).toContain("-");

		const restored = new GameHandlerBuilder().defaultSystems().fromSettings(handler.toSettings()).build();
		const restoredDecision = new HardAi().computeTurn(restored, aiTeam0);
		expect(restoredDecision).toEqual(liveDecision);
	});

	test("computing decisions never mutates the live match", () => {
		const handler = buildHandler();
		const before = handler.toSettings();
		const ai = new HardAi();
		for (let i = 0; i < 3; i++) ai.computeTurn(handler, aiTeam0);
		expect(handler.toSettings()).toEqual(before);
		expect(handler.getEntityManager().serialize()).toEqual(before.players);
		expect(handler.getRuleState()).toEqual(before.ruleState);
	});

	test("repeated decisions are deterministic and executable on the live handler", () => {
		const handler = buildHandler();
		const ai = new HardAi();
		const first = ai.computeTurn(handler, aiTeam0);
		const second = ai.computeTurn(handler, aiTeam0);
		expect(second).toEqual(first);

		// Feed the decision through the emitter path into a recording sink
		const recorded: { actorId: string; angle: number; power: number }[] = [];
		const sink: IInputEmitter = {
			sendShot: (actorId, angle, power) => recorded.push({ actorId, angle, power }),
			sendItemUse: () => { throw new Error("AI must not use items in this match"); },
		};
		const submitted = new AiTurnEmitter(ai).executeTurn(handler, aiTeam0, sink);
		expect(submitted).toBe(true);
		expect(recorded).toEqual([first!.shot!]);

		// The submitted shot refers to a live actor of the AI team
		const actor = handler.getEntityManager().getEntityById(first!.shot!.actorId);
		expect(actor).toBeDefined();
		expect(actor!.isDead()).toBe(false);
		expect(actor!.getTeam()).toContain(0);
	});

	test("returns undefined when its team or the enemy team has no live actors", () => {
		const handler = buildHandler();
		const entities = handler.getEntityManager().getEntities();

		// Enemy team dead: no target to shoot at
		entities[2]!.setIsDead(true);
		entities[3]!.setIsDead(true);
		expect(new HardAi().computeTurn(handler, aiTeam0)).toBeUndefined();

		// Own team dead: nothing to shoot with
		const other = buildHandler();
		other.getEntityManager().getEntities().forEach(entity => entity.setIsDead(true));
		expect(new HardAi().computeTurn(other, aiTeam0)).toBeUndefined();
	});
});
