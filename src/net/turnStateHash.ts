import type { PlayerSettings } from "../entity/types.js";
import type { MatchResult, RuleState } from "../rules/types.js";

export type AuthoritativeTurnState = {
	players: readonly PlayerSettings[];
	state: string;
	turnNumber: number;
	activeTeam: number;
	ruleState: RuleState;
	matchResult?: MatchResult;
};

/** Cheap deterministic diagnostic fingerprint; this is not a security hash. */
export function fingerprintAuthoritativeTurn(state: AuthoritativeTurnState): string {
	const source = JSON.stringify(state);
	let hash = 2166136261;
	for (let index = 0; index < source.length; index++) {
		hash ^= source.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}
