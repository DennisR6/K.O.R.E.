import { Player } from "./Player.js";
import type { PlayerSettings } from "./types.js";

/**
 * Authoritative KORE runtime player factory.
 * Production code must construct runtime players only through this boundary.
 */
export function createRuntimePlayer(settings: PlayerSettings): Player {
	return new Player(settings);
}
