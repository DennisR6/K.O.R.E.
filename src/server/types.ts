import type { GameHandler } from "../engine/Handler.js";

export interface GameRoom {
	handler: GameHandler;
	playerMap: Map<string, string>;
	currentTurnIndex: number;
	playerOrder: string[]; // Liste der socket.ids für die Reihenfolge
}
