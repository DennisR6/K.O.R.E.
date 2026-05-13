import { test, describe } from "node:test";
import { defaultPhysics } from "../src/physics/defaultPhysics"
import assert from "node:assert";
import { Player } from "../src/entity/player.ts";

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

	// WORK IN PROGRESS
	// test("Collision-Rectangle Matrix", () => {
	// 	const w = 50;
	// 	const h = 50;
	//
	// 	const testCases = [
	// 		{ name: "Full Overlap", r1: { x: 0, y: 0 } as StructureRectangle, r2: { x: 0, y: 0 }, expected: true },
	// 		{ name: "Partial Overlap Right", r1: { x: 0, y: 0 }, r2: { x: 25, y: 0 }, expected: true },
	// 		{ name: "Edge Touch Right", r1: { x: 0, y: 0 }, r2: { x: 50, y: 0 }, expected: true },
	// 		{ name: "Just Outside Right", r1: { x: 0, y: 0 }, r2: { x: 50.1, y: 0 }, expected: false },
	// 		{ name: "Diagonal Gap", r1: { x: 0, y: 0 }, r2: { x: 51, y: 51 }, expected: false },
	// 		{ name: "Top Touch", r1: { x: 0, y: 0 }, r2: { x: 0, y: -50 }, expected: true },
	// 		{ name: "Inside (Smaller)", r1: { x: 0, y: 0 }, r2: { x: 10, y: 10 }, expected: true }
	// 	];
	//
	// 	testCases.forEach(({ name, r1, r2, expected }) => {
	// 		const result = physics.checkCollisionRects(r1, r2);
	// 		assert.strictEqual(result, expected, `Failed Rect: ${name}`);
	// 	});
	// });

	// 	checkCollisionCircleRect(circlePos: Vector2D, r: number, rectPos: Vector2D, w: number, h: number): boolean;
})
