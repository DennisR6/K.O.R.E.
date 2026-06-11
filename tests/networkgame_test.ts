import { expect, test } from "bun:test"
import { GameHandlerBuilder } from "../src/engine/Handler.ts"
import { type GameSettings } from "../src/settings/settings.ts"
test("testing right serialisation", () => {
	const GameSettings: GameSettings = {
		id: "8a67d1b0-5c76-4348-bc7a-012d8c9746cc",
		screenResolution: { x: 800, y: 450 },
		players: [
			{
				id: "98d47c91-fd22-4bcc-82f0-ac18363ea0a0",
				playericon: 0,
				position: {
					x: 123,
					y: 345
				},
				size: 456,
				team: [789],
				hoop: 10,
				color: "red"
			}
		],
		friction: { friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 },
		items: [],
		effects: [],
		minPlayers: 2,
		maxPlayers: 2,
		allTeams: ["1bafa3d2-b0e3-4e66-8c4f-e8da14278123", "5935f4b2-b3bd-4792-a356-fdf74f20ca2e"],
		allTeamSize: 2,
		myTeam: [1, 2, 3, 4, 5],
		mapBoundarys: [],
		// turn: 12,
		background: { type: "color", color: "blue" },
	}
	const handler = new GameHandlerBuilder(1).defaultSystems().fromSettings(GameSettings).build()
	expect(handler.getId()).toBe("8a67d1b0-5c76-4348-bc7a-012d8c9746cc")
	expect(handler.getTeam()[0]).toBe(1)
	expect(handler.getTeam()[1]).toBe(2)
	expect(handler.getTeam()[2]).toBe(3)
	expect(handler.getTeam()[3]).toBe(4)
	expect(handler.getTeam()[4]).toBe(5)
	expect(handler.getEntityManager().getEntities().length).toBe(1)
	expect(handler.getPhysics().getFriction()).toBe(0.995)
	expect(handler.getContext().currTurn).toBe(0)
	expect(handler.getContext().worldSize.x).toBe(800)
	expect(handler.getContext().worldSize.y).toBe(450)
})
