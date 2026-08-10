import { GAMEPLAY_BALANCE_TARGETS } from "../../src/content/balanceTargets.js";
import type { MapQualificationOutput } from "./mapQualification.js";

/**
 * Aggregation of a shipped-map matrix into the Section 17.7 metrics:
 * counts, terminal/draw/ongoing/instant-death/turn-limit rates, turn
 * duration percentiles, accepted actions, simulated frames, engine work,
 * side/team/first-turn win splits, hard failures, and warning signals.
 */

export interface MatrixSummary {
	totalRuns: number;
	terminalRuns: number;
	perMap: Record<string, { qualified: number; blocked: number; terminal: number; draw: number; ongoing: number; instantDeath: number; turnLimit: number; invariantFailures: number; replayRestoreFailures: number }>;
	terminalRate: number;
	drawRate: number;
	ongoingRate: number;
	instantDeathRate: number;
	turnLimitRate: number;
	turnStats: { min: number; median: number; p90: number; p95: number; max: number };
	totalAcceptedActions: number;
	totalSimulatedFrames: number;
	totalEngineWork: number;
	leftWins: number;
	rightWins: number;
	team0Wins: number;
	team1Wins: number;
	openingWins: number;
	secondWins: number;
	firstTurnWins: number;
	hardFailures: string[];
	warnings: string[];
}

export const BLOCKED_MAP_ID = "frostbite-arena";

export function isHardFailure(run: MapQualificationOutput): boolean {
	if (run.mapId === BLOCKED_MAP_ID) return false;
	const checks = run.checks;
	return !checks.schemaValid || !checks.finiteSpawn || !checks.uniqueSpawn || !checks.noSolidOverlap
		|| !checks.noLethalOverlap || !checks.containmentValid || !checks.legalFirstAction
		|| !checks.boundedPlayback || !checks.deterministic || !checks.snapshotRestore
		|| !checks.replayEquality || !checks.noPostCompletionMutation
		|| run.spawnFindings.length > 0 || run.invariantFindings.length > 0
		|| run.replayRestoreStatus !== "ok" || run.safetyLimitStatus === "failure";
}

function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function percentile(values: number[], p: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
	return sorted[index]!;
}

export function computeSummary(records: MapQualificationOutput[]): MatrixSummary {
	const perMap: MatrixSummary["perMap"] = {};
	const hardFailures: string[] = [];
	const turns: number[] = [];
	const perPolicyOngoing: Record<string, { ongoing: number; total: number }> = {};
	let terminalRuns = 0;
	let drawRuns = 0;
	let ongoingRuns = 0;
	let instantDeathRuns = 0;
	let turnLimitRuns = 0;
	let totalAcceptedActions = 0;
	let totalSimulatedFrames = 0;
	let totalEngineWork = 0;
	let leftWins = 0;
	let rightWins = 0;
	let team0Wins = 0;
	let team1Wins = 0;
	let openingWins = 0;
	let secondWins = 0;
	let firstTurnWins = 0;
	for (const run of records) {
		const entry = perMap[run.mapId] ?? { qualified: 0, blocked: 0, terminal: 0, draw: 0, ongoing: 0, instantDeath: 0, turnLimit: 0, invariantFailures: 0, replayRestoreFailures: 0 };
		const blocked = run.mapId === BLOCKED_MAP_ID;
		if (blocked) entry.blocked++;
		else if (!isHardFailure(run)) entry.qualified++;
		if (run.result === "winner") { entry.terminal++; terminalRuns++; }
		else if (run.result === "draw") { entry.draw++; drawRuns++; }
		else { entry.ongoing++; ongoingRuns++; entry.turnLimit++; turnLimitRuns++; }
		if (run.result === "winner" && run.acceptedActions === 1) { entry.instantDeath++; instantDeathRuns++; firstTurnWins++; }
		if (run.result === "winner" && run.winnerTeam !== null) {
			const winnerLeft = (run.variant === "side-swapped" ? 1 : 0) === run.winnerTeam;
			if (winnerLeft) leftWins++; else rightWins++;
			if (run.winnerTeam === 0) team0Wins++; else team1Wins++;
			if (run.winnerTeam === run.firstTeam) openingWins++; else secondWins++;
		}
		entry.invariantFailures += run.invariantFindings.length;
		if (run.replayRestoreStatus !== "ok") entry.replayRestoreFailures++;
		perMap[run.mapId] = entry;
		turns.push(run.turns);
		totalAcceptedActions += run.acceptedActions;
		totalSimulatedFrames += run.simulatedFrames;
		totalEngineWork += run.engineWork;
		const policyBucket = perPolicyOngoing[run.policy] ?? { ongoing: 0, total: 0 };
		policyBucket.total++;
		if (run.result === "ongoing") policyBucket.ongoing++;
		perPolicyOngoing[run.policy] = policyBucket;
		if (isHardFailure(run)) hardFailures.push(`${run.mapId} ${run.variant} ${run.policy} seed ${run.seed}: ${run.invariantFindings.join(" | ") || run.spawnFindings.join(" | ") || run.replayRestoreStatus}`);
	}

	const total = records.length;
	const warnings: string[] = [];
	const sideImbalance = total > 0 ? Math.abs(leftWins - rightWins) / Math.max(1, terminalRuns) : 0;
	if (sideImbalance > GAMEPLAY_BALANCE_TARGETS.maximumSideImbalance) warnings.push(`side advantage: left ${leftWins} vs right ${rightWins} wins (imbalance ${sideImbalance.toFixed(2)})`);
	const openingImbalance = terminalRuns > 0 ? Math.abs(openingWins - secondWins) / terminalRuns : 0;
	if (openingImbalance > GAMEPLAY_BALANCE_TARGETS.maximumFirstTurnWinRate) warnings.push(`first-turn advantage: opening team wins ${openingWins} vs second team ${secondWins} (imbalance ${openingImbalance.toFixed(2)})`);
	if (ongoingRuns / total > GAMEPLAY_BALANCE_TARGETS.maximumOngoingRate) warnings.push(`frequent ongoing matches: ${ongoingRuns}/${total} (${(ongoingRuns / total).toFixed(2)})`);
	const medianTurns = median(turns);
	if (medianTurns > 0 && Math.max(...turns) > GAMEPLAY_BALANCE_TARGETS.maximumDurationOutlierFactor * medianTurns + GAMEPLAY_BALANCE_TARGETS.maximumDurationOutlierOffset) warnings.push(`extreme duration outlier: max ${Math.max(...turns)} turns vs median ${medianTurns}`);
	const meanActions = totalAcceptedActions / total;
	if (meanActions < GAMEPLAY_BALANCE_TARGETS.minimumAcceptedActions) warnings.push(`weak agency: mean ${meanActions.toFixed(2)} accepted actions per run`);
	const easyOngoing = perPolicyOngoing.easy ? perPolicyOngoing.easy.ongoing / perPolicyOngoing.easy.total : 0;
	const hardOngoing = perPolicyOngoing.hard ? perPolicyOngoing.hard.ongoing / perPolicyOngoing.hard.total : 0;
	if (Math.abs(easyOngoing - hardOngoing) > 0.3) warnings.push(`policy-dependent termination: ongoing rates easy ${easyOngoing.toFixed(2)} vs hard ${hardOngoing.toFixed(2)}`);

	return {
		totalRuns: total,
		terminalRuns,
		perMap,
		terminalRate: terminalRuns / Math.max(1, total),
		drawRate: drawRuns / Math.max(1, total),
		ongoingRate: ongoingRuns / Math.max(1, total),
		instantDeathRate: instantDeathRuns / Math.max(1, total),
		turnLimitRate: turnLimitRuns / Math.max(1, total),
		turnStats: { min: Math.min(...turns), median: medianTurns, p90: percentile(turns, 90), p95: percentile(turns, 95), max: Math.max(...turns) },
		totalAcceptedActions,
		totalSimulatedFrames,
		totalEngineWork,
		leftWins,
		rightWins,
		team0Wins,
		team1Wins,
		openingWins,
		secondWins,
		firstTurnWins,
		hardFailures,
		warnings,
	};
}
