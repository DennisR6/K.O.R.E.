import type { GameHandler } from "../engine/Handler.js";
import { GameState } from "../engine/types.js";
import { GameEmitter } from "../emitter/EngineEmitter.js";
import type { CombiEmitter } from "../emitter/InputEmitter.js";
import type { MatchResult } from "../rules/types.js";
import type { MatchMode } from "../scenes/matchPipeline.js";
import type { ReplayDocument } from "../replay/types.js";

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
};

const OFFLINE_MATCH_PATH = "offline-matches";

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
	};
	if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard") record.difficulty = difficulty;
	return record;
}

/**
 * Watches the handler and reports each finished match exactly once as soon as
 * it reaches a terminal result. The check runs on the draw path because a
 * completed match freezes its tick loop; the browser draw loop still runs
 * every frame at `Game_over`, so the report fires exactly when the result
 * overlay becomes visible. Failures never throw: an unreachable or absent
 * report endpoint must never break the local match or the menu.
 */
export function installOfflineMatchReport(handler: GameHandler, mode: MatchMode, mapId: string, reporter: (record: OfflineMatchRecordPayload) => void | Promise<void>): void {
	let reported = false;
	handler.addPostDrawer({
		draw: () => {
			if (handler.getState() !== GameState.Game_over) {
				// A rematch on the same handler starts a fresh game; the next
				// terminal result must be reported again.
				reported = false;
				return;
			}
			if (reported) return;
			const result = handler.getMatchResult();
			if (!result) return;
			reported = true;
			const record = collectOfflineMatchRecord(handler, mode, mapId, result);
			if (!record) return;
			void Promise.resolve(reporter(record));
		},
	});
}

/** Default reporter: POSTs the record to the same-origin server store. */
export async function reportOfflineMatch(record: OfflineMatchRecordPayload, options: { endpoint?: string; fetchImpl?: typeof fetch } = {}): Promise<boolean> {
	const endpoint = options.endpoint ?? buildOfflineMatchEndpoint(globalThis.location?.href ?? globalThis.location?.origin ?? "");
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== "function" || !endpoint || endpoint === "/") return false;
	try {
		const response = await fetchImpl(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(record), keepalive: true });
		return response.ok;
	} catch {
		return false;
	}
}

function collectReplay(handler: GameHandler): ReplayDocument | undefined {
	const emitterSystem = handler.getSystems().find(system => (system as { systemId?: string }).systemId === "core.emitter") as { emitter?: CombiEmitter } | undefined;
	const gameEmitter = emitterSystem?.emitter?.getEmitters().find(emitter => emitter instanceof GameEmitter) as GameEmitter | undefined;
	return gameEmitter?.recorder.getReplay() ?? (handler.getSystems().find(system => typeof (system as { getReplay?: unknown }).getReplay === "function") as { getReplay?: () => ReplayDocument | undefined } | undefined)?.getReplay?.();
}
