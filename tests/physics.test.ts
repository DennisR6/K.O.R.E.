import { test, describe } from "node:test";
import { defaultPhysics } from "../src/physics/defaultPhysics"
import assert from "node:assert";
import { Player } from "../src/entity/Player.js";
import { GameHandlerBuilder } from "../src/engine/Handler.js";
import { StructureRectangle } from "../src/structures/structureRectangle.js";
import { FRICTION_TABLE } from "../src/settings/settings.js";

/**
 * @test Physics Calculations & Vector Math
 * 
 * Diese Suite ist das mathematische Herzstück. Hier werden die atomaren 
 * Operationen validiert, auf denen alle Systeme (Bewegung, Kollision, KI) aufbauen.
 * 
 * Ein Fehler hier würde die gesamte Engine unvorhersehbar machen.
 */
describe("Physics Calculations", () => {
	const physics = new defaultPhysics()

	/**
		 * Vektor-Operationen (Addition, Subtraktion, Multiplikation).
		 * In der Spieleentwicklung nutzen wir Vektoren für Positionen und Kräfte.
		 * @example addition({x:1, y:2}, {x:3, y:4}) => {x:4, y:6}
		 */
	{
		test('Addition', () => {
			const a = { x: 1, y: 2 }
			const b = { x: 3, y: 4 }
			const result = physics.add(a, b)
			assert.deepStrictEqual(result, { x: 4, y: 6 })
		});

		test('Subtraction', () => {
			const a = { x: 10, y: 5 }
			const b = { x: 3, y: 2 }
			const result = physics.sub(a, b);
			assert.deepStrictEqual(result, { x: 7, y: 3 })
		});

		test('Multiplication (Scalar)', () => {
			const v = { x: 2, y: -3 }
			const result = physics.mult(v, 3)
			assert.deepStrictEqual(result, { x: 6, y: -9 })
		});
	}

	/**
		 * Dot Product (Skalarprodukt).
		 * Wichtig für Lichtberechnungen, Blickrichtungen oder um zu prüfen, 
		 * ob zwei Objekte in die gleiche Richtung schauen (Ergebnis > 0).
		 */
	test('Dot Product', () => {
		const a = { x: 1, y: 0 };
		const b = { x: 0, y: 1 };
		const result = physics.dot(a, b);

		assert.strictEqual(result, 0);
	});

	/**
		 * Distanz-Berechnung.
		 * Wir nutzen oft distSq (Quadratische Distanz), da Math.sqrt() teuer ist.
		 * Nur wenn es absolut nötig ist, ziehen wir die Wurzel für die echte Distanz.
		 */
	test('Distanz-Berechnung', () => {
		const p1 = { x: 10, y: 10 };
		const p2 = { x: 13, y: 14 };

		assert.strictEqual(physics.distSq(p1, p2), 25);
		assert.strictEqual(physics.dist(p1, p2), 5);
	});

	/**
		 * Clamp-Test (Begrenzung).
		 * Sorgt dafür, dass Werte innerhalb eines Bereichs bleiben (z.B. maximale Power).
		 * "Halte den Wert zwischen Min und Max."
		 */
	test('Clamp-Test', () => {
		{
			const result = physics.clamp(50, 100, 200)
			assert.strictEqual(result, 100)
		}
		{
			const result = physics.clamp(150, 100, 200)
			assert.strictEqual(result, 150)
		}
		{
			const result = physics.clamp(300, 100, 200)
			assert.strictEqual(result, 200)
		}
	})

	/**
		 * Collision-Circle Matrix.
		 * Der ultimative Test für die Kreiskollision.
		 * Formel: Ist der Abstand der Mittelpunkte kleiner oder gleich der Summe der Radien?
		 */
	test("Collision-Circle Matrix", () => {
		const SIZE = 60; // Radius
		const playersats = { x: 0, y: 0, size: SIZE };

		const p1 = new Player().new(playersats);
		const p2 = new Player().new(playersats);

		const testCases = [
			{ name: "Full Overlap", p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 }, expected: true },
			{ name: "Partial Right", p1: { x: 0, y: 0 }, p2: { x: 30, y: 0 }, expected: true },
			{ name: "Edge Touch", p1: { x: 0, y: 0 }, p2: { x: 120, y: 0 }, expected: true },
			{ name: "Just Outside", p1: { x: 0, y: 0 }, p2: { x: 120.1, y: 0 }, expected: false },
			{ name: "Diagonal In", p1: { x: 0, y: 0 }, p2: { x: 80, y: 80 }, expected: true }, // d ≈ 113
			{ name: "Diagonal Out", p1: { x: 0, y: 0 }, p2: { x: 90, y: 90 }, expected: false }, // d ≈ 127
			{ name: "Extreme Distance", p1: { x: 0, y: 0 }, p2: { x: 2299, y: 0 }, expected: false },

			{ name: "Edge Case", p1: { x: 100, y: 100 }, p2: { x: 150, y: 100 }, expected: true },
		];

		testCases.forEach(({ name, p1: pos1, p2: pos2, expected }) => {
			p1.setPos(pos1);
			p2.setPos(pos2);
			const result = physics.checkCollisionCircles(p1, p2);

			assert.strictEqual(
				result,
				expected,
				`FAILED: ${name} (Distance: ${Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y).toFixed(2)})`
			);
		});
	});


})

describe("Collisions", () => {
	const results = [
		{ x: 35.328794935141175, y: 24.237270466048578 },
		{ x: 24.970589710682113, y: 44.97058971068212 },
		{ x: 27.703072752261566, y: 47.70307275226156 },
		{ x: 28.570042450585344, y: 48.57004245058535 },
		{ x: 29.285397886932873, y: 49.28539788693288 },
		{ x: 29.660588745030456, y: 49.6605887450304629 },
		{ x: 30, y: 50 },
		{ x: 30, y: 50 },
		{ x: 30, y: 50 },
		{ x: 30, y: 50 },
	]

	Object.keys(FRICTION_TABLE).forEach((friction_setting, id) => {
		test(`perfect 45 degree collision check for ${id}:${friction_setting}`, () => {
			const h = new GameHandlerBuilder(1)
				//@ts-ignore
				.defaultSystems(FRICTION_TABLE[friction_setting])
				.addPlayer(new Player().new({ x: 30, y: 50, size: 10, id: "p1" }))
				.addStructure(new StructureRectangle(0, 0, 10, 100, ""))
			const handler = h.build().start()

			const sim = handler.simulateTurn("p1", 225, 1);
			handler.tickTurn(sim)
			for (let i = 0; i < sim.durationFrames; i++) handler.tick()
			const { x, y } = sim.finalState[0]
			const { x: pX, y: pY } = handler.getEntityManager().getEntities()[0].getPos()


			assert.equal(Math.abs(x - results[id].x) < 0.1, true, `x does not Match ${x} ${Math.abs(x - results[id].x)}`)
			assert.equal(Math.abs(y - results[id].y) < 0.1, true, `y does not Match ${y} ${Math.abs(y - results[id].y)}`)
			assert.equal(Math.abs(x - pX) < 0.1, true, `${x}/${pX}`)
			assert.equal(Math.abs(y - pY) < 0.1, true, `${y}/${pY}`)
		})
	});
})
