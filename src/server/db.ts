import { Database } from "bun:sqlite"
import type { WebSocketData } from "./types.js";
import type { UUID } from "crypto";
const migration = [
	"CREATE TABLE IF NOT EXISTS users (userid BLOB NOT NULL, accesstoken blob, PRIMARY KEY (userid));",
	"CREATE TABLE IF NOT EXISTS game (timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, id BLOB PRIMARY KEY NOT NULL, value TEXT NOT NULL, max_players INTEGER DEFAULT 2 NOT NULL, current_players INTEGER DEFAULT 0 NOT NULL, started BOOLEAN DEFAULT FALSE NOT NULL); ",
	"CREATE TABLE if not exists lobby_queue (player_id TEXT PRIMARY KEY, joined_at DATETIME DEFAULT CURRENT_TIMESTAMP);",
	"delete from lobby_queue"
]

export class DB {
	static db: Database
	static init(path: string = ":memory:") { this.db = new Database(path); for (const mig of migration) { this.db.query(mig).run() } }
}

export type USERID = UUID
export type ACCESSTOKEN = UUID
export type GAMEID = UUID

export const accesstokenSockets = new Map<ACCESSTOKEN, Bun.ServerWebSocket<WebSocketData>>()
export const userAccesstoken = new Map<USERID, ACCESSTOKEN>()


DB.init("../../db.sql")
