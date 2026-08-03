import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import type { EngineSettings } from "../engine/types.js";
import { GameState } from "../engine/types.js";
import type { FrozenReplayDocument, ReplayAction } from "../replay/types.js";
import { validateFrozenReplayDocument } from "../replay/types.js";
import type { AuthoritativeMatchStatus, PersistedMatchLifecycle } from "./types.js";
import { validateMapDocument, type MapDocument } from "../contracts/documents.js";

export type StoredGame = {
	id: string;
	settings: EngineSettings;
	users: string[];
	currentTeam: number;
	turnNumber: number;
	updatedAt: number;
	actions?: ReplayAction[];
	lifecycle?: PersistedMatchLifecycle;
};
export type StoredReplayShare = { token: string; replay: FrozenReplayDocument; createdAt: number; revokedAt: number | null };
export type PublicReplayShare = { token: string; replay: Omit<FrozenReplayDocument, "finalSettings">; createdAt: number };
export type StoredMapStatus = "draft" | "approved" | "retired";
export type StoredMap = { id: string; document: MapDocument; status: StoredMapStatus; contentHash: string; createdAt: number; approvedAt: number | null };

type StoredGameRow = {
	id: string;
	snapshot: Uint8Array;
	current_team: number;
	turn_number: number;
	updated_at: number;
};

type StoredLifecycleRow = {
	version: number;
	status: AuthoritativeMatchStatus;
	created_at: number | null;
	status_changed_at: number;
	completed_at: number | null;
};

type StoredUserRow = { user_id: string };
type StoredMapRow = { id: string; document_json: string; status: StoredMapStatus; content_hash: string; created_at: number; approved_at: number | null };

/**
 * Durable game storage. Snapshots are gzip-compressed JSON so inactive matches
 * consume disk space rather than live GameHandler memory.
 */
export class GameDatabase {
	private readonly db: Database;

	constructor(path: string = ":memory:") {
		if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
		this.db = new Database(path);
		this.db.run("PRAGMA journal_mode = WAL");
		this.db.run("PRAGMA foreign_keys = ON");
		this.db.run(`
			CREATE TABLE IF NOT EXISTS games (
				id TEXT PRIMARY KEY NOT NULL,
				snapshot BLOB NOT NULL,
				current_team INTEGER NOT NULL,
				turn_number INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`);
		this.db.run(`
			CREATE TABLE IF NOT EXISTS game_players (
				game_id TEXT NOT NULL,
				user_id TEXT PRIMARY KEY NOT NULL,
				team INTEGER NOT NULL,
				FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
			)
		`);
		this.db.run(`
			CREATE TABLE IF NOT EXISTS game_lifecycle (
				game_id TEXT PRIMARY KEY NOT NULL,
				version INTEGER NOT NULL,
				status TEXT NOT NULL CHECK (status IN ('resident', 'paused', 'sleeping', 'completed')),
				created_at INTEGER,
				status_changed_at INTEGER NOT NULL,
				completed_at INTEGER,
				FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
			)
		`);
		this.db.run(`
			CREATE TABLE IF NOT EXISTS match_reports (
				id TEXT PRIMARY KEY NOT NULL,
				game_id TEXT NOT NULL,
				reporter_user_id TEXT NOT NULL,
				category TEXT NOT NULL,
				text TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				UNIQUE(game_id, reporter_user_id, category),
				FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
			)
		`);
		this.db.run(`
			CREATE TABLE IF NOT EXISTS replay_shares (
				token TEXT PRIMARY KEY NOT NULL,
				game_id TEXT NOT NULL UNIQUE,
				replay_json TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				revoked_at INTEGER,
				FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
			)
		`);
		this.db.run(`
			CREATE TABLE IF NOT EXISTS maps (
				id TEXT PRIMARY KEY NOT NULL,
				document_json TEXT NOT NULL,
				status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'retired')),
				content_hash TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				approved_at INTEGER
			)
		`);
		this.migrateLegacyLifecycleRows();
		// A registry cache cannot survive a process restart. This repository is a
		// single-server deployment, so any stale resident row is sleeping now.
		this.db.query("UPDATE game_lifecycle SET status = 'sleeping', status_changed_at = ?1 WHERE status = 'resident'")
			.run(Date.now());
	}

	/** Creates a consistent SQLite image for an authenticated operator backup. */
	exportSnapshot(): Uint8Array {
		return this.db.serialize();
	}

	public createGame(game: StoredGame): void {
		const snapshot = compress({ settings: game.settings, actions: game.actions ?? [] });
		const lifecycle = game.lifecycle ?? createLifecycle("resident", game.updatedAt, game.updatedAt);
		this.db.transaction(() => {
			this.db.query(`
				INSERT INTO games (id, snapshot, current_team, turn_number, updated_at)
				VALUES (?1, ?2, ?3, ?4, ?5)
			`).run(game.id, snapshot, game.currentTeam, game.turnNumber, game.updatedAt);
			this.writeLifecycle(game.id, lifecycle);
			const insertPlayer = this.db.query("INSERT INTO game_players (game_id, user_id, team) VALUES (?1, ?2, ?3)");
			game.users.forEach((user, team) => insertPlayer.run(game.id, user, team));
		})();
	}

	public saveGame(game: StoredGame): void {
		const snapshot = compress({ settings: game.settings, actions: game.actions ?? [] });
		this.db.transaction(() => {
			this.db.query(`
			UPDATE games
			SET snapshot = ?2, current_team = ?3, turn_number = ?4, updated_at = ?5
			WHERE id = ?1
			`).run(game.id, snapshot, game.currentTeam, game.turnNumber, game.updatedAt);
			if (game.lifecycle) this.writeLifecycle(game.id, game.lifecycle);
		})();
	}

	public loadGame(id: string): StoredGame | undefined {
		const row = this.db.query("SELECT id, snapshot, current_team, turn_number, updated_at FROM games WHERE id = ?1")
			.get(id) as StoredGameRow | null;
		if (!row) return undefined;
		const users = this.db.query("SELECT user_id FROM game_players WHERE game_id = ?1 ORDER BY team ASC")
			.all(id) as StoredUserRow[];
		const lifecycle = this.getLifecycle(id);
		if (!lifecycle) throw new Error(`Missing lifecycle state for game ${id}`);
		const decompressed = decompress(row.snapshot);
		return {
			id: row.id,
			settings: decompressed.settings,
			actions: decompressed.actions,
			users: users.map(user => user.user_id),
			currentTeam: row.current_team,
			turnNumber: row.turn_number,
			updatedAt: row.updated_at,
			lifecycle,
		};
	}

	public findGameIdForUser(userId: string): string | undefined {
		const row = this.db.query("SELECT game_id FROM game_players WHERE user_id = ?1").get(userId) as { game_id: string } | null;
		return row?.game_id;
	}

	public hasGame(id: string): boolean {
		return this.db.query("SELECT 1 AS found FROM games WHERE id = ?1").get(id) !== null;
	}

	public getLifecycle(id: string): PersistedMatchLifecycle | undefined {
		const row = this.db.query(`
			SELECT version, status, created_at, status_changed_at, completed_at
			FROM game_lifecycle WHERE game_id = ?1
		`).get(id) as StoredLifecycleRow | null;
		return row ? lifecycleFromRow(row) : undefined;
	}

	public setLifecycle(id: string, lifecycle: PersistedMatchLifecycle): void {
		if (!this.hasGame(id)) throw new Error(`Unknown game ${id}`);
		this.writeLifecycle(id, lifecycle);
	}

	public getMetricCounts(): { allTime: number; paused: number; sleeping: number } {
		const allTime = this.db.query("SELECT count(*) AS count FROM games").get() as { count: number };
		const statuses = this.db.query(`
			SELECT status, count(*) AS count FROM game_lifecycle
			WHERE status IN ('paused', 'sleeping') GROUP BY status
		`).all() as Array<{ status: AuthoritativeMatchStatus; count: number }>;
		const counts = new Map(statuses.map(row => [row.status, row.count]));
		return { allTime: allTime.count, paused: counts.get("paused") ?? 0, sleeping: counts.get("sleeping") ?? 0 };
	}

	public createMatchReport(gameId: string, reporterUserId: string, category: "conduct" | "technical" | "other", text: string, now: number = Date.now()): string {
		const id = crypto.randomUUID();
		this.db.query("INSERT INTO match_reports (id, game_id, reporter_user_id, category, text, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
			.run(id, gameId, reporterUserId, category, text, now);
		return id;
	}

	/** Inserts one immutable declarative map revision. Updating a document is forbidden. */
	public createMap(input: { id: string; document: MapDocument; status?: "draft" | "approved"; now?: number }): StoredMap {
		if (!isUuid(input.id)) throw new Error("Map IDs must be immutable UUIDs");
		validateMapDocument(input.document);
		const status = input.status ?? "draft";
		const createdAt = input.now ?? Date.now();
		if (!Number.isSafeInteger(createdAt) || createdAt < 0) throw new Error("Map creation time must be a non-negative integer");
		const document = structuredClone(input.document);
		const contentHash = hashMapDocument(document);
		const approvedAt = status === "approved" ? createdAt : null;
		this.db.query("INSERT INTO maps (id, document_json, status, content_hash, created_at, approved_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
			.run(input.id, JSON.stringify(document), status, contentHash, createdAt, approvedAt);
		return { id: input.id, document, status, contentHash, createdAt, approvedAt };
	}

	/** Human approval changes availability but can never change map content. */
	public approveMap(id: string, now: number = Date.now()): StoredMap {
		if (!isUuid(id) || !Number.isSafeInteger(now) || now < 0) throw new Error("Invalid map approval request");
		if (this.db.query("UPDATE maps SET status = 'approved', approved_at = ?2 WHERE id = ?1 AND status = 'draft'").run(id, now).changes !== 1) throw new Error("Only an existing draft map may be approved");
		return this.getMap(id)!;
	}

	/** Retired revisions remain readable for existing snapshots but are not selectable. */
	public retireMap(id: string): StoredMap {
		if (!isUuid(id)) throw new Error("Invalid map ID");
		if (this.db.query("UPDATE maps SET status = 'retired' WHERE id = ?1 AND status != 'retired'").run(id).changes !== 1) throw new Error("Only an existing active map may be retired");
		return this.getMap(id)!;
	}

	public getMap(id: string): StoredMap | undefined {
		if (!isUuid(id)) return undefined;
		const row = this.db.query("SELECT id, document_json, status, content_hash, created_at, approved_at FROM maps WHERE id = ?1").get(id) as StoredMapRow | null;
		if (!row) return undefined;
		try {
			const document = JSON.parse(row.document_json) as MapDocument;
			validateMapDocument(document);
			if (hashMapDocument(document) !== row.content_hash) throw new Error("Map content hash mismatch");
			return { id: row.id, document: structuredClone(document), status: row.status, contentHash: row.content_hash, createdAt: row.created_at, approvedAt: row.approved_at };
		} catch { throw new Error("Invalid stored map document"); }
	}

	public listMaps(status?: StoredMapStatus): StoredMap[] {
		const rows = (status === undefined
			? this.db.query("SELECT id, document_json, status, content_hash, created_at, approved_at FROM maps ORDER BY created_at, id").all()
			: this.db.query("SELECT id, document_json, status, content_hash, created_at, approved_at FROM maps WHERE status = ?1 ORDER BY created_at, id").all(status)) as StoredMapRow[];
		return rows.map(row => this.getMap(row.id)!);
	}

	public createReplayShare(gameId: string, replay: FrozenReplayDocument, now: number = Date.now()): StoredReplayShare {
		validateFrozenReplayDocument(replay);
		const lifecycle = this.getLifecycle(gameId);
		if (lifecycle?.status !== "completed") throw new Error("Replay shares require a completed match");
		const token = crypto.randomUUID().replaceAll("-", "");
		this.db.query("INSERT INTO replay_shares (token, game_id, replay_json, created_at) VALUES (?1, ?2, ?3, ?4)")
			.run(token, gameId, JSON.stringify(replay), now);
		return { token, replay: structuredClone(replay), createdAt: now, revokedAt: null };
	}

	/** Public lookup intentionally omits game IDs and the frozen final snapshot. */
	public getPublicReplayShare(token: string): PublicReplayShare | undefined {
		if (!/^[a-f0-9]{32}$/.test(token)) return undefined;
		const row = this.db.query("SELECT replay_json, created_at, revoked_at FROM replay_shares WHERE token = ?1").get(token) as { replay_json: string; created_at: number; revoked_at: number | null } | null;
		if (!row || row.revoked_at !== null || row.replay_json.length > 2_000_000) return undefined;
		try {
			const replay = JSON.parse(row.replay_json) as FrozenReplayDocument;
			validateFrozenReplayDocument(replay);
			const { finalSettings: _privateFinalSnapshot, ...publicReplay } = replay;
			return { token, replay: publicReplay, createdAt: row.created_at };
		} catch { return undefined; }
	}

	public revokeReplayShare(token: string, now: number = Date.now()): boolean {
		if (!/^[a-f0-9]{32}$/.test(token)) return false;
		return this.db.query("UPDATE replay_shares SET revoked_at = ?2 WHERE token = ?1 AND revoked_at IS NULL").run(token, now).changes > 0;
	}

	public getCompressedSnapshotSize(id: string): number | undefined {
		const row = this.db.query("SELECT length(snapshot) AS size FROM games WHERE id = ?1").get(id) as { size: number } | null;
		return row?.size;
	}

	public close(): void { this.db.close() }

	private writeLifecycle(id: string, lifecycle: PersistedMatchLifecycle): void {
		this.db.query(`
			INSERT INTO game_lifecycle (game_id, version, status, created_at, status_changed_at, completed_at)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6)
			ON CONFLICT(game_id) DO UPDATE SET
				version = excluded.version,
				status = excluded.status,
				created_at = excluded.created_at,
				status_changed_at = excluded.status_changed_at,
				completed_at = excluded.completed_at
		`).run(id, lifecycle.version, lifecycle.status, lifecycle.createdAt, lifecycle.statusChangedAt, lifecycle.completedAt);
	}

	private migrateLegacyLifecycleRows(): void {
		const rows = this.db.query(`
			SELECT games.id, games.snapshot, games.updated_at
			FROM games LEFT JOIN game_lifecycle ON games.id = game_lifecycle.game_id
			WHERE game_lifecycle.game_id IS NULL
		`).all() as Array<{ id: string; snapshot: Uint8Array; updated_at: number }>;
		this.db.transaction(() => {
			for (const row of rows) {
				let status: AuthoritativeMatchStatus = "sleeping";
				let completedAt: number | null = null;
				try {
					const settings = decompress(row.snapshot).settings;
					if (settings.state === GameState.Game_over && settings.matchResult) {
						status = "completed";
						completedAt = row.updated_at;
					}
				} catch {
					// Preserve malformed legacy snapshots for the existing load boundary.
				}
				this.writeLifecycle(row.id, {
					version: 1,
					status,
					createdAt: null,
					statusChangedAt: row.updated_at,
					completedAt,
				});
			}
		})();
	}
}

function createLifecycle(status: AuthoritativeMatchStatus, createdAt: number | null, statusChangedAt: number): PersistedMatchLifecycle {
	return {
		version: 1,
		status,
		createdAt,
		statusChangedAt,
		completedAt: status === "completed" ? statusChangedAt : null,
	};
}

function lifecycleFromRow(row: StoredLifecycleRow): PersistedMatchLifecycle {
	if (row.version !== 1) throw new Error(`Unsupported match lifecycle version ${row.version}`);
	if (row.status !== "resident" && row.status !== "paused" && row.status !== "sleeping" && row.status !== "completed") {
		throw new Error("Invalid persisted match lifecycle status");
	}
	return {
		version: 1,
		status: row.status,
		createdAt: row.created_at,
		statusChangedAt: row.status_changed_at,
		completedAt: row.completed_at,
	};
}

function compress(data: { settings: EngineSettings; actions: ReplayAction[] }): Uint8Array {
	return gzipSync(JSON.stringify(data));
}

function decompress(snapshot: Uint8Array): { settings: EngineSettings; actions: ReplayAction[] } {
	const parsed = JSON.parse(gunzipSync(snapshot).toString());
	if (parsed && typeof parsed === "object" && "settings" in parsed) {
		return { settings: parsed.settings as EngineSettings, actions: (parsed.actions ?? []) as ReplayAction[] };
	}
	return { settings: parsed as EngineSettings, actions: [] };
}

export function hashMapDocument(document: MapDocument): string {
	return createHash("sha256").update(canonicalJson(document)).digest("hex");
}

function canonicalJson(value: unknown): string {
	if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new Error("Map documents must contain finite JSON values");
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (!value || typeof value !== "object") throw new Error("Map documents must contain JSON values");
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function isUuid(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
