import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { ObjectEmitter } from "../src/emitter/ObjectEmitter.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { EmitterSystem } from "../src/systems/Emitter.ts";
import { UiSystem } from "../src/systems/UiSystem.ts";
import { GameState } from "../src/engine/types.ts";

test("clicks and pointer jitter do not create a shot", () => {
	const ui = new UiSystem()
	const emitter = new ObjectEmitter()
	const player = new Player(createPlayerSettings({ position: { x: 100, y: 100 } }))
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addPlayer(player)
		.addSystem(ui)
		.addUIMouse(ui)
		.addSystem(new EmitterSystem(emitter))
		.build()

	handler.updateMouse(100, 100)
	handler.handleMousePressed()
	handler.handleMouseReleased()
	handler.tick()
	expect(emitter.getLastShot()).toBeUndefined()
	expect(ui.start).toBeNull()
	expect(ui.end).toBeNull()

	handler.updateMouse(100, 100)
	handler.handleMousePressed()
	handler.updateMouse(105, 100)
	handler.handleMouseReleased()
	handler.tick()
	expect(emitter.getLastShot()).toBeUndefined()
})

test("a deliberate drag still creates one shot", () => {
	const ui = new UiSystem()
	const emitter = new ObjectEmitter()
	const player = new Player(createPlayerSettings({ position: { x: 100, y: 100 } }))
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addPlayer(player)
		.addSystem(ui)
		.addUIMouse(ui)
		.addSystem(new EmitterSystem(emitter))
		.build()

	handler.updateMouse(100, 100)
	handler.handleMousePressed()
	handler.updateMouse(120, 100)
	handler.handleMouseReleased()
	handler.tick()
	expect(emitter.getLastShot()).toEqual({ actorId: player.getId(), angle: 180, power: 2 })
})

test("a drag released outside the canvas still creates a shot", () => {
	const ui = new UiSystem()
	const emitter = new ObjectEmitter()
	const player = new Player(createPlayerSettings({ position: { x: 100, y: 100 } }))
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addPlayer(player)
		.addSystem(ui)
		.addUIMouse(ui)
		.addSystem(new EmitterSystem(emitter))
		.build()

	handler.updateMouse(100, 100)
	handler.handleMousePressed()
	handler.updateMouse(900, 100)
	handler.handleMouseReleased()
	handler.tick()

	expect(emitter.getLastShot()).toEqual({ actorId: player.getId(), angle: 180, power: 10 })
})

test("simulation and playback phases reject pointer input", () => {
	const ui = new UiSystem()
	const emitter = new ObjectEmitter()
	const player = new Player(createPlayerSettings({ position: { x: 100, y: 100 } }))
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addPlayer(player)
		.addSystem(ui)
		.addUIMouse(ui)
		.addSystem(new EmitterSystem(emitter))
		.build()

	for (const state of [GameState.Simulating, GameState.Playing]) {
		handler.setState(state)
		handler.updateMouse(100, 100)
		handler.handleMousePressed()
		handler.updateMouse(120, 100)
		handler.handleMouseReleased()
		handler.tick()
		expect(emitter.getLastShot()).toBeUndefined()
		expect(ui.start).toBeNull()
		expect(ui.end).toBeNull()
	}
})

test("a completed match remains terminal and rejects pointer input", () => {
	const ui = new UiSystem()
	const emitter = new ObjectEmitter()
	const handler = new GameHandlerBuilder().defaultSystems().addSystem(ui).addUIMouse(ui).addSystem(new EmitterSystem(emitter)).build()

	handler.setState(GameState.Game_over)
	handler.updateMouse(100, 100)
	handler.handleMousePressed()
	handler.handleMouseReleased()
	handler.tick()

	expect(handler.getState()).toBe(GameState.Game_over)
	expect(emitter.getLastShot()).toBeUndefined()
});
