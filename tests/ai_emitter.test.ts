import { describe, expect, test } from "bun:test";
import { AiTurnEmitter, type IAiTurnProducer } from "../src/ai/aiEmitter.ts";
import type { AiSettings } from "../src/ai/types.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import type { IInputEmitter } from "../src/kore/runtime/types.ts";
import type { ItemTarget } from "../src/item/target.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

class MockTargetEmitter implements IInputEmitter {
	public shots: Array<{ actorId: string; angle: number; power: number }> = [];
	public itemUses: Array<{ actorId: string; itemId: string; target: ItemTarget }> = [];

	sendShot(actorId: string, angle: number, power: number): void {
		this.shots.push({ actorId, angle, power });
	}

	sendItemUse(actorId: string, itemId: string, target: ItemTarget): void {
		this.itemUses.push({ actorId, itemId, target });
	}
}

describe("AI Turn Emitter Interface", () => {
	test("AiTurnEmitter submits computed AI shot to target emitter", () => {
		const settings = createDefaultGameSettings(2, 1);
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		const aiActor = handler.getEntityManager().getEntities().find((e) => e.getTeam().includes(1))!;
		const aiSettings: AiSettings = { difficulty: "easy", seed: 123, team: 1 };

		const mockProducer: IAiTurnProducer = {
			computeTurn: (_h, _s) => ({
				shot: { actorId: aiActor.getId(), angle: 180, power: 7 },
			}),
		};

		const emitter = new AiTurnEmitter(mockProducer);
		const target = new MockTargetEmitter();

		const executed = emitter.executeTurn(handler, aiSettings, target);
		expect(executed).toBe(true);
		expect(target.shots).toHaveLength(1);
		expect(target.shots[0]).toEqual({ actorId: aiActor.getId(), angle: 180, power: 7 });
	});

	test("AiTurnEmitter rejects AI turns targeting invalid or enemy actors", () => {
		const settings = createDefaultGameSettings(2, 1);
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		const humanActor = handler.getEntityManager().getEntities().find((e) => e.getTeam().includes(0))!;
		const aiSettings: AiSettings = { difficulty: "easy", seed: 123, team: 1 };

		// AI tries to control human actor (team 0) instead of AI team (team 1)
		const mockProducer: IAiTurnProducer = {
			computeTurn: (_h, _s) => ({
				shot: { actorId: humanActor.getId(), angle: 180, power: 7 },
			}),
		};

		const emitter = new AiTurnEmitter(mockProducer);
		const target = new MockTargetEmitter();

		const executed = emitter.executeTurn(handler, aiSettings, target);
		expect(executed).toBe(false);
		expect(target.shots).toHaveLength(0);
	});
});
