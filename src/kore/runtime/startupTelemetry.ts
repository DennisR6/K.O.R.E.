export type StartupAssetCategory = "images" | "fonts" | "audio" | "json/config" | "other";

export type StartupEvent = {
	type: string;
	timestampMs: number;
	sinceStartupMs: number;
	durationMs?: number;
	data?: unknown;
};

export type StartupAssetStats = {
	requests: number;
	completed: number;
	failed: number;
	totalBytes: number;
	totalDurationMs: number;
	maxDurationMs: number;
};

const startedAt = performance.now();
const events: StartupEvent[] = [];
const marked = new Set<string>();
const phaseStarts = new Map<string, number>();
const assets = new Map<StartupAssetCategory, StartupAssetStats>();
const flushed = new WeakMap<object, number>();

function now(): number { return performance.now(); }
function phaseStartFor(type: string): string | undefined {
	if (type.endsWith(".completed")) return `${type.slice(0, -10)}.started`;
	if (type.endsWith(".rendered")) return `${type.slice(0, -9)}.requested`;
	return undefined;
}

export function startupMark(type: string, data?: unknown): StartupEvent | undefined {
	if (!type || marked.has(type)) return undefined;
	marked.add(type);
	const timestampMs = now();
	const startType = phaseStartFor(type);
	const startTimestamp = startType ? phaseStarts.get(startType) : undefined;
	const event: StartupEvent = {
		type,
		timestampMs,
		sinceStartupMs: timestampMs - startedAt,
		...(startTimestamp === undefined ? {} : { durationMs: timestampMs - startTimestamp }),
		...(data === undefined ? {} : { data: structuredClone(data) }),
	};
	events.push(event);
	if (type.endsWith(".started") || type.endsWith(".requested")) phaseStarts.set(type, timestampMs);
	return event;
}

export function recordStartupAsset(category: StartupAssetCategory, result: { durationMs: number; bytes?: number; failed?: boolean }): void {
	const current = assets.get(category) ?? { requests: 0, completed: 0, failed: 0, totalBytes: 0, totalDurationMs: 0, maxDurationMs: 0 };
	current.requests++;
	if (result.failed) current.failed++;
	else current.completed++;
	if (Number.isFinite(result.bytes)) current.totalBytes += Math.max(0, result.bytes!);
	if (Number.isFinite(result.durationMs)) {
		current.totalDurationMs += Math.max(0, result.durationMs);
		current.maxDurationMs = Math.max(current.maxDurationMs, result.durationMs);
	}
	assets.set(category, current);
}

export function getStartupTelemetry(): { startedAt: number; events: StartupEvent[]; assets: Record<string, StartupAssetStats> } {
	return {
		startedAt,
		events: events.map(event => structuredClone(event)),
		assets: Object.fromEntries([...assets.entries()].map(([category, stats]) => [category, { ...stats }])),
	};
}

export function flushStartupTelemetry(owner: object, log: (type: string, data: unknown) => void): void {
	const start = flushed.get(owner) ?? 0;
	for (const event of events.slice(start)) log(event.type, { sinceStartupMs: event.sinceStartupMs, ...(event.durationMs === undefined ? {} : { durationMs: event.durationMs }), ...(event.data === undefined ? {} : { details: event.data }) });
	flushed.set(owner, events.length);
}

startupMark("startup.begin");
