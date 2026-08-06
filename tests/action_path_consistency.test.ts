import { describe, expect, test } from "bun:test";
import type { IAiTurnProducer, AiDecision } from "../src/ai/aiEmitter.ts";
import { AiTurnEmitter } from "../src/ai/aiEmitter.ts";
import type { AiSettings } from "../src/ai/types.ts";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { ReplayRecorder } from "../src/replay/recorder.ts";
import { isValidInput } from "../src/server/gameRegistry.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameSettings } from "../src/settings/settings.ts";

const userOne = "11111111-1111-4111-8111-111111111111";
const userTwo = "22222222-2222-4222-8222-222222222222";

class StubProducer implements IAiTurnProducer {
	constructor(private readonly decision: AiDecision | undefined) { }
	computeTurn(): AiDecision | undefined { return this.decision }
}

/**
 * Cross-system validation 11.9: the emitter, AI, server, and replay action
 * paths must reject the same invalid inputs and leave the match unchanged
 * after every rejection.
 */
describe("Action Path Consistency", () => {
	function setup() {
		const registry = new GameRegistry(new GameDatabase(":memory:"));
		const record = registry.create(GameSettings, [userOne, userTwo]);
		const handler = record.handler;
		const actorId = handler.getEntityManager().getEntities()
			.find(entity => entity.getTeam().includes(0))!.getId();
		const emitter = new GameEmitter(handler, GameSettings.gameMode!, 2, 12345);
		const aiTeam0: AiSettings = { difficulty: "hard", seed: 1, team: 0, decisionLimits: { maxSimulations: 5, maxAngleSamples: 5, maxForceSamples: 2 } };
		const snapshot = () => JSON.stringify(handler.toSettings());
		return { registry, record, handler, actorId, emitter, aiTeam0, snapshot };
	}

	test("the shared validator accepts only finite in-range shot input", () => {
		expect(isValidInput({ actorId: "actor-1", angle: 0, power: 0.1 })).toBe(true);
		expect(isValidInput({ actorId: "actor-1", angle: 359.9, power: 10 })).toBe(true);
		expect(isValidInput({ actorId: "actor-1", angle: 360, power: 5 })).toBe(false);
		expect(isValidInput({ actorId: "actor-1", angle: -1, power: 5 })).toBe(false);
		expect(isValidInput({ actorId: "actor-1", angle: Number.NaN, power: 5 })).toBe(false);
		expect(isValidInput({ actorId: "actor-1", angle: Number.POSITIVE_INFINITY, power: 5 })).toBe(false);
		expect(isValidInput({ actorId: "actor-1", angle: 90, power: 0 })).toBe(false);
		expect(isValidInput({ actorId: "actor-1", angle: 90, power: 10.1 })).toBe(false);
		expect(isValidInput({ actorId: "actor-1", angle: 90, power: Number.NaN })).toBe(false);
		expect(isValidInput({ actorId: "", angle: 90, power: 5 })).toBe(false);
		expect(isValidInput({ actorId: "actor-1", angle: 90, power: 5, extra: 1 })).toBe(true);
	});

	test("all action paths reject non-finite shot input without changing the match", () => {
		const { registry, record, handler, actorId, emitter, aiTeam0, snapshot } = setup();
		const before = snapshot();
		const entityStateBefore = handler.getEntityManager().serialize();

		// Server path: rejects with an error result.
		const serverResult = registry.submitTurn(userOne, { actorId, angle: Number.NaN, power: 5 });
		expect(serverResult.ok).toBe(false);
		if (serverResult.ok) throw new Error("expected rejection");
		expect(serverResult.error).toBe("Invalid shot input");

		// Emitter path: throws before recording or simulating.
		expect(() => emitter.sendShot(actorId, Number.NaN, 5)).toThrow("Invalid shot input");
		expect(emitter.recorder.getReplay().actions).toHaveLength(0);

		// AI path: refuses to submit the invalid decision.
		const aiEmitter = new AiTurnEmitter(new StubProducer({ shot: { actorId, angle: Number.POSITIVE_INFINITY, power: 5 } }));
		expect(aiEmitter.executeTurn(handler, aiTeam0, emitter)).toBe(false);

		// Replay path: the document boundary rejects the malformed action.
		const recorder = new ReplayRecorder(GameSettings, 42);
		recorder.recordShoot(actorId, Number.NaN, 5);
		expect(() => recorder.getReplay()).toThrow(/angle must be a finite number/);

		// The authoritative match is untouched by every rejection.
		expect(snapshot()).toBe(before);
		expect(handler.getEntityManager().serialize()).toEqual(entityStateBefore);
		expect(record.turnNumber).toBe(0);
		expect(record.ruleState.activeTeam).toBe(0);
	});

	test("all action paths reject unknown actors without changing the match", () => {
		const { registry, record, handler, emitter, aiTeam0, snapshot } = setup();
		const before = snapshot();
		const entityStateBefore = handler.getEntityManager().serialize();

		const serverResult = registry.submitTurn(userOne, { actorId: "ghost", angle: 90, power: 5 });
		expect(serverResult.ok).toBe(false);
		if (serverResult.ok) throw new Error("expected rejection");
		expect(serverResult.error).toBe("Actor is not active");

		expect(() => emitter.sendShot("ghost", 90, 5)).toThrow(/Actor ghost not found/);

		const aiEmitter = new AiTurnEmitter(new StubProducer({ shot: { actorId: "ghost", angle: 90, power: 5 } }));
		expect(aiEmitter.executeTurn(handler, aiTeam0, emitter)).toBe(false);

		const recorder = new ReplayRecorder(GameSettings, 42);
		recorder.recordShoot("ghost", 90, 5);
		const replayPlayer = new ReplayPlayer(recorder.getReplay());
		expect(() => replayPlayer.playAll()).toThrow(/Actor ghost not found/);

		expect(snapshot()).toBe(before);
		expect(handler.getEntityManager().serialize()).toEqual(entityStateBefore);
		expect(record.turnNumber).toBe(0);
	});

	test("all action paths reject dead actors without changing the match", () => {
		const { registry, record, handler, actorId, emitter, aiTeam0, snapshot } = setup();
		handler.getEntityManager().getEntityById(actorId)!.setIsDead(true);
		const before = snapshot();
		const entityStateBefore = handler.getEntityManager().serialize();

		const serverResult = registry.submitTurn(userOne, { actorId, angle: 90, power: 5 });
		expect(serverResult.ok).toBe(false);
		if (serverResult.ok) throw new Error("expected rejection");
		expect(serverResult.error).toBe("Actor is not active");

		expect(() => emitter.sendShot(actorId, 90, 5)).toThrow(/not active/);

		const aiEmitter = new AiTurnEmitter(new StubProducer({ shot: { actorId, angle: 90, power: 5 } }));
		expect(aiEmitter.executeTurn(handler, aiTeam0, emitter)).toBe(false);

		// Replay path: the replay restores a live actor, so the playback marks
		// it dead first and must then reject the same shot.
		const recorder = new ReplayRecorder(GameSettings, 42);
		recorder.recordShoot(actorId, 90, 5);
		const replayPlayer = new ReplayPlayer(recorder.getReplay());
		replayPlayer.getHandler().getEntityManager().getEntityById(actorId)!.setIsDead(true);
		expect(() => replayPlayer.playAll()).toThrow(/not active/);

		expect(snapshot()).toBe(before);
		expect(handler.getEntityManager().serialize()).toEqual(entityStateBefore);
		expect(record.turnNumber).toBe(0);
	});

	test("the match remains playable after every path has rejected an action", () => {
		const { registry, handler, actorId, emitter, aiTeam0 } = setup();
		expect(() => emitter.sendShot(actorId, Number.NaN, 5)).toThrow("Invalid shot input");
		const aiEmitter = new AiTurnEmitter(new StubProducer({ shot: { actorId, angle: 90, power: 99 } }));
		expect(aiEmitter.executeTurn(handler, aiTeam0, emitter)).toBe(false);
		expect(registry.submitTurn(userOne, { actorId: "ghost", angle: 90, power: 5 }).ok).toBe(false);

		// A valid shot still resolves exactly as if nothing was rejected.
		const accepted = registry.submitTurn(userOne, { actorId, angle: 90, power: 5 });
		expect(accepted.ok).toBe(true);
		if (!accepted.ok) throw new Error(accepted.error);
		expect(recordTurnState(registry, userOne)).toEqual({ activeTeam: 1, turnNumber: 1 });
	});

	function recordTurnState(registry: GameRegistry, userId: string) {
		const record = registry.getForUser(userId)!;
		return { activeTeam: record.ruleState.activeTeam, turnNumber: record.ruleState.turnNumber };
	}
});
