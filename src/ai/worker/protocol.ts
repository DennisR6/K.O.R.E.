import type { AiDecision } from "../aiEmitter.js";
import type { AiSettings } from "../types.js";
import type { IInput, EngineSettings } from "../../engine/types.js";
import type { RuleState } from "../../rules/types.js";

export const HARD_AI_WORKER_PROTOCOL_VERSION = 1 as const;

export type HardAiWorkerRequest = {
	schemaVersion: typeof HARD_AI_WORKER_PROTOCOL_VERSION;
	requestId: string;
	basedOnStateHash: string;
	expectedTurnNumber: number;
	expectedNextTeam: number;
	nextRuleState: RuleState;
	snapshot: EngineSettings;
	acceptedAction: IInput;
	aiSettings: AiSettings;
};

export type HardAiWorkerResponse = {
	schemaVersion: typeof HARD_AI_WORKER_PROTOCOL_VERSION;
	requestId: string;
	basedOnStateHash: string;
	expectedTurnNumber: number;
	expectedNextTeam: number;
	action: AiDecision["shot"];
	postTurnStateHash: string;
	computeMs: number;
};

/** Stable non-cryptographic provenance fingerprint for stale-result checks. */
export function fingerprintHardAiRequest(request: Pick<HardAiWorkerRequest, "snapshot" | "acceptedAction" | "expectedTurnNumber" | "expectedNextTeam" | "nextRuleState" | "aiSettings">): string {
	const source = JSON.stringify({ snapshot: request.snapshot, acceptedAction: request.acceptedAction, expectedTurnNumber: request.expectedTurnNumber, expectedNextTeam: request.expectedNextTeam, nextRuleState: request.nextRuleState, aiSettings: request.aiSettings });
	let hash = 2166136261;
	for (let index = 0; index < source.length; index++) {
		hash ^= source.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}

export function fingerprintCanonicalSnapshot(snapshot: EngineSettings): string {
	return fingerprintString(JSON.stringify(snapshot));
}

function fingerprintString(source: string): string {
	let hash = 2166136261;
	for (let index = 0; index < source.length; index++) {
		hash ^= source.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}
