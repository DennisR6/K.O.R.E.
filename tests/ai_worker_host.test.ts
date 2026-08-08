import { describe, expect, test } from "bun:test";
import { HardAiWorkerHost } from "../src/ai/worker/host.js";
import { diffCanonicalSettings, fingerprintCanonicalSnapshot, fingerprintHardAiRequest, type HardAiWorkerRequest, type HardAiWorkerResponse } from "../src/ai/worker/protocol.js";
import { createMatchHandler } from "../src/scenes/matchPipeline.js";
import { RulePhase } from "../src/rules/types.js";
import { AiBattleSystem } from "../src/ai/AiBattleSystem.js";
import { GameState } from "../src/engine/types.js";
import { restoreHardAiWorkerHandler } from "../src/ai/worker/compute.js";

class FakeWorker {
	private messageHandler: ((event: MessageEvent) => void) | null = null;
	set onmessage(handler: ((event: MessageEvent) => void) | null) { this.messageHandler = handler; handler?.({ data: { type: "ready" } } as MessageEvent); }
	get onmessage(): ((event: MessageEvent) => void) | null { return this.messageHandler; }
	onerror: ((event: ErrorEvent) => void) | null = null;
	posted: HardAiWorkerRequest[] = [];
	terminated = false;

	postMessage(message: unknown): void { this.posted.push(structuredClone(message as HardAiWorkerRequest)); }
	terminate(): void { this.terminated = true; }
	respond(response: HardAiWorkerResponse): void { this.onmessage?.({ data: { type: "result", response } } as MessageEvent); }
	crash(message = "worker crashed"): void { this.onerror?.({ message, error: new Error(message) } as ErrorEvent); }
}

describe("HardAiWorkerHost", () => {
	test("accepts only a response matching the authoritative post-turn snapshot", () => {
		const worker = new FakeWorker();
		const host = new HardAiWorkerHost(() => worker);
		const handler = createMatchHandler({ mode: "hotseat", mapId: "ice-map-v1", seed: 7 });
		host.attachHandler(handler);
		const snapshot = handler.toSettings();
		const nextRuleState = { ...handler.getRuleState(), phase: RulePhase.Physics, turnNumber: handler.getRuleState().turnNumber + 1, activeTeam: 1 };
		const aiSettings = { difficulty: "hard" as const, seed: 11, team: 1 };
		const acceptedAction = { actorId: snapshot.players[0]!.id, angle: 0, power: 1 };

		host.prepareTurn({ snapshot, acceptedAction, nextRuleState, aiSettings });
		const request = worker.posted[0]!;
		worker.respond({ schemaVersion: 1, requestId: "stale-request", basedOnStateHash: request.basedOnStateHash, expectedTurnNumber: request.expectedTurnNumber, expectedNextTeam: request.expectedNextTeam, action: { actorId: acceptedAction.actorId, angle: 0.5, power: 2 }, postTurnStateHash: "stale", computeMs: 1 });
		expect(host.isThinking()).toBe(true);
		worker.respond({
			schemaVersion: 1,
			requestId: request.requestId,
			basedOnStateHash: request.basedOnStateHash,
			expectedTurnNumber: request.expectedTurnNumber,
			expectedNextTeam: request.expectedNextTeam,
			action: { actorId: acceptedAction.actorId, angle: 0.5, power: 2 },
			postTurnStateHash: "stale",
			computeMs: 1,
		});
		host.completeAuthoritativeTurn(handler);
		expect(host.consumePreparedAction()).toBeUndefined();

		host.prepareTurn({ snapshot, acceptedAction, nextRuleState, aiSettings });
		const secondRequest = worker.posted[1]!;
		const expectedRequestHash = fingerprintHardAiRequest({ snapshot, acceptedAction, expectedTurnNumber: snapshot.turnNumber, expectedNextTeam: nextRuleState.activeTeam, nextRuleState, aiSettings });
		expect(secondRequest.basedOnStateHash).toBe(expectedRequestHash);
		worker.respond({
			schemaVersion: 1,
			requestId: secondRequest.requestId,
			basedOnStateHash: secondRequest.basedOnStateHash,
			expectedTurnNumber: secondRequest.expectedTurnNumber,
			expectedNextTeam: secondRequest.expectedNextTeam,
			action: { actorId: acceptedAction.actorId, angle: 0.5, power: 2 },
			postTurnStateHash: fingerprintCanonicalSnapshot(snapshot),
			computeMs: 1,
		});
		host.completeAuthoritativeTurn(handler);
		expect(host.consumePreparedAction()).toEqual({ actorId: acceptedAction.actorId, angle: 0.5, power: 2 });
		expect(host.getMetrics().validResponseCount).toBe(1);
		expect(handler.getLogs(handler.LoggerType.Performance).map(log => log.type)).toContain("ai.worker.requested");
		expect(handler.getLogs(handler.LoggerType.Performance).find(log => log.type === "ai.worker.completed")?.data).toMatchObject({ workerComputeMs: 1, postTurnWaitMs: 0, workerReadyBeforeTurnEnd: true });
		host.dispose();
		expect(worker.terminated).toBe(true);

		const failedWorker = new FakeWorker();
		const failedHost = new HardAiWorkerHost(() => failedWorker);
		failedWorker.crash();
		expect(failedHost.isAvailable()).toBe(false);
		expect(failedHost.getMetrics().failedCount).toBe(1);
	});

	test("keeps Worker and playback post-turn canonical state identical", () => {
		const worker = new FakeWorker();
		const host = new HardAiWorkerHost(() => worker);
		const handler = createMatchHandler({ mode: "hotseat", mapId: "ice-map-v1", seed: 17 });
		const snapshot = handler.toSettings();
		const actorId = snapshot.players[0]!.id;
		const acceptedAction = { actorId, angle: 0, power: 1 };
		const nextRuleState = { ...handler.getRuleState(), phase: RulePhase.Physics, turnNumber: handler.getRuleState().turnNumber + 1, activeTeam: 1 };
		host.prepareTurn({ snapshot, acceptedAction, nextRuleState, aiSettings: { difficulty: "hard", seed: 19, team: 1 } });
		const workerHandler = restoreHardAiWorkerHandler(snapshot);
		workerHandler.resolveTurn(acceptedAction);
		workerHandler.startTurn(nextRuleState);
		const workerSettings = workerHandler.toSettings();
		const packet = handler.simulateTurn(actorId, 0, 1);
		const request = worker.posted[0]!;
		worker.respond({ schemaVersion: 1, requestId: request.requestId, basedOnStateHash: request.basedOnStateHash, expectedTurnNumber: request.expectedTurnNumber, expectedNextTeam: request.expectedNextTeam, action: acceptedAction, postTurnStateHash: fingerprintCanonicalSnapshot(workerSettings), computeMs: 1 });
		let mainSettings = handler.toSettings();
		handler.playTurn(packet, () => {
			handler.startTurn(nextRuleState);
			handler.setState(GameState.Your_turn);
			mainSettings = handler.toSettings();
			host.completeAuthoritativeTurn(handler);
		});
		for (let tick = 0; tick < packet.durationFrames + 2; tick++) handler.tick();
		expect(diffCanonicalSettings(workerSettings, mainSettings)).toEqual([]);
		expect(fingerprintCanonicalSnapshot(workerSettings)).toBe(fingerprintCanonicalSnapshot(mainSettings));
		expect(host.consumePreparedAction()).toEqual(acceptedAction);
		host.dispose();
	});

	test("keeps a healthy pending request asynchronous and falls back only when unavailable", () => {
		const worker = new FakeWorker();
		const host = new HardAiWorkerHost(() => worker);
		const handler = createMatchHandler({ mode: "hotseat", mapId: "ice-map-v1", seed: 8 });
		host.attachHandler(handler);
		const snapshot = handler.toSettings();
		host.prepareTurn({ snapshot, acceptedAction: { actorId: snapshot.players[0]!.id, angle: 0, power: 1 }, nextRuleState: handler.getRuleState(), aiSettings: { difficulty: "hard", seed: 12, team: 0 } });
		expect(host.isThinking()).toBe(true);
		expect(host.consumePreparedAction()).toBeUndefined();
		expect(host.getMetrics().fallbackCount).toBe(0);
		host.completeAuthoritativeTurn(handler);
		expect(handler.getLogs(handler.LoggerType.Performance).map(log => log.type)).toContain("ai.worker.waiting");
		expect(handler.getLogs(handler.LoggerType.Performance).map(log => log.type)).not.toContain("ai.fallback.started");
		expect(handler.getLogs(handler.LoggerType.Performance).map(log => log.type)).not.toContain("ai.fallback.completed");
		host.noteSynchronousFallback();
		expect(host.getMetrics().fallbackCount).toBe(1);
		host.dispose();
	});

	test("AI battle does not call synchronous HardAi while the worker is pending", () => {
		const worker = new FakeWorker();
		const host = new HardAiWorkerHost(() => worker);
		const handler = createMatchHandler({ mode: "hotseat", mapId: "ice-map-v1", seed: 10 });
		const snapshot = handler.toSettings();
		const rule = { ...handler.getRuleState(), phase: RulePhase.Physics, activeTeam: 0 };
		handler.setRuleState(rule);
		handler.setState(GameState.Your_turn);
		host.prepareTurn({ snapshot, acceptedAction: { actorId: snapshot.players[0]!.id, angle: 0, power: 1 }, nextRuleState: rule, aiSettings: { difficulty: "hard", seed: 14, team: 0 } });
		const submitted: unknown[] = [];
		const emitter = { sendShot: (...args: unknown[]) => submitted.push(args), skipPhase: () => {} };
		const system = new AiBattleSystem(handler, emitter, { difficulty: "hard", seed: 14, team: 0 }, { difficulty: "hard", seed: 15, team: 1 }, host);
		system.ticker(handler.getContext(), 1, 0);
		expect(submitted).toHaveLength(0);
		expect(host.isThinking()).toBe(true);
		host.dispose();
	});

	test("discards malformed responses and rejects construction failure", () => {
		const worker = new FakeWorker();
		const host = new HardAiWorkerHost(() => worker);
		const handler = createMatchHandler({ mode: "hotseat", mapId: "ice-map-v1", seed: 9 });
		const snapshot = handler.toSettings();
		host.prepareTurn({ snapshot, acceptedAction: { actorId: snapshot.players[0]!.id, angle: 0, power: 1 }, nextRuleState: handler.getRuleState(), aiSettings: { difficulty: "hard", seed: 13, team: 0 } });
		const request = worker.posted[0]!;
		worker.respond({ schemaVersion: 1, requestId: request.requestId, basedOnStateHash: request.basedOnStateHash, expectedTurnNumber: request.expectedTurnNumber, expectedNextTeam: request.expectedNextTeam, action: undefined, postTurnStateHash: "", computeMs: 1 });
		expect(host.isThinking()).toBe(false);
		host.dispose();
		expect(() => new HardAiWorkerHost(() => { throw new Error("boot failed"); })).not.toThrow();
	});
});
