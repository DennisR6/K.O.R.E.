import { GameHandlerBuilder } from "../src/kore/runtime/Handler.js";
import { describe, expect, test } from "bun:test";
import { GameSettings } from "../src/settings/settings";
import { GameState } from "../src/kore/runtime/types.js";
import { UiSystem } from "../src/systems/UiSystem.js";



describe("how to create a new Engine", () => {
	const uisystem = new UiSystem()
	const bob = new GameHandlerBuilder()
		.defaultSystems()
		.fromSettings(GameSettings)
		.addSystem(uisystem)
		.addUIMouse(uisystem)
	const handler = bob.build()
	test("hier kommt dann dein test rein", () => expect(handler.getContext().state).toBe(GameState.Your_turn))
	test("", () => {
		handler.setState(GameState.Opponents_turn)

		handler.updateMouse(132, 132)
		handler.handleMousePressed()
		handler.updateMouse(100, 132)
		handler.handleMouseReleased()


	})

})
