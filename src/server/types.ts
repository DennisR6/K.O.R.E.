import type { UUID } from "crypto"
import type { EngineSettings, IInput, TurnPacket } from "../engine/types.js"
import type { MatchResult, RuleState } from "../rules/types.js"
import type { ItemTarget } from "../item/target.js"

/**
 * Server lifecycle state is deliberately separate from a rules `MatchStatus`.
 * It describes durable residency/availability, not whether the engine winner
 * is a draw or a team.
 */
export type AuthoritativeMatchStatus = "resident" | "paused" | "sleeping" | "completed";

export type PersistedMatchLifecycle = {
	version: 1;
	status: AuthoritativeMatchStatus;
	/** Null only for rows migrated from the legacy games table. */
	createdAt: number | null;
	statusChangedAt: number;
	completedAt: number | null;
};

export type MapUsageMetric = { mapId: string; games: number; percentage: number };
export type OfflineModeMetric = { mode: "hotseat" | "human-vs-ai" | "ai-battle"; games: number };

/** Aggregate dashboard facts. `now` is a point-in-time registry-cache count. */
export type MatchMetrics = {
	allTime: number;
	/** Completed offline, hotseat, and AI matches reported by the production clients. */
	offlineMatches: number;
	offlineModes: OfflineModeMetric[];
	/** Distinct durable player identities across every stored match. */
	playersAllTime: number;
	/** Distinct players whose match lifecycle is anything except sleeping. */
	playersOnline: number;
	now: number;
	paused: number;
	sleeping: number;
	/** All durable matches grouped by their immutable/canonical map ID. */
	mapUsage: MapUsageMetric[];
	mostPlayedMap: MapUsageMetric | null;
	measuredAt: number;
	consistency: "now is scoped to this server process's resident registry cache";
};

export const enum NetworkMessageType {
	PING = "PING",
	PONG = "PONG",
	INIT = "INIT",
	GAME = "GAME",
	SHOOT = "SHOOT",
	LOGIN = "LOGIN",
	NEWUSER = "NEWUSER",
	WAITINGROOM = "WAITINGROOM",
	TURN = "TURN",
	ERROR = "ERROR",
	REMATCH = "REMATCH",
	USE_ITEM = "USE_ITEM",
	ITEM_USED = "ITEM_USED",
	SKIP_PHASE = "SKIP_PHASE",
	PHASE_CHANGED = "PHASE_CHANGED",
	REPORT_MATCH = "REPORT_MATCH",
	REPORT_SUBMITTED = "REPORT_SUBMITTED",
	PAUSE_REQUEST = "PAUSE_REQUEST",
	PAUSE_STATE = "PAUSE_STATE",
	CREATE_REPLAY_SHARE = "CREATE_REPLAY_SHARE",
	REPLAY_SHARE_CREATED = "REPLAY_SHARE_CREATED",
	LEAVE_GAME = "LEAVE_GAME",
	SURRENDER_GAME = "SURRENDER_GAME",
	SURRENDERED = "SURRENDERED",
	GAME_ENDED = "GAME_ENDED",
}

export function getNetworkPacketType(input: NetworkMessageType): string {
	switch (input) {
		case NetworkMessageType.PING: return "Ping"
		case NetworkMessageType.PONG: return "Pong"
		case NetworkMessageType.INIT: return "Init"
		case NetworkMessageType.GAME: return "Game"
		case NetworkMessageType.SHOOT: return "Shoot"
		case NetworkMessageType.LOGIN: return "Login"
		case NetworkMessageType.WAITINGROOM: return "Waitingroom"
		case NetworkMessageType.TURN: return "Turn"
		case NetworkMessageType.ERROR: return "Error"
		case NetworkMessageType.NEWUSER: return "New User"
		case NetworkMessageType.USE_ITEM: return "Use Item"
		case NetworkMessageType.ITEM_USED: return "Item Used"
		default: return `NetworkMessageType: ${input}`
	}

}
export type UnTypedNetworkMessage =
	NetworkPing |
	NetworkPong |
	NetworkInit |
	NetworkShoot |
	NetworkLogin |
	NetworkGame |
	NetworkWaitingRoom |
	NetworkTurn |
	NetworkNewUser |
	NetworkError
	| NetworkRematch
	| NetworkUseItem
	| NetworkItemUsed
	| NetworkSkipPhase
	| NetworkPhaseChanged
	| NetworkReportMatch
	| NetworkReportSubmitted
	| NetworkPauseRequest
	| NetworkPauseState
	| NetworkCreateReplayShare
	| NetworkReplayShareCreated
	| NetworkLeaveGame
	| NetworkSurrenderGame
	| NetworkSurrendered
	| NetworkGameEnded

export interface NetworkPing { type: NetworkMessageType.PING }
export interface NetworkPong { type: NetworkMessageType.PONG }
export interface NetworkInit { type: NetworkMessageType.INIT, settings: EngineSettings, ruleState: RuleState, gameId?: string, mapId?: string, modeId?: string }
export interface NetworkShoot extends IInput {
	type: NetworkMessageType.SHOOT
}
export interface NetworkLogin {
	type: NetworkMessageType.LOGIN,
	userid: UUID | undefined,
	mapPreference?: string,
	modePreference?: string,
}
export interface NetworkGame {
	type: NetworkMessageType.GAME,
	id: UUID
}
export interface NetworkWaitingRoom { type: NetworkMessageType.WAITINGROOM }
export interface NetworkTurn {
	type: NetworkMessageType.TURN,
	sim: TurnPacket,
	turnNumber: number,
	activeTeam: number,
	ruleState: RuleState,
	gameOver?: boolean,
}
export interface NetworkError {
	type: NetworkMessageType.ERROR,
	message: string
}
export interface NetworkRematch { type: NetworkMessageType.REMATCH }
export interface NetworkUseItem {
	type: NetworkMessageType.USE_ITEM,
	actorId: string,
	itemId: string,
	target: ItemTarget,
}
export interface NetworkItemUsed {
	type: NetworkMessageType.ITEM_USED,
	actorId: string,
	itemId: string,
	target: ItemTarget,
	ruleState: RuleState,
	players: EngineSettings["players"],
}
export interface NetworkSkipPhase { type: NetworkMessageType.SKIP_PHASE }
export interface NetworkPhaseChanged { type: NetworkMessageType.PHASE_CHANGED, ruleState: RuleState }
export interface NetworkReportMatch { type: NetworkMessageType.REPORT_MATCH, category: "conduct" | "technical" | "other", text: string }
export interface NetworkReportSubmitted { type: NetworkMessageType.REPORT_SUBMITTED, reportId: string }
export interface NetworkPauseRequest { type: NetworkMessageType.PAUSE_REQUEST, action: "pause" | "resume" }
export interface NetworkPauseState { type: NetworkMessageType.PAUSE_STATE, paused: boolean, waitingForOtherPlayer: boolean }
export interface NetworkCreateReplayShare { type: NetworkMessageType.CREATE_REPLAY_SHARE }
export interface NetworkReplayShareCreated { type: NetworkMessageType.REPLAY_SHARE_CREATED, token: string }
/** Explicitly abandons the current match instead of preserving it for reconnect. */
export interface NetworkLeaveGame { type: NetworkMessageType.LEAVE_GAME }
export interface NetworkSurrenderGame { type: NetworkMessageType.SURRENDER_GAME }
export interface NetworkSurrendered { type: NetworkMessageType.SURRENDERED, result: MatchResult }
/** Sent to every connected participant when a player abandons a match. */
export interface NetworkGameEnded { type: NetworkMessageType.GAME_ENDED, reason: string, result?: MatchResult }
export interface NetworkNewUser { type: NetworkMessageType.NEWUSER, userid: UUID }
export interface WebSocketData { connectionId: UUID }
