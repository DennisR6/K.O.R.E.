import type { GameSettings } from "../settings/settings"
import type { NetworkGame } from "./types"

export function handleGame({ id: gameid }: NetworkGame): GameSettings | null {
	console.log("start joining game: ", gameid)
	// const game = getGame(gameid)
	// if (!game) return null
	// return { ...game }
	return null
}
