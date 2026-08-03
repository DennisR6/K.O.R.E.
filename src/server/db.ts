import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import type { EngineSettings } from "../engine/types.js";
import { GameState } from "../engine/types.js";
import type { ReplayAction } from "../replay/types.js";
import type { AuthoritativeMatchStatus, PersistedMatchLifecycle } from "./types.js";

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
		this.migrateLegacyLifecycleRows();
		// A registry cache cannot survive a process restart. This repository is a
		// single-server deployment, so any stale resident row is sleeping now.
		this.db.query("UPDATE game_lifecycle SET status = 'sleeping', status_changed_at = ?1 WHERE status = 'resident'")
			.run(Date.now());
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
