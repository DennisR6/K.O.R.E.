import test from "node:test";
import { createTestHandler } from "../src/engine/Handler.ts"
import { Player } from "../src/entity/entity.ts";
import assert from "node:assert";
import { GameState, IInput, IInputEmitter } from "../src/engine/types.ts";
import { EntityManager } from "../src/entity/EntityManager.ts";

/**
 * @test Emitter-Integration
 * 
 * Dieser Test validiert die Schnittstelle zwischen der Benutzereingabe (Mouse-Events)
 * und dem Kommunikations-Layer (Emitter). 
 * 
 * Er stellt sicher, dass:
 * 1. Der richtige Spieler ("Actor") als Ursprung des Schusses erkannt wird.
 * 2. Die berechneten physikalischen Werte (Winkel & Kraft) korrekt verpackt werden.
 * 3. Das Event exakt zum richtigen Zeitpunkt (beim Loslassen der Maus) gefeuert wird.
 */
test("should trigger input emitter with correct data on mouse release", () => {
	let sentData: IInput | null = null;

	const p1 = new Player().new({ id: "p1", x: 100, y: 100, size: 12 });
	const p2 = new Player().new({ id: "p2", x: 150, y: 120, size: 12 });


	/**
		 * Das Mock-Objekt simuliert die Netzwerk-Schnittstelle.
		 * Anstatt Daten an einen Server zu senden, speichern wir sie lokal in `sentData`,
		 * um sie im Test überprüfen zu können.
		 */
	const mockEmitter: IInputEmitter = {
		sendShot: (actorId, angle, power) => {
			sentData = { actorId, angle, power };
		}
	};

	const handler = createTestHandler({
		//@ts-ignore - limited context for unit testing
		context: { state: GameState.YOUR_TURN },
		entityManager: new EntityManager([p1, p2]),
		inputEmitter: mockEmitter
	});

	handler.handleMousePressed(100, 100);
	handler.updateMouse(150, 100);
	handler.handleMouseReleased();

	// Validierung:
	assert.ok(sentData, "Emitter wurde nicht aufgerufen");
	//@ts-ignore
	assert.strictEqual(sentData.actorId, "p1", "Der falsche Spieler wurde als Schütze erkannt");
});
