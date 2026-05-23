import type { GameSettings } from "../settings/settings.js";

export interface GameRoom {
	settings: GameSettings
}

export interface ISerailize<T> {
	serialize(): ArrayBuffer
	deserialize(data: ArrayBuffer): T
	importState(data: ArrayBuffer): void
}
