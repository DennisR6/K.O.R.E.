import { expect, test } from "bun:test";
import { HardAiWorkerHost } from "../src/ai/worker/host.ts";
import { fingerprintCanonicalSnapshot } from "../src/ai/worker/protocol.ts";
import { createMatchHandler } from "../src/scenes/matchPipeline.ts";
import { computeHardAiWorkerRequest } from "../src/ai/worker/compute.ts";
import { HardAi } from "../src/ai/hardAi.ts";
import { AiBattleSystem } from "../src/ai/AiBattleSystem.ts";
import { GameState } from "../src/kore/runtime/types.ts";
import { RulePhase } from "../src/rules/types.ts";
import { AiOpponentSystem } from "../src/ai/AiOpponentSystem.ts";

class DelayedWorker {
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;
	posted: any[] = [];
	terminated = false;
	postMessage(message: unknown): void { this.posted.push(structuredClone(message)); }
	terminate(): void { this.terminated = true; }
	ready(): void { this.onmessage?.({ data: { type: "ready" } } as MessageEvent); }
	crash(message = "startup failed"): void { this.onerror?.({ message, error: new Error(message) } as ErrorEvent); }
}

test("a starting Worker queues the canonical request until readiness", async () => {
	const worker = new DelayedWorker();
	const host = new HardAiWorkerHost(() => worker);
	const handler = createMatchHandler({ mode: "hotseat", mapId: "ice-map-v1", seed: 31 });
	host.attachHandler(handler);
	const snapshot = handler.toSettings();
	const action = { actorId: snapshot.players[0]!.id, angle: 0, power: 1 };
	const ruleState = handler.getRuleState();
	expect(host.getState()).toBe("starting");
	host.prepareTurn({ snapshot, acceptedAction: action, nextRuleState: ruleState, aiSettings: { difficulty: "hard", seed: 7, team: 0 } });
	expect(worker.posted).toHaveLength(0);
	worker.ready();
	await Promise.resolve();
	expect(host.getState()).toBe("ready");
	expect(worker.posted).toHaveLength(1);
	expect(worker.posted[0].kind).toBe("precompute");
	host.dispose();
});

test("initial decision requests use the current canonical state after readiness", async () => {
	const worker = new DelayedWorker();
	const host = new HardAiWorkerHost(() => worker);
	const handler = createMatchHandler({ mode: "hotseat", mapId: "ice-map-v1", seed: 32 });
	host.attachHandler(handler);
	const snapshot = handler.toSettings();
	const settings = { difficulty: "hard" as const, seed: 8, team: 0 };
	host.prepareInitialDecision({ snapshot, ruleState: handler.getRuleState(), aiSettings: settings });
	worker.ready();
	await Promise.resolve();
	const request = worker.posted[0];
	expect(request.kind).toBe("initial-decision");
	const action = { actorId: snapshot.players[0]!.id, angle: 0, power: 1 };
	worker.onmessage?.({ data: { type: "result", response: { schemaVersion: 1, kind: "initial-decision", requestId: request.requestId, basedOnStateHash: request.basedOnStateHash, expectedTurnNumber: request.expectedTurnNumber, expectedNextTeam: request.expectedNextTeam, action, postTurnStateHash: fingerprintCanonicalSnapshot(snapshot), computeMs: 2 } } } as MessageEvent);
	expect(host.consumePreparedAction()).toEqual(action);
	host.dispose();
});

test("initial Worker decision preserves synchronous Hard AI action parity with a legal fallback", () => {
	const handler = createMatchHandler({ mode: "hotseat", mapId: "ice-map-v1", seed: 33 });
	const snapshot = handler.toSettings();
	const aiSettings = { difficulty: "hard" as const, seed: 9, team: 0 };
	const response = computeHardAiWorkerRequest({ schemaVersion: 1, kind: "initial-decision", requestId: "initial-parity", basedOnStateHash: "source", expectedTurnNumber: snapshot.turnNumber, expectedNextTeam: handler.getRuleState().activeTeam, nextRuleState: handler.getRuleState(), snapshot, aiSettings });
	const expected = new HardAi().computeTurn(handler, aiSettings)?.shot ?? { actorId: handler.getEntityManager().getEntities()[0]!.getId(), angle: 0, power: 4 };
	expect(response.action).toEqual(expected);
}, 30_000);

test("startup failure rejects readiness and disposal prevents a stale request", async () => {
	const worker = new DelayedWorker();
	const host = new HardAiWorkerHost(() => worker);
	const readiness = host.ready();
	worker.crash();
	await expect(readiness).rejects.toThrow("startup failed");
	expect(host.getState()).toBe("failed");

	const disposedWorker = new DelayedWorker();
	const disposedHost = new HardAiWorkerHost(() => disposedWorker);
	disposedHost.dispose();
	disposedWorker.ready();
	await Promise.resolve();
	expect(disposedHost.getState()).toBe("failed");
	expect(disposedWorker.posted).toHaveLength(0);
});

test("AI battle waits for a starting Worker instead of entering synchronous fallback", async () => {
	const worker = new DelayedWorker();
	const host = new HardAiWorkerHost(() => worker);
	const handler = createMatchHandler({ mode: "hotseat", mapId: "ice-map-v1", seed: 34 });
	host.attachHandler(handler);
	handler.setRuleState({ ...handler.getRuleState(), phase: RulePhase.Physics, activeTeam: 0, turnNumber: 0 });
	handler.setState(GameState.Your_turn);
	const submitted: unknown[] = [];
	const emitter = { sendShot: (...args: unknown[]) => submitted.push(args), skipPhase: () => {} };
	const settings0 = { difficulty: "hard" as const, seed: 10, team: 0 };
	const settings1 = { difficulty: "hard" as const, seed: 11, team: 1 };
	const system = new AiBattleSystem(handler, emitter, settings0, settings1, host);
	system.ticker(handler.getContext(), 1, 0);
	expect(submitted).toHaveLength(0);
	expect(host.getMetrics().fallbackCount).toBe(0);
	worker.ready();
	await Promise.resolve();
	system.ticker(handler.getContext(), 1, 0);
	const request = worker.posted[0];
	expect(request.kind).toBe("initial-decision");
	const action = { actorId: handler.toSettings().players[0]!.id, angle: 0, power: 1 };
	worker.onmessage?.({ data: { type: "result", response: { schemaVersion: 1, kind: "initial-decision", requestId: request.requestId, basedOnStateHash: request.basedOnStateHash, expectedTurnNumber: request.expectedTurnNumber, expectedNextTeam: request.expectedNextTeam, action, postTurnStateHash: fingerprintCanonicalSnapshot(request.snapshot), computeMs: 1 } } } as MessageEvent);
	system.ticker(handler.getContext(), 1, 0);
	expect(submitted).toEqual([[action.actorId, action.angle, action.power]]);
	expect(host.getMetrics().fallbackCount).toBe(0);
	host.dispose();
});

test("a failed Worker retains synchronous fallback behavior", () => {
	const worker = new DelayedWorker();
	const host = new HardAiWorkerHost(() => worker);
	const handler = createMatchHandler({ mode: "hotseat", mapId: "ice-map-v1", seed: 35 });
	host.attachHandler(handler);
	handler.setRuleState({ ...handler.getRuleState(), phase: RulePhase.Physics, activeTeam: 1, turnNumber: 0 });
	handler.setState(GameState.Your_turn);
	worker.crash("module load failed");
	const submitted: unknown[] = [];
	const emitter = { sendShot: (...args: unknown[]) => submitted.push(args), skipPhase: () => {} };
	const system = new AiOpponentSystem(handler, emitter, { difficulty: "easy", seed: 12, team: 1 }, host);
	system.ticker(handler.getContext(), 1, 0);
	expect(submitted.length).toBe(1);
	expect(host.getMetrics().fallbackCount).toBe(1);
	host.dispose();
});
