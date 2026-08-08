import { createRuntimeHandler } from "../../engine/runtimeFactory.js";
import { HardAi } from "../hardAi.js";
import { fingerprintCanonicalSnapshot, type HardAiWorkerRequest, type HardAiWorkerResponse } from "./protocol.js";

export function restoreHardAiWorkerHandler(snapshot: HardAiWorkerRequest["snapshot"]): ReturnType<typeof createRuntimeHandler> {
	const settings = structuredClone(snapshot);
	return createRuntimeHandler(settings);
}

/** Worker-host-neutral deterministic computation; it owns no browser resources or live references. */
export function computeHardAiWorkerRequest(request: HardAiWorkerRequest): HardAiWorkerResponse {
	const start = performance.now();
	const handler = restoreHardAiWorkerHandler(request.snapshot);
	handler.resolveTurn(request.acceptedAction);
	handler.startTurn(request.nextRuleState);
	const postTurnStateHash = fingerprintCanonicalSnapshot(handler.toSettings());
	const action = new HardAi().computeTurn(handler, request.aiSettings)?.shot;
	return {
		schemaVersion: request.schemaVersion,
		requestId: request.requestId,
		basedOnStateHash: request.basedOnStateHash,
		expectedTurnNumber: request.expectedTurnNumber,
		expectedNextTeam: request.expectedNextTeam,
		action,
		postTurnStateHash,
		computeMs: performance.now() - start,
	};
}
