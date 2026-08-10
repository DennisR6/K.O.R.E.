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
	if (request.kind === "initial-decision") {
		handler.setRuleState(request.nextRuleState);
	} else {
		if (!request.acceptedAction) throw new Error("Worker precompute request is missing its accepted action");
		handler.resolveTurn(request.acceptedAction);
		handler.startTurn(request.nextRuleState);
	}
	const postTurnStateHash = fingerprintCanonicalSnapshot(handler.toSettings());
	const action = new HardAi().computeTurn(handler, request.aiSettings)?.shot
		?? (() => {
			const actor = handler.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(request.aiSettings.team) && handler.isActorEligibleForAction(entity.getId()));
			return actor ? { actorId: actor.getId(), angle: 0, power: 4 } : undefined;
		})();
	return {
		schemaVersion: request.schemaVersion,
		...(request.kind ? { kind: request.kind } : {}),
		requestId: request.requestId,
		basedOnStateHash: request.basedOnStateHash,
		expectedTurnNumber: request.expectedTurnNumber,
		expectedNextTeam: request.expectedNextTeam,
		action,
		postTurnStateHash,
		computeMs: performance.now() - start,
	};
}
