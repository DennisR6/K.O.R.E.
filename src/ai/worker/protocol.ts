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

export type CanonicalDifference = { path: string; workerValue: unknown; mainValue: unknown };

/** Diagnostic-only structural comparison for explaining a rejected Worker result. */
export function diffCanonicalSettings(worker: unknown, main: unknown, limit = 20): CanonicalDifference[] {
	const differences: CanonicalDifference[] = [];
	const visit = (workerValue: unknown, mainValue: unknown, path: string): void => {
		if (differences.length >= limit || Object.is(workerValue, mainValue)) return;
		if (typeof workerValue !== "object" || workerValue === null || typeof mainValue !== "object" || mainValue === null) {
			differences.push({ path, workerValue, mainValue });
			return;
		}
		if (Array.isArray(workerValue) !== Array.isArray(mainValue)) {
			differences.push({ path, workerValue, mainValue });
			return;
		}
		const workerKeys = Object.keys(workerValue as Record<string, unknown>);
		const mainKeys = Object.keys(mainValue as Record<string, unknown>);
		for (const key of [...new Set([...workerKeys, ...mainKeys])]) visit((workerValue as Record<string, unknown>)[key], (mainValue as Record<string, unknown>)[key], `${path}.${key}`);
	};
	visit(worker, main, "$" );
	return differences;
}

function fingerprintString(source: string): string {
	let hash = 2166136261;
	for (let index = 0; index < source.length; index++) {
		hash ^= source.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}
