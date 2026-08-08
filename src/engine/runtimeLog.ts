/** Ephemeral observations from one live handler instance. Never canonical state. */
export enum LoggerType {
	Performance = "performance",
	Input = "input",
	Turn = "turn",
	Worker = "worker",
	Diagnostic = "diagnostic",
}

export interface RuntimeLogEntry<T = unknown> {
	type: string;
	timestampMs: number;
	turnNumber: number;
	data: T;
}

/** Maps stable event namespaces to the small console-facing category set. */
export function isRuntimeLogCategory(type: string, category: LoggerType): boolean {
	if (category === LoggerType.Turn) return type.startsWith("turn.") || type.startsWith("turnPacket.");
	if (category === LoggerType.Worker) return type.startsWith("worker.") || type.includes(".worker.");
	if (category === LoggerType.Performance) return type.startsWith("performance.") || type.startsWith("turn.") || type.startsWith("ai.");
	return type.startsWith(`${category}.`);
}

/** Monotonic runtime clock used for diagnostics and duration measurements. */
export function runtimeNow(): number { return performance.now(); }

export interface FrameWindowSummary {
	samples: number;
	medianMs: number;
	p95Ms: number;
	p99Ms: number;
	maxMs: number;
}

/** Summarizes a bounded frame sample window without retaining individual samples. */
export function summarizeFrameWindow(samples: readonly number[]): FrameWindowSummary | undefined {
	if (samples.length === 0) return undefined;
	const sorted = [...samples].sort((a, b) => a - b);
	const percentile = (rank: number) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * rank) - 1)]!;
	return { samples: sorted.length, medianMs: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), maxMs: sorted[sorted.length - 1]! };
}
