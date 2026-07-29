import { GameHandler, GameHandlerBuilder } from "../engine/Handler.js";
import { GameState, type EngineSettings, type IInput, type TurnPacket } from "../engine/types.js";
import type { GameSettings } from "../settings/settings.js";

export type GameRecord = {
	id: string;
	handler: GameHandler;
	users: string[];
	teamByUser: Map<string, number>;
	currentTeam: number;
	turnNumber: number;
	resolving: boolean;
};

export type SubmitTurnResult =
	| { ok: true; record: GameRecord; packet: TurnPacket }
	| { ok: false; error: string };

/** In-memory authoritative match state. Persistence can replace this boundary later. */
export class GameRegistry {
	private games = new Map<string, GameRecord>();
	private gameByUser = new Map<string, string>();

	public create(settings: GameSettings, users: string[]): GameRecord {
		if (users.length < 2) throw new Error("A game requires at least two users")
		const id = crypto.randomUUID()
		const gameSettings: GameSettings = {
			...JSON.parse(JSON.stringify(settings)),
			id,
			allTeams: [...users],
			myTeam: [],
		}
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(gameSettings).build()
		const teamByUser = new Map(users.map((user, team) => [user, team]))
		const record: GameRecord = {
			id,
			handler,
			users: [...users],
			teamByUser,
			currentTeam: 0,
			turnNumber: 0,
			resolving: false,
		}
		this.games.set(id, record)
		users.forEach(user => this.gameByUser.set(user, id))
		return record
	}

	public get(gameId: string): GameRecord | undefined { return this.games.get(gameId) }
	public getForUser(userId: string): GameRecord | undefined {
		const gameId = this.gameByUser.get(userId)
		return gameId ? this.games.get(gameId) : undefined
	}

	public settingsForUser(record: GameRecord, userId: string): EngineSettings {
		const team = record.teamByUser.get(userId)
		if (team === undefined) throw new Error("User does not belong to this game")
		const settings = record.handler.toSettings()
		return {
			...settings,
			myTeam: [team],
			allTeams: [...record.users],
			turnNumber: record.turnNumber,
			state: team === record.currentTeam ? GameState.Your_turn : GameState.Opponents_turn,
		}
	}

	public submitTurn(userId: string, input: IInput): SubmitTurnResult {
		const record = this.getForUser(userId)
		if (!record) return { ok: false, error: "No active game for this user" }
		if (record.resolving) return { ok: false, error: "A turn is already resolving" }
		const team = record.teamByUser.get(userId)
		if (team === undefined || team !== record.currentTeam) return { ok: false, error: "It is not your turn" }
		if (!isValidInput(input)) return { ok: false, error: "Invalid shot input" }

		const actor = record.handler.getEntityManager().getEntityById(input.actorId)
		if (!actor || actor.isDead()) return { ok: false, error: "Actor is not active" }
		if (!actor.getTeam().includes(team)) return { ok: false, error: "Actor is not controlled by this user" }

		record.resolving = true
		try {
			const packet = record.handler.resolveTurn(input)
			record.turnNumber++
			record.currentTeam = (record.currentTeam + 1) % record.users.length
			record.handler.setTurnNumber(record.turnNumber)
			return { ok: true, record, packet }
		} finally {
			record.resolving = false
		}
	}
}

export function isValidInput(input: IInput): boolean {
	return typeof input.actorId === "string" && input.actorId.length > 0 &&
		Number.isFinite(input.angle) && input.angle >= 0 && input.angle < 360 &&
		Number.isFinite(input.power) && input.power > 0 && input.power <= 10
}
