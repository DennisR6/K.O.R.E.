import { describe, expect, test } from "bun:test";
import { AiTurnEmitter } from "../src/ai/aiEmitter.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { createVersusAiGameSettings } from "../src/settings/settings.ts";
import { validateReplayDocument } from "../src/replay/types.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import type { IInputEmitter } from "../src/engine/types.ts";

const humanUser = "11111111-1111-4111-8111-111111111111";
const aiUser = "22222222-2222-4222-8222-222222222222";

describe("Authoritative AI Match Coverage", () => {
	test("runs complete AI match through authoritative server registry and verifies replay", () => {
		const db = new GameDatabase(":memory:");
		const registry = new GameRegistry(db);

		const settings = createVersusAiGameSettings("medium", 555, 2, 1);
		const record = registry.create(settings, [humanUser, aiUser]);

		registry.connectUser(humanUser);
		registry.connectUser(aiUser);

		const entities = record.handler.getEntityManager().getEntities();
		const humanActor = entities.find((e) => e.getTeam().includes(0))!;
		const aiActor = entities.find((e) => e.getTeam().includes(1))!;

		// Turn 0: Human shoots
		const turn0Result = registry.submitTurn(humanUser, {
			actorId: humanActor.getId(),
			angle: 0,
			power: 5,
		});
		expect(turn0Result.ok).toBe(true);
		expect(record.turnNumber).toBe(1);
		expect(record.currentTeam).toBe(1); // AI's turn now

		// Turn 1: AI computes and submits turn through authoritative server
		const producer = record.handler.createAiProducer();
		expect(producer).toBeDefined();

		const aiTurnEmitter = new AiTurnEmitter(producer!);
		const serverEmitterAdapter: IInputEmitter = {
			sendShot: (actorId, angle, power) => {
				const res = registry.submitTurn(aiUser, { actorId, angle, power });
				expect(res.ok).toBe(true);
			},
			sendItemUse: (actorId, itemId, target) => {
				const res = registry.submitItemUse(aiUser, actorId, itemId, target);
				expect(res.ok).toBe(true);
			},
		};

		const executed = aiTurnEmitter.executeTurn(record.handler, record.handler.getAiSettings()!, serverEmitterAdapter);
		expect(executed).toBe(true);
		expect(record.turnNumber).toBe(2);
		expect(record.currentTeam).toBe(0); // Back to human's turn

		// Verify replay document recorded both human and AI actions
		const replay = registry.getReplay(record.id);
		expect(replay).toBeDefined();
		if (!replay) throw new Error("Replay missing");

		expect(() => validateReplayDocument(replay)).not.toThrow();
		expect(replay.actions.length).toBe(2);
		expect(replay.actions[0].type).toBe("shoot");
		expect(replay.actions[1].type).toBe("shoot");
		expect(replay.actions[1].actorId).toBe(aiActor.getId());

		// Play back replay
		const replayPlayer = new ReplayPlayer(replay);
		const replayFinalState = replayPlayer.playAll();
		expect(replayFinalState).toBeDefined();
		expect(replayFinalState).toHaveLength(2);

		db.close();
	});
});
