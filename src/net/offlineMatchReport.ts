import type { GameHandler } from "../engine/Handler.js";
import { GameState } from "../engine/types.js";
import { GameEmitter } from "../emitter/EngineEmitter.js";
import type { CombiEmitter } from "../emitter/InputEmitter.js";
import type { MatchResult } from "../rules/types.js";
import type { MatchMode } from "../scenes/matchPipeline.js";
import type { ReplayDocument } from "../replay/types.js";
import { LoggerType } from "../engine/runtimeLog.js";

/**
 * Browser-side collection and upload of completed offline matches (hotseat,
 * human-vs-KI, KI-vs-KI). The finished match is reported once, together with
 * its mode header and recorded replay, to the server SQLite store so offline
 * games generate the same kind of queryable data as online matches.
 */
export type OfflineMatchRecordPayload = {
	mode: MatchMode;
	mapId: string;
	/** The deterministic match seed; the recorded replay shares it. */
	seed: number;
	difficulty?: "easy" | "medium" | "hard";
	players: string[];
	result: MatchResult;
	replay: ReplayDocument;
	performanceLogs?: unknown[];
};

const OFFLINE_MATCH_PATH = "offline-matches";
const MAX_KEEPALIVE_BYTES = 60_000;
const REPORT_ATTEMPTS = 3;
const PENDING_REPORTS_KEY = "kore.offline-match-reports.v1";

type PendingReport = { key: string; record: OfflineMatchRecordPayload };

export function buildOfflineMatchEndpoint(origin: string): string {
	if (!origin) return "";
	const url = new URL(origin);
	const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
	url.pathname = `${path}${OFFLINE_MATCH_PATH}`;
	url.search = "";
	url.hash = "";
	return url.toString();
}

/** Builds the full persisted record for a finished handler, or undefined when no recorder exists. */
export function collectOfflineMatchRecord(handler: GameHandler, mode: MatchMode, mapId: string, result: MatchResult): OfflineMatchRecordPayload | undefined {
	const replay = collectReplay(handler);
	if (!replay) return undefined;
	const difficulty = handler.getSettings()?.ai?.difficulty;
	const record: OfflineMatchRecordPayload = {
		mode,
		mapId,
		seed: replay.seed,
		players: [...(handler.getSettings()?.allTeams ?? [])],
		result,
		replay,
		performanceLogs: handler.getLogs(LoggerType.Performance).filter(isPersistedPerformanceLog),
	};
	if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard") record.difficulty = difficulty;
	return record;
}

/** Excludes verbose simulation diagnostics that are not used by dashboard aggregation. */
function isPersistedPerformanceLog(entry: { type: string }): boolean {
	return entry.type === "turn.completed"
		|| entry.type === "turn.playback.completed"
		|| entry.type === "performance.frame-window"
		|| entry.type === "performance.event-loop-window"
		|| entry.type === "ai.fallback.completed"
		|| entry.type.startsWith("ai.worker.");
}

/**
 * Watches the handler and reports each finished match once as soon as it
 * reaches a terminal result, retrying until delivery succeeds. The check runs
 * on the draw path because a
 * completed match freezes its tick loop; the browser draw loop still runs
 * every frame at `Game_over`, so the report fires exactly when the result
 * overlay becomes visible. Failures never throw: an unreachable or absent
 * report endpoint must never break the local match or the menu.
 */
export function installOfflineMatchReport(handler: GameHandler, mode: MatchMode, mapId: string, reporter: (record: OfflineMatchRecordPayload) => void | boolean | Promise<void | boolean>): void {
	let reported = false;
	let reporting = false;
	let retryAt = 0;
	let generation = 0;
	handler.addPostDrawer({
		draw: () => {
			if (handler.getState() !== GameState.Game_over) {
				// A rematch on the same handler starts a fresh game; the next
				// terminal result must be reported again.
				reported = false;
				reporting = false;
				retryAt = 0;
				generation++;
				return;
			}
			if (reported || reporting || Date.now() < retryAt) return;
			const result = handler.getMatchResult();
			if (!result) return;
			const record = collectOfflineMatchRecord(handler, mode, mapId, result);
			if (!record) return;
			reporting = true;
			const reportGeneration = generation;
			void Promise.resolve(reporter(record)).then(value => {
				if (generation !== reportGeneration) return;
				// `false` is the explicit failure result used by reportOfflineMatch;
				// legacy void reporters are treated as successful delivery.
				if (value === false) retryAt = Date.now() + 1_000;
				else reported = true;
			}).catch(() => { if (generation === reportGeneration) retryAt = Date.now() + 1_000; }).finally(() => { if (generation === reportGeneration) reporting = false; });
		},
	});
}

/** Default reporter: POSTs the record to the same-origin server store. */
export async function reportOfflineMatch(record: OfflineMatchRecordPayload, options: { endpoint?: string; fetchImpl?: typeof fetch } = {}): Promise<boolean> {
	const endpoint = options.endpoint ?? buildOfflineMatchEndpoint(globalThis.location?.href ?? globalThis.location?.origin ?? "");
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== "function" || !endpoint || endpoint === "/") return false;
	const key = offlineReportKey(record);
	storePendingReport({ key, record });
	const body = JSON.stringify(record);
	for (let attempt = 0; attempt < REPORT_ATTEMPTS; attempt++) {
		try {
			const response = await fetchImpl(endpoint, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body,
				// Chromium limits keepalive request bodies to roughly 64 KiB. Large
				// replays must use a normal request instead of being silently dropped.
				...(body.length <= MAX_KEEPALIVE_BYTES ? { keepalive: true } : {}),
			});
			if (response.ok) {
				removePendingReport(key);
				return true;
			}
			if (response.status >= 400 && response.status < 500) {
				removePendingReport(key);
				return false;
			}
		} catch {
			// Retry transient network failures below.
		}
		if (attempt + 1 < REPORT_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
	}
	return false;
}

/** Retries reports left behind when a result page was closed during delivery. */
export async function flushOfflineMatchReports(): Promise<void> {
	for (const pending of readPendingReports()) await reportOfflineMatch(pending.record);
}

function offlineReportKey(record: OfflineMatchRecordPayload): string {
	return `${record.mode}|${record.mapId}|${record.seed}|${JSON.stringify(record.replay)}`;
}

function getStorage(): Storage | undefined {
	try { return globalThis.localStorage; } catch { return undefined; }
}

function readPendingReports(): PendingReport[] {
	const storage = getStorage();
	if (!storage) return [];
	try {
		const parsed = JSON.parse(storage.getItem(PENDING_REPORTS_KEY) ?? "[]") as unknown;
		return Array.isArray(parsed) ? parsed.filter(isPendingReport) : [];
	} catch { return []; }
}

function isPendingReport(value: unknown): value is PendingReport {
	return !!value && typeof value === "object" && typeof (value as { key?: unknown }).key === "string" && !!(value as { record?: unknown }).record;
}

function storePendingReport(pending: PendingReport): void {
	const storage = getStorage();
	if (!storage) return;
	try {
		const reports = readPendingReports().filter(existing => existing.key !== pending.key);
		reports.push(pending);
		storage.setItem(PENDING_REPORTS_KEY, JSON.stringify(reports));
	} catch { /* Storage may be unavailable or full; the live request still runs. */ }
}

function removePendingReport(key: string): void {
	const storage = getStorage();
	if (!storage) return;
	try {
		const remaining = readPendingReports().filter(report => report.key !== key);
		if (remaining.length) storage.setItem(PENDING_REPORTS_KEY, JSON.stringify(remaining));
		else storage.removeItem(PENDING_REPORTS_KEY);
	} catch { /* Ignore storage failures after successful delivery. */ }
}

function collectReplay(handler: GameHandler): ReplayDocument | undefined {
	const emitterSystem = handler.getSystems().find(system => (system as { systemId?: string }).systemId === "core.emitter") as { emitter?: CombiEmitter } | undefined;
	const gameEmitter = emitterSystem?.emitter?.getEmitters().find(emitter => emitter instanceof GameEmitter) as GameEmitter | undefined;
	return gameEmitter?.recorder.getReplay() ?? (handler.getSystems().find(system => typeof (system as { getReplay?: unknown }).getReplay === "function") as { getReplay?: () => ReplayDocument | undefined } | undefined)?.getReplay?.();
}
