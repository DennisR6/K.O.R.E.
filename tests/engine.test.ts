import { expect, test } from "bun:test";
import { Player } from "../src/entity/Player.ts";
import { EffectMove } from "../src/effects/movement.ts";
import { EffectTrigger } from "../src/effects/types.ts";
import { EffectPhysics } from "../src/effects/physics.ts"
import { EngineSettings, GameState } from "../src/engine/types.ts";
import { FRICTION_TABLE, GameSettings } from "../src/settings/settings.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts"

test("engine", () => {
	const sett: EngineSettings = {
		state: GameState.Your_turn,
		id: "be1c4061-c56c-4f58-83db-e0dcfcdfdf93",
		background: { color: "white", type: "color" },
		friction: { friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 },
		mapBoundarys: [], screenResolution: { x: 0, y: 0 },
		myTeam: [], allTeams: [], effects: [], items: [],
		players: [new Player().new({ position: { x: 20, y: 20 }, effects: [], }).toSettings()],
		minPlayers: 0, maxPlayers: 2, allTeamSize: 2, turnNumber: 0
	}
	const handler = new GameHandlerBuilder
		()
		.defaultSystems()
		.fromSettings(sett)
		.build()

	const player1 = handler.getEntityManager().getEntities()[0] as unknown as Player
	const eff = new EffectMove({ typeValue: { deltaTime: 0, x: 0, y: 0 } })
	player1.addEffect(EffectTrigger.Always, eff)
	player1.setVel({ x: 10, y: 20 })
	handler.tick(1)
	expect(player1.getPos().x).toBe(30)
	expect(player1.getPos().y).toBe(40)
	handler.tick(2)
	expect(player1.getPos().x).toBe(50)
	expect(player1.getPos().y).toBe(80)
	handler.tick(1)
	expect(player1.getPos().x).toBe(60)
	expect(player1.getPos().y).toBe(100)
	handler.tick(1)
	expect(player1.getPos().x).toBe(70)
	expect(player1.getPos().y).toBe(120)
})



test("engine 2", () => {
	const friction = FRICTION_TABLE.ice
	const eff = new EffectMove({ typeValue: { deltaTime: 0, x: 0, y: 0 } }).toSettings()
	const phys = new EffectPhysics({ typeValue: friction }).toSettings()
	const p1 = new Player().new({
		position: { x: 0, y: 0 },
		effects: [
			{ trigger: EffectTrigger.Always, triggerValue: [], ...eff },
			{ trigger: EffectTrigger.Always, triggerValue: [], ...phys },
		]
	})

	p1.setVel({ x: 10, y: 10 })
	p1.tick(1, friction.friction)
	const { x, y } = p1.getVel()

	expect(x).toBeCloseTo(9.94)
	expect(y).toBeCloseTo(9.94)
})



test("engine serialisizing", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(GameSettings).build().toSettings()
	const gameSettingsString = JSON.stringify(handler)
	expect(gameSettingsString.length).toBeGreaterThan(6700)
	console.log(JSON.stringify(GameSettings).length)
	// console.log(gameSettingsString)
})


test("engine 4", () => {
	const p1 = new Player().new({
		id: "c6bdac35-b6fa-4635-a918-45f5db583b63",
		position: { x: 0, y: 0 },
		effects: [
			{
				trigger: EffectTrigger.Always,
				triggerValue: [],
				...new EffectMove({ typeValue: { deltaTime: 0, x: 0, y: 0 } }).toSettings()
			},
			{
				trigger: EffectTrigger.Always,
				triggerValue: [],
				...new EffectPhysics({ typeValue: FRICTION_TABLE.ice }).toSettings()
			},

		]
	})
	p1.setVel({ x: 0, y: 10 })
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addPlayer(p1)
		.build()

	let frames = 0
	for (; frames < 12000 && !handler.getPhysics().isStatic(handler.getEntityManager()); frames++) handler.tick(1)
	const sim = handler.simulateTurn("c6bdac35-b6fa-4635-a918-45f5db583b63", 0, 10)
	expect(sim.durationFrames).toBe(frames)
})

