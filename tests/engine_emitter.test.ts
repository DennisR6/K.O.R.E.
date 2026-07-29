import { expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import type { GameHandler } from "../src/engine/Handler.ts";
import { GameState, type TurnPacket } from "../src/engine/types.ts";

test("GameEmitter advances local hotseat turns through the rule interpreter", () => {
	let activeTeam = 0
	let turnNumber = 0
	let state: GameState | undefined
	const packet: TurnPacket = { actorId: "actor", input: { angle: 90, power: 5 }, durationFrames: 0, finalState: [] }
	const handler = {
		simulateTurn: (actorId: string, angle: number, power: number) => {
			expect({ actorId, angle, power }).toEqual({ actorId: "actor", angle: 90, power: 5 })
			return packet
		},
		playTurn: (_packet: TurnPacket, onComplete?: () => void) => onComplete?.(),
		setActiveTeam: (team: number) => { activeTeam = team },
		setTurnNumber: (turn: number) => { turnNumber = turn },
		setState: (nextState: GameState) => { state = nextState },
		getTeam: () => [0, 1],
		getActiveTeam: () => activeTeam,
		getTurnNumber: () => turnNumber,
	} as unknown as GameHandler

	new GameEmitter(handler).sendShot("actor", 90, 5)

	expect(activeTeam).toBe(1)
	expect(turnNumber).toBe(1)
	expect(state).toBe(GameState.Your_turn)
})
