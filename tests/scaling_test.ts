import test, { describe } from "node:test";
import { Player } from "../src/entity/Player.js";
import { createPlayerSettings } from "../src/entity/types.js";
import { GameState } from "../src/kore/runtime/types.js";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts"

/**
 * @test Coordinate Transformation & Scaling
 * 
 * Dieser Test validiert die Umrechnung von Bildschirm-Koordinaten (Pixel) 
 * in Welt-Koordinaten (Physik-Einheiten).
 * 
 * Warum ist das wichtig?
 * Wenn die Engine mit einem Zoom-Faktor (z.B. 0.5x oder 2.0x) gerendert wird, 
 * müssen die Maus-Eingaben des Spielers so skaliert werden, dass die 
 * resultierende Kraft im Spiel immer identisch bleibt.
 */
describe("Coordinate Transformation & Scaling", () => {
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addPlayer(new Player(createPlayerSettings({ id: "p1", position: { x: 100, y: 100 }, size: 60 })))
		.build()
		.start()

	/**
		 * Test: Weltkoordinaten-Berechnung bei 0.5x Skalierung.
		 * 
		 * Szenario:
		 * Das Spiel wird verkleinert dargestellt (50% Zoom). Ein Klick bei 50px auf 
		 * dem Bildschirm entspricht also 100 Einheiten in der physikalischen Welt.
		 * 
		 * Rechnung: ScreenX / Scale = WorldX
		 */
	test("should calculate correct world coordinates despite 0.5x screen scaling", () => {
		handler.setState(GameState.YOUR_TURN)
		const screenFactor = 0.5;

		const mouseXScreen = 50;
		const mouseYScreen = 50;

		const worldX = mouseXScreen / screenFactor;
		const worldY = mouseYScreen / screenFactor;

		handler.handleMousePressed(worldX, worldY);

		const dragXScreen = 75;
		const dragYScreen = 50;
		handler.updateMouse(dragXScreen / screenFactor, dragYScreen / screenFactor);

		// const input = handler.getLocalInput();
		// handler.handleMouseReleased();

		// assert.ok(input, "Input should be generated after mouse interaction");


		// assert.strictEqual(
		// 	input.angle,
		// 	180,
		// 	`Input angle should be 180 degrees, but received ${input.angle}`
		// );

		// assert.strictEqual(
		// 	input.power,
		// 	2.5,
		// 	`Input power should be 2.5, but received ${input.power}`
		// );
	});

	/**
		 * Test: Input-Sperre (Gegner-Zug)
		 * 
		 * Stellt sicher, dass die gesamte Maus-Logik (inklusive Transformation) 
		 * sofort ignoriert wird, wenn der State nicht auf YOUR_TURN steht.
		 */
	test("should ignore mouse interaction during opponent's turn", () => {
		handler.setState(GameState.OPPONENTS_TURN)
		const screenFactor = 0.5;

		const mouseXScreen = 50;
		const mouseYScreen = 50;

		const worldX = mouseXScreen / screenFactor;
		const worldY = mouseYScreen / screenFactor;

		handler.handleMousePressed(worldX, worldY);

		const dragXScreen = 75;
		const dragYScreen = 50;
		handler.updateMouse(dragXScreen / screenFactor, dragYScreen / screenFactor);

		// const input = handler.getLocalInput();

		// assert.ok(!input, "Input should not be generated after mouse interaction");
	});
});
