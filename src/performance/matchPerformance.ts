import type { RuntimeLogEntry } from "../engine/runtimeLog.js";

export const PERFORMANCE_SCHEMA_VERSION = 1 as const;

export type PerformanceMetricSummary = {
	count: number;
	min: number;
	median: number;
	p90: number;
	p95: number;
	max: number;
};

export type PerformanceTurnReport = {
	turnNumber: number;
	team?: number;
	turnDurationMs?: number;
	playerVisibleDurationMs?: number;
	workerComputeMs?: number;
	precomputeHeadroomMs?: number;
	postTurnWaitMs?: number;
	workerReadyBeforeTurnEnd?: boolean;
	fallbackOccurred?: boolean;
	fallbackReason?: string;
	fallbackDurationMs?: number;
	eventLoopGapMaxMs?: number;
	eventLoopGapP95Ms?: number;
};

export type PerformanceSummary = {
	turnDurationMs?: PerformanceMetricSummary;
	playerVisibleDurationMs?: PerformanceMetricSummary;
	workerComputeMs?: PerformanceMetricSummary;
	precomputeHeadroomMs?: PerformanceMetricSummary;
	postTurnWaitMs?: PerformanceMetricSummary;
	fallbackDurationMs?: PerformanceMetricSummary;
	frameTimeMs?: PerformanceMetricSummary;
	eventLoopGapMs?: PerformanceMetricSummary;
	workerRequestCount: number;
	workerCompletedCount: number;
	workerRejectedCount: number;
	workerFailedCount: number;
	precomputeHitCount: number;
	precomputeHitRate: number;
	fallbackCount: number;
	fallbackDurationTotalMs: number;
};

export type PerformanceClientMetadata = {
	platform?: "desktop" | "mobile" | "other";
	browser?: string;
	logicalCpuBucket?: "1" | "2-4" | "5-8" | "9+";
	memoryBucket?: "0-2" | "3-8" | "9+";
};

export type MatchPerformanceReport = {
	schemaVersion: typeof PERFORMANCE_SCHEMA_VERSION;
	gameId: string;
	userId: string;
	engineVersion?: string;
	client?: PerformanceClientMetadata;
	summary: PerformanceSummary;
	turns: PerformanceTurnReport[];
};

type MutableTurn = PerformanceTurnReport & { fallbackDurationTotalMs?: never };
type SampleStore = Map<string, number[]>;

/** Aggregates detached runtime observations without retaining raw log entries. */
export function aggregatePerformanceLogs(
	logs: readonly RuntimeLogEntry[],
	identity: { gameId: string; userId: string; engineVersion?: string; client?: PerformanceClientMetadata },
): MatchPerformanceReport {
	const samples: SampleStore = new Map();
	const turns = new Map<number, MutableTurn>();
	let workerRequestCount = 0;
	let workerCompletedCount = 0;
	let workerRejectedCount = 0;
	let workerFailedCount = 0;
	let precomputeHitCount = 0;
	let fallbackCount = 0;
	let fallbackDurationTotalMs = 0;

	const addSample = (name: string, value: unknown): void => {
		if (typeof value !== "number" || !Number.isFinite(value)) return;
		const values = samples.get(name) ?? [];
		values.push(value);
		samples.set(name, values);
	};
	const turnFor = (entry: RuntimeLogEntry, data: Record<string, unknown>): MutableTurn => {
		const turn = turns.get(entry.turnNumber) ?? { turnNumber: entry.turnNumber };
		if (typeof data.team === "number" && Number.isSafeInteger(data.team)) turn.team = data.team;
		turns.set(entry.turnNumber, turn);
		return turn;
	};
	const setNumber = (turn: MutableTurn, key: keyof PerformanceTurnReport, value: unknown): void => {
		if (typeof value === "number" && Number.isFinite(value)) (turn as Record<string, unknown>)[key] = value;
	};

	for (const entry of logs) {
		const data = entry.data && typeof entry.data === "object" ? entry.data as Record<string, unknown> : {};
		const turn = turnFor(entry, data);
		switch (entry.type) {
			case "ai.worker.requested": workerRequestCount++; break;
			case "ai.worker.completed":
				workerCompletedCount++;
				setNumber(turn, "workerComputeMs", data.workerComputeMs); setNumber(turn, "playerVisibleDurationMs", data.playerVisibleDurationMs);
				setNumber(turn, "precomputeHeadroomMs", data.precomputeHeadroomMs); setNumber(turn, "postTurnWaitMs", data.postTurnWaitMs);
				if (typeof data.workerReadyBeforeTurnEnd === "boolean") turn.workerReadyBeforeTurnEnd = data.workerReadyBeforeTurnEnd;
				if (data.workerReadyBeforeTurnEnd === true) precomputeHitCount++;
				addSample("workerComputeMs", data.workerComputeMs); addSample("precomputeHeadroomMs", data.precomputeHeadroomMs); addSample("postTurnWaitMs", data.postTurnWaitMs);
				break;
			case "ai.worker.rejected": workerRejectedCount++; break;
			case "ai.worker.failed": workerFailedCount++; break;
			case "ai.fallback.completed":
				fallbackCount++; fallbackDurationTotalMs += typeof data.durationMs === "number" && Number.isFinite(data.durationMs) ? data.durationMs : 0;
				turn.fallbackOccurred = true; if (typeof data.reason === "string") turn.fallbackReason = data.reason;
				setNumber(turn, "fallbackDurationMs", data.durationMs); addSample("fallbackDurationMs", data.durationMs); break;
			case "turn.completed":
				setNumber(turn, "turnDurationMs", data.turnDurationMs ?? data.durationMs); addSample("turnDurationMs", data.turnDurationMs ?? data.durationMs); break;
			case "turn.playback.completed":
				setNumber(turn, "playerVisibleDurationMs", data.playerVisibleDurationMs ?? data.durationMs); addSample("playerVisibleDurationMs", data.playerVisibleDurationMs ?? data.durationMs); break;
			case "performance.frame-window": addSample("frameTimeMs", data.medianMs); break;
			case "performance.event-loop-window":
				addSample("eventLoopGapMs", data.maxMs);
				setNumber(turn, "eventLoopGapMaxMs", data.maxMs); setNumber(turn, "eventLoopGapP95Ms", data.p95Ms);
				break;
		}
	}

	const summary: PerformanceSummary = {
		workerRequestCount, workerCompletedCount, workerRejectedCount, workerFailedCount,
		precomputeHitCount, precomputeHitRate: workerCompletedCount === 0 ? 0 : precomputeHitCount / workerCompletedCount,
		fallbackCount, fallbackDurationTotalMs,
	};
	for (const [name, values] of samples) (summary as Record<string, unknown>)[name] = summarize(values);
	return { schemaVersion: PERFORMANCE_SCHEMA_VERSION, ...identity, summary, turns: [...turns.values()].sort((a, b) => a.turnNumber - b.turnNumber) };
}

function summarize(values: readonly number[]): PerformanceMetricSummary {
	const sorted = [...values].sort((a, b) => a - b);
	const at = (fraction: number): number => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]!;
	return { count: sorted.length, min: sorted[0]!, median: at(0.5), p90: at(0.9), p95: at(0.95), max: sorted[sorted.length - 1]! };
}

export function validateMatchPerformanceReport(value: unknown): asserts value is MatchPerformanceReport {
	if (!isRecord(value) || value.schemaVersion !== PERFORMANCE_SCHEMA_VERSION || !nonEmpty(value.gameId) || !nonEmpty(value.userId) || !isRecord(value.summary) || !Array.isArray(value.turns)) throw new Error("Invalid performance report envelope");
	validateSummary(value.summary);
	for (const turn of value.turns) validateTurn(turn);
	if (value.engineVersion !== undefined && !nonEmpty(value.engineVersion)) throw new Error("Invalid performance engine version");
	if (value.client !== undefined && !isRecord(value.client)) throw new Error("Invalid performance client metadata");
}

function validateSummary(value: Record<string, unknown>): void {
	for (const key of ["workerRequestCount", "workerCompletedCount", "workerRejectedCount", "workerFailedCount", "precomputeHitCount", "fallbackCount"]) if (!safeCount(value[key])) throw new Error(`Invalid performance count '${key}'`);
	if (typeof value.precomputeHitRate !== "number" || !Number.isFinite(value.precomputeHitRate) || value.precomputeHitRate < 0 || value.precomputeHitRate > 1) throw new Error("Invalid precompute hit rate");
	if (typeof value.fallbackDurationTotalMs !== "number" || !Number.isFinite(value.fallbackDurationTotalMs) || value.fallbackDurationTotalMs < 0) throw new Error("Invalid fallback duration total");
	for (const key of ["turnDurationMs", "playerVisibleDurationMs", "workerComputeMs", "precomputeHeadroomMs", "postTurnWaitMs", "fallbackDurationMs", "frameTimeMs", "eventLoopGapMs"]) if (value[key] !== undefined) validateSummaryMetric(value[key]);
}

function validateSummaryMetric(value: unknown): void {
	if (!isRecord(value) || !safeCount(value.count) || value.count < 1) throw new Error("Invalid performance metric summary");
	for (const key of ["min", "median", "p90", "p95", "max"]) if (typeof value[key] !== "number" || !Number.isFinite(value[key])) throw new Error("Invalid performance metric percentile");
}

function validateTurn(value: unknown): void {
	if (!isRecord(value) || !Number.isSafeInteger(value.turnNumber) || value.turnNumber < 0 || (value.team !== undefined && (!Number.isSafeInteger(value.team) || value.team < 0))) throw new Error("Invalid performance turn identity");
	for (const key of ["turnDurationMs", "playerVisibleDurationMs", "workerComputeMs", "postTurnWaitMs", "fallbackDurationMs", "eventLoopGapMaxMs", "eventLoopGapP95Ms"]) if (value[key] !== undefined && (typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < 0)) throw new Error("Invalid performance turn metric");
	if (value.precomputeHeadroomMs !== undefined && (typeof value.precomputeHeadroomMs !== "number" || !Number.isFinite(value.precomputeHeadroomMs))) throw new Error("Invalid performance headroom");
	if (value.workerReadyBeforeTurnEnd !== undefined && typeof value.workerReadyBeforeTurnEnd !== "boolean") throw new Error("Invalid performance readiness");
	if (value.fallbackOccurred !== undefined && typeof value.fallbackOccurred !== "boolean") throw new Error("Invalid performance fallback flag");
	if (value.fallbackReason !== undefined && !nonEmpty(value.fallbackReason)) throw new Error("Invalid performance fallback reason");
}

function safeCount(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 256; }
function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
