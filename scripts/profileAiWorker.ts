import { Worker } from "node:worker_threads";
import { createAiBattleHandler } from "../src/scenes/LocalMatchSceneRouter.js";
import { HardAi } from "../src/ai/hardAi.js";
import type { HardAiWorkerRequest, HardAiWorkerResponse } from "../src/ai/worker/protocol.js";
import { fingerprintCanonicalSnapshot, fingerprintHardAiRequest } from "../src/ai/worker/protocol.js";
import { restoreHardAiWorkerHandler } from "../src/ai/worker/compute.js";
import { RuleInterpreter } from "../src/rules/RuleInterpreter.js";
import { RulePhase } from "../src/rules/types.js";

type WorkerMessage = { type: "ready" | "pong" | "result" | "error"; response?: HardAiWorkerResponse; message?: string };

function waitFor(worker: Worker, expected: WorkerMessage["type"]): Promise<WorkerMessage> {
	return new Promise((resolve, reject) => {
		const onMessage = (message: WorkerMessage) => {
			if (message.type !== expected) return;
			worker.off("message", onMessage);
			worker.off("error", onError);
			resolve(message);
		};
		const onError = (error: Error) => { worker.off("message", onMessage); reject(error); };
		worker.on("message", onMessage);
		worker.once("error", onError);
	});
}

function makeRequest(index: number): HardAiWorkerRequest {
	const handler = createAiBattleHandler("ice-map-v1", 1);
	if (handler.getRuleState().phase === RulePhase.Item) handler.skipCurrentPhase();
	const snapshot = handler.toSettings();
	const acceptedAction = { actorId: snapshot.players[0]!.id, angle: index * 17, power: 4 };
	const rules = new RuleInterpreter(snapshot.gameMode!);
	const nextRuleState = rules.startNextTurn(rules.advancePhase(snapshot.ruleState), 2);
	const aiSettings = { difficulty: "hard" as const, seed: 3, team: nextRuleState.activeTeam, decisionLimits: { maxSimulations: 30, maxAngleSamples: 10, maxForceSamples: 3 } };
	const requestWithoutHash = { snapshot, acceptedAction, expectedTurnNumber: snapshot.turnNumber, expectedNextTeam: nextRuleState.activeTeam, nextRuleState, aiSettings };
	return { schemaVersion: 1, requestId: `worker-poc-${index}`, basedOnStateHash: fingerprintHardAiRequest(requestWithoutHash), ...requestWithoutHash };
}

const worker = new Worker(new URL("./aiWorkerProbe.ts", import.meta.url));
const startupStart = performance.now();
worker.postMessage({ type: "ready" });
await waitFor(worker, "ready");
const startupMs = performance.now() - startupStart;
const requests = [0, 1, 2].map(makeRequest);
const snapshotBytes = requests.map(request => Buffer.byteLength(JSON.stringify(request.snapshot)));
const requestBytes = requests.map(request => Buffer.byteLength(JSON.stringify(request)));
const pingStart = performance.now();
worker.postMessage({ type: "ping", request: requests[0] });
await waitFor(worker, "pong");
const requestRoundTripMs = performance.now() - pingStart;
const cloneStart = performance.now();
for (const request of requests) structuredClone(request);
const localCloneMs = performance.now() - cloneStart;
const results: HardAiWorkerResponse[] = [];
let roundTripMs = 0;
const playerTurnFrames: number[] = [];
for (const request of requests) {
	const syncHandler = restoreHardAiWorkerHandler(request.snapshot);
	const packet = syncHandler.resolveTurn(request.acceptedAction);
	syncHandler.startTurn(request.nextRuleState);
	playerTurnFrames.push(packet.durationFrames);
	const syncPostTurnStateHash = fingerprintCanonicalSnapshot(syncHandler.toSettings());
	const synchronous = new HardAi().computeTurn(syncHandler, request.aiSettings)?.shot;
	const start = performance.now();
	worker.postMessage(request);
	const message = await waitFor(worker, "result");
	roundTripMs += performance.now() - start;
	if (!message.response || JSON.stringify(message.response.action) !== JSON.stringify(synchronous) || message.response.postTurnStateHash !== syncPostTurnStateHash || message.response.basedOnStateHash !== request.basedOnStateHash) throw new Error(`Worker parity failed for ${request.requestId}`);
	results.push(message.response);
}
worker.postMessage(requests[0]);
const repeatedMessage = await waitFor(worker, "result");
if (!repeatedMessage.response || repeatedMessage.response.action && JSON.stringify(repeatedMessage.response.action) !== JSON.stringify(results[0]!.action) || repeatedMessage.response.postTurnStateHash !== results[0]!.postTurnStateHash) throw new Error("Repeated worker request was not deterministic");
const responseBytes = results.map(response => Buffer.byteLength(JSON.stringify(response)));
console.log(JSON.stringify({ startupMs, requestCount: requests.length, snapshotBytes, requestBytes, responseBytes, localStructuredCloneMs: localCloneMs, requestRoundTripMs, roundTripMs, averageWorkerComputeMs: results.reduce((sum, result) => sum + result.computeMs, 0) / results.length, playerTurnFrames, averagePlayerTurnFrames: playerTurnFrames.reduce((sum, value) => sum + value, 0) / playerTurnFrames.length, estimatedPlayerVisibleSecondsAt60Hz: playerTurnFrames.reduce((sum, value) => sum + value, 0) / playerTurnFrames.length / 60, parity: "PASS", repeatedRequestParity: "PASS" }));
await worker.terminate();
