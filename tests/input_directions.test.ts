// import { describe, it } from "node:test";
// import { Player } from "../src/entity/Player.js";
// import { GameState } from "../src/engine/types.js";
// import assert from "node:assert";
// import { GameHandlerBuilder } from "../src/engine/Handler.js";
// import { Mouse } from "../src/ui/Mouse.js";
//
// /**
//  * @test Input Direction Compass
//  * 
//  * Dieser Test validiert die mathematische Abbildung von Maus-Interaktionen 
//  * auf physikalische Impulse (Vektorberechnung). 
//  * 
//  * Er stellt sicher, dass:
//  * 1. Der Winkel zwischen Startpunkt (Maus-Down) und Endpunkt (Maus-Move) korrekt berechnet wird.
//  * 2. Das "Schleuder-Prinzip" (Drag-to-Shoot) die richtige Richtung einschlägt.
//  * 3. Die Eingabe-Sperre (Turn-Check) zuverlässig funktioniert.
//  */
// describe("Input Direction Compass", () => {
// 	const handler =
// 		new GameHandlerBuilder()
// 			.defaultSystems()
// 			.addPlayer(new Player().new({ id: "7631c946-43a1-4c12-bf28-d5bd1d739c58", position: { x: 100, y: 100 }, size: 10, team: [0] }))
// 			.build()
//
// 	const mouseHandler = new Mouse()
// 	// mouseHandler.addTeam([1])
// 	// mouseHandler.setEntityManager(handler.getEntityManager())
// 	// mouseHandler.setPhysics(handler.getPhysics())
//
// 	handler.setMouseHandler(mouseHandler)
// 	handler.start()
// 	const testDirections = [
// 		{ name: "Rechts (0°)", mouse: { x: 150, y: 100 }, expected: 180 },
// 		{ name: "Unten (90°)", mouse: { x: 100, y: 150 }, expected: 270 },
// 		{ name: "Links (180°)", mouse: { x: 50, y: 100 }, expected: 0 },
// 		{ name: "Oben (270°)", mouse: { x: 100, y: 50 }, expected: 90 },
// 		{ name: "Unten-Rechts (45°)", mouse: { x: 150, y: 150 }, expected: 225 }
// 	];
//
// 	/**
// 		 * Iteriert über alle Richtungen und simuliert Maus-Events.
// 		 * 
// 		 * Der Flow:
// 		 * Pressed (Zentrum) -> Update (Ziel) -> getLocalInput (Berechnung) -> Released (Reset).
// 		 */
// 	testDirections.forEach(({ name, mouse, expected }) => {
// 		it(`sollte die Richtung korrekt berechnen: ${name}`, () => {
// 			let callcount = 0
// 			let output: { angle: number, power: number } = { angle: 0, power: 0 }
// 			handler.setState(GameState.YOUR_TURN)
// 			handler.setEmitter({
// 				sendShot: (_, angle, power) => {
// 					output = { angle, power };
// 					callcount++
// 				},
// 			})
// 			handler.handleMousePressed(100, 100);
// 			handler.updateMouse(mouse.x, mouse.y);
// 			handler.handleMouseReleased()
//
// 			assert.equal(output.angle, expected)
// 		});
// 	});
//
// 	/**
// 		 * Sicherheitstest: Zug-Kontrolle.
// 		 * 
// 		 * Stellt sicher, dass keine Impulse generiert werden können, wenn der 
// 		 * Gegner am Zug ist (Anti-Cheat / Logic-Gate Check).
// 		 */
// 	it("Spieler sollte außerhalb des Turns nicht draggbar sein", () => {
// 		handler.setState(GameState.OPPONENTS_TURN)
// 		handler.handleMousePressed(100, 100);
// 		handler.updateMouse(150, 150);
// 		handler.handleMouseReleased()
//
// 		const pos = handler.getEntityManager().getEntities()[0].getPos()
//
// 		assert(pos.x === 100, "Spieler ist draggbar")
// 		assert(pos.y === 100, "Spieler ist draggbar")
// 	})
// });
