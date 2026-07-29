import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import type { EngineSettings } from "../engine/types.js";

export type StoredGame = {
	id: string;
	settings: EngineSettings;
	users: string[];
	currentTeam: number;
	turnNumber: number;
	updatedAt: number;
};

type StoredGameRow = {
	id: string;
	snapshot: Uint8Array;
	current_team: number;
	turn_number: number;
	updated_at: number;
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
	}

	public createGame(game: StoredGame): void {
		const snapshot = compress(game.settings);
		this.db.transaction(() => {
			this.db.query(`
				INSERT INTO games (id, snapshot, current_team, turn_number, updated_at)
				VALUES (?1, ?2, ?3, ?4, ?5)
			`).run(game.id, snapshot, game.currentTeam, game.turnNumber, game.updatedAt);
			const insertPlayer = this.db.query("INSERT INTO game_players (game_id, user_id, team) VALUES (?1, ?2, ?3)");
			game.users.forEach((user, team) => insertPlayer.run(game.id, user, team));
		})();
	}

	public saveGame(game: StoredGame): void {
		const snapshot = compress(game.settings);
		this.db.query(`
			UPDATE games
			SET snapshot = ?2, current_team = ?3, turn_number = ?4, updated_at = ?5
			WHERE id = ?1
		`).run(game.id, snapshot, game.currentTeam, game.turnNumber, game.updatedAt);
	}

	public loadGame(id: string): StoredGame | undefined {
		const row = this.db.query("SELECT id, snapshot, current_team, turn_number, updated_at FROM games WHERE id = ?1")
			.get(id) as StoredGameRow | null;
		if (!row) return undefined;
		const users = this.db.query("SELECT user_id FROM game_players WHERE game_id = ?1 ORDER BY team ASC")
			.all(id) as StoredUserRow[];
		return {
			id: row.id,
			settings: decompress(row.snapshot),
			users: users.map(user => user.user_id),
			currentTeam: row.current_team,
			turnNumber: row.turn_number,
			updatedAt: row.updated_at,
		};
	}

	public findGameIdForUser(userId: string): string | undefined {
		const row = this.db.query("SELECT game_id FROM game_players WHERE user_id = ?1").get(userId) as { game_id: string } | null;
		return row?.game_id;
	}

	public hasGame(id: string): boolean {
		return this.db.query("SELECT 1 AS found FROM games WHERE id = ?1").get(id) !== null;
	}

	public getCompressedSnapshotSize(id: string): number | undefined {
		const row = this.db.query("SELECT length(snapshot) AS size FROM games WHERE id = ?1").get(id) as { size: number } | null;
		return row?.size;
	}

	public close(): void { this.db.close() }
}

function compress(settings: EngineSettings): Uint8Array {
	return gzipSync(JSON.stringify(settings));
}

function decompress(snapshot: Uint8Array): EngineSettings {
	return JSON.parse(gunzipSync(snapshot).toString()) as EngineSettings;
}
