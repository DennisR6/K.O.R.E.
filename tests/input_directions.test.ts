import { describe, it } from "node:test";
import assert from "node:assert";
import { createTestHandler } from "../src/engine/Handler.ts";
import { Player } from "../src/entity/player.ts";
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";
import { EntityManager } from "../src/entity/EntityManager.ts";
import { GameState } from "../src/engine/types.ts";

/**
 * @test Input Direction Compass
 * 
 * Dieser Test validiert die mathematische Abbildung von Maus-Interaktionen 
 * auf physikalische Impulse (Vektorberechnung). 
 * 
 * Er stellt sicher, dass:
 * 1. Der Winkel zwischen Startpunkt (Maus-Down) und Endpunkt (Maus-Move) korrekt berechnet wird.
 * 2. Das "Schleuder-Prinzip" (Drag-to-Shoot) die richtige Richtung einschlägt.
 * 3. Die Eingabe-Sperre (Turn-Check) zuverlässig funktioniert.
 */
describe("Input Direction Compass", () => {
	const strategy = new defaultPhysics();
	const mockPlayer = new Player().new({ id: "p1", x: 100, y: 100, size: 10 });
	const manager = new EntityManager([mockPlayer]);
	const handler = createTestHandler({ entityManager: manager, physicsStrategy: strategy })

	const testDirections = [
		{ name: "Rechts (0°)", mouse: { x: 150, y: 100 }, expected: 180 },
		{ name: "Unten (90°)", mouse: { x: 100, y: 150 }, expected: 270 },
		{ name: "Links (180°)", mouse: { x: 50, y: 100 }, expected: 0 },
		{ name: "Oben (270°)", mouse: { x: 100, y: 50 }, expected: 90 },
		{ name: "Unten-Rechts (45°)", mouse: { x: 150, y: 150 }, expected: 225 }
	];

	/**
		 * Iteriert über alle Richtungen und simuliert Maus-Events.
		 * 
		 * Der Flow:
		 * Pressed (Zentrum) -> Update (Ziel) -> getLocalInput (Berechnung) -> Released (Reset).
		 */
	testDirections.forEach(({ name, mouse, expected }) => {
		it(`sollte die Richtung korrekt berechnen: ${name}`, () => {
			handler.setState(GameState.YOUR_TURN)
			handler.handleMousePressed(100, 100);
			handler.updateMouse(mouse.x, mouse.y);
			const input = handler.getLocalInput();
			handler.handleMouseReleased()

			assert.ok(input, "Input sollte nicht null sein");

			const diff = Math.abs(input.angle - expected);
			const normalizedDiff = diff > 180 ? 360 - diff : diff;

			assert.strictEqual(
				normalizedDiff < 0.1,
				true,
				`${name} fehlgeschlagen: Erwartet ca. ${expected}°, aber bekam ${input.angle.toFixed(2)}°`
			);
		});
	});

	/**
		 * Sicherheitstest: Zug-Kontrolle.
		 * 
		 * Stellt sicher, dass keine Impulse generiert werden können, wenn der 
		 * Gegner am Zug ist (Anti-Cheat / Logic-Gate Check).
		 */
	it("Spieler sollte außerhalb des Turns nicht draggbar sein", () => {
		handler.setState(GameState.OPPONENTS_TURN)
		handler.handleMousePressed(100, 100);
		handler.updateMouse(150, 150);
		const input = handler.getLocalInput();
		handler.handleMouseReleased()
		assert(input === null, "Spieler ist draggbar")
	})
});
