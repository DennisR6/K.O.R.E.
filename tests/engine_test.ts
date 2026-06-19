import { expect, test, describe } from "bun:test";
import { Player } from "../src/entity/Player.ts";
import { EffectMove } from "../src/effects/movement.ts";
import { EffectTrigger } from "../src/effects/types.ts";
import { EffectPhysics } from "../src/effects/physics.ts"
import { EngineSettings, GameState } from "../src/engine/types.ts";
import { FRICTION_TABLE, GameSettings } from "../src/settings/settings.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts"
import { ObjectEmitter } from "../src/emitter/ObjectEmitter.ts"
import { EmitterSystem } from "../src/systems/Emitter.ts"
import { UiSystem } from "../src/systems/UiSystem.ts";
import { EffectModifyMass } from "../src/effects/modifyMass.ts";
import { EffectModifySize } from "../src/effects/modifySize.ts";
import { EffectModifyPosition } from "../src/effects/modifyPosition.ts";
import { EffectModifyTeam } from "../src/effects/modifyTeam.ts";


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
	expect(gameSettingsString.length).toBeGreaterThan(6000)
})


describe("Hallo Welt", () => {
	const arr = [
		[1, 10],
		[10, 10],
		[20, 10],
	]
	test.each(arr)("simulation", sim)
})


function sim(angle: number, power: number) {
	const gameSettings = `{"state":"GameState.Your_turn","background":{"color":"white","type":"color"},"friction":{"friction":0.995,"linearDrag":0.01,"stopThreshold":0.1},"id":"765b1425-999b-4870-835c-1c6cd073673d","mapBoundarys":[],"screenResolution":{"x":0,"y":0},"myTeam":[],"allTeams":[],"effects":[],"items":[],"players":[{"id":"c6bdac35-b6fa-4635-a918-45f5db583b63","position":{"x":0,"y":0},"velocity":{"x":0,"y":0},"playericon":27,"team":[],"hoop":17,"color":"red","size":20,"hp":30,"bouncyness":1,"mass":1,"shape":0,"isPhysicsEnabled":true,"isDead":false,"effects":[{"type":"EffectType.Movement","typeValue":{"deltaTime":0,"x":0,"y":0},"trigger":"EffectTrigger.Always","triggerValue":[]},{"type":"EffectType.Physics","typeValue":{"friction":0.995,"linearDrag":0.01,"stopThreshold":0.1},"trigger":"EffectTrigger.Always","triggerValue":[]}]}],"minPlayers":0,"maxPlayers":0,"allTeamSize":2,"turnNumber":0}`

	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(JSON.parse(gameSettings)).build()
	const sim = handler.simulateTurn("c6bdac35-b6fa-4635-a918-45f5db583b63", angle, power)
	handler.tickTurn(sim)

	for (let i = 0; i < sim.durationFrames; i++) handler.tick()
	const result = handler.getEntityManager().getEntities()[0].getPos()
	const simulationresult = sim.finalState[0].position
	expect(result.x).toBe(simulationresult.x)
	expect(result.y).toBe(simulationresult.y)
}

test("234", () => {
	const gameSettings = `{"state":"GameState.Your_turn","background":{"color":"white","type":"color"},"friction":{"friction":0.995,"linearDrag":0.01,"stopThreshold":0.1},"id":"765b1425-999b-4870-835c-1c6cd073673d","mapBoundarys":[],"screenResolution":{"x":0,"y":0},"myTeam":[],"allTeams":[],"effects":[],"items":[],"players":[{"id":"c6bdac35-b6fa-4635-a918-45f5db583b63","position":{"x":50,"y":50},"velocity":{"x":0,"y":0},"playericon":27,"team":[],"hoop":17,"color":"red","size":20,"hp":30,"bouncyness":1,"mass":1,"shape":0,"isPhysicsEnabled":true,"isDead":false,"effects":[{"type":"EffectType.Movement","typeValue":{"deltaTime":0,"x":0,"y":0},"trigger":"EffectTrigger.Always","triggerValue":[]},{"type":"EffectType.Physics","typeValue":{"friction":0.995,"linearDrag":0.01,"stopThreshold":0.1},"trigger":"EffectTrigger.Always","triggerValue":[]}]}],"minPlayers":0,"maxPlayers":0,"allTeamSize":2,"turnNumber":0}`

	const em = new ObjectEmitter()
	const ui = new UiSystem()
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(ui)
		.addUIMouse(ui)
		.addSystem(new EmitterSystem(em))
		.fromSettings(JSON.parse(gameSettings))
		.build()
	const p1 = handler.getEntityManager().getEntities()[0]
	{
		handler.updateMouse(50, 50)
		handler.handleMousePressed()
		handler.updateMouse(70, 50)
		handler.handleMouseReleased()
		handler.tick()
	}

	expect(em.getLastShot()).not.toBeUndefined()

	const { actorId, angle, power } = em.getLastShot()!
	const sim = handler.simulateTurn(actorId, angle, power)
	handler.tickTurn(sim)
	for (let frames = 0; frames <= sim.durationFrames; frames++) handler.tick()
	expect(p1.getPos().x).toBeCloseTo(-73, 0)
	expect(p1.getPos().y).toBe(50)
})

describe("testing various effects", () => {



	test("engine - modify mass & size (Type-Guard Check)", () => {
		const player = new Player().new({ position: { x: 10, y: 10 } });

		// 1. Teste Masse-Modifikation (setMass limitiert intern auf maximal 1 via Math.min)
		const massEff = new EffectModifyMass({ typeValue: { mass: 0.5 } });
		massEff.apply(player);
		expect(player.getMass()).toBe(0.5);

		// 2. Teste Größen-Modifikation via Type-Guard
		expect(player.getSize().x).toBe(20); // Standardgröße aus Konstruktor
		const sizeEff = new EffectModifySize({ typeValue: { size: 35 } });
		sizeEff.apply(player);
		expect(player.getSize().x).toBe(35); // Player-Radius wurde erfolgreich modifiziert
	});

	test("engine - modify mass & size (Type-Guard Check)", () => {
		const player = new Player().new({ position: { x: 10, y: 10 } });

		// 1. Teste Masse-Modifikation (setMass limitiert intern auf maximal 1 via Math.min)
		const massEff = new EffectModifyMass({ typeValue: { mass: 0.5 } });
		massEff.apply(player);
		expect(player.getMass()).toBe(0.5);

		// 2. Teste Größen-Modifikation via Type-Guard
		expect(player.getSize().x).toBe(20); // Standardgröße aus Konstruktor
		const sizeEff = new EffectModifySize({ typeValue: { size: 35 } });
		sizeEff.apply(player);
		expect(player.getSize().x).toBe(35); // Player-Radius wurde erfolgreich modifiziert
	});

	test("engine - modify position (setPos Vector2D)", () => {
		const player = new Player().new({ position: { x: 50, y: 50 } });

		// Erstelle Teleportation-Effekt zu neuen X/Y Koordinaten
		const posEff = new EffectModifyPosition({ typeValue: { x: 500, y: 250 } });
		posEff.apply(player);

		// setPos verarbeitet das intern als Vector2D
		expect(player.getPos().x).toBe(500);
		expect(player.getPos().y).toBe(250);
	});

	test("engine - modify team (Array Check)", () => {
		const player = new Player().new({ position: { x: 0, y: 0 }, team: [1] });
		expect(player.getTeam()).toEqual([1]); // Start-Team

		// Effekt zünden, um das Team auf ID [2] zu wechseln
		const teamEff = new EffectModifyTeam({ typeValue: { team: [2] } });
		teamEff.apply(player);

		expect(player.getTeam()).toEqual([2]);
	});

})
