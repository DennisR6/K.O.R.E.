/**
 * Release-facing balance guardrails for deterministic matrix and tournament runs.
 * These are qualification targets, not canonical physics state; map/content tuning
 * may change the values only with updated evidence and human review.
 */
export const GAMEPLAY_BALANCE_TARGETS = {
	minimumAcceptedActions: 1.5,
	maximumOngoingRate: 0.25,
	maximumFirstTurnWinRate: 0.25,
	maximumSideImbalance: 0.25,
	maximumDurationOutlierFactor: 3,
	maximumDurationOutlierOffset: 1,
} as const;

export type GameplayBalanceTargets = typeof GAMEPLAY_BALANCE_TARGETS;
