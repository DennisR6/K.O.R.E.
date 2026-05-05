import test, { beforeEach, describe, it } from "node:test"
import { GameState } from "../src/engine/types.ts"
import { Player } from "../src/entity/entity"
import { EntityManager } from "../src/entity/EntityManager.ts"
import { defaultPhysics } from "../src/physics/defaultPhysics"
import { PhysicsSystem, IGameContext } from "../src/systems/Systems.ts"
import assert from "node:assert"

/**
 * @test Input Direction Compass
 * 
 * Dieser Test validiert die mathematische Abbildung von Maus-Interaktionen auf Impulse.
 * Er prüft das "Slingshot"-Prinzip: Wenn der Spieler nach rechts zieht, muss der 
 * Impuls nach links gehen (Invertierung).
 * 
 * @example
 * Maus zieht auf 150,100 (Rechts) -> Erwarteter Winkel: 180° (Links)
 */
describe("PhysicsSystem Integration Tests", () => {
	let ctx: IGameContext
	beforeEach(() => {
		ctx = {
			state: GameState.PLAYING,
			entities: new EntityManager([]),
			structures: [],
		} as unknown as IGameContext;
	});

	/**
		 * Test: Zustands-Konsistenz & Bewegung.
		 * Prüft, ob ein Objekt mit Geschwindigkeit seine Position ändert UND 
		 * gleichzeitig durch Reibung langsamer wird.
		 */
	test('should maintain state consistency over multiple updates', () => {
		const ps = new PhysicsSystem(
			new defaultPhysics({
				friction: 0.9,
				linearDrag: 0.95,
				stopThreshold: 0.5,
			})
		);

		const p1 = new Player().new({ x: 100, y: 100, id: "p1", size: 20 });
		ctx.entities.addEntity(p1);
		p1.setVel({ x: 10, y: 10 });

		for (let i = 0; i < 32; i++) {
			ps.tick(ctx, 1, ps.strategy.getFriction());
		}

		assert.ok(p1.getPos().x > 100, 'Entity should have moved from starting position');
		assert.ok(p1.getVel().x < 10, 'Entity should have slowed down due to friction');
	});

	/**
		 * Test: Drift-Prävention.
		 * Einer der wichtigsten Stabilitätstests. Er stellt sicher, dass ein Objekt, 
		 * das stillstehen soll, sich auch nach 1000 Berechnungszyklen nicht bewegt.
		 * 
		 * Warum? Floating-Point-Fehler können dazu führen, dass 0.0000000001 aufsummiert 
		 * wird, bis das Objekt plötzlich "wandert".
		 */
	test('should not drift when velocity is zero', () => {
		const physics = new defaultPhysics();
		const ps = new PhysicsSystem(physics);
		const p1 = new Player().new({ x: 100, y: 100, id: "p1", size: 20 });

		p1.setVel({ x: 0, y: 0 });
		ctx.entities.addEntity(p1);

		for (let i = 0; i < 1000; i++) {
			ps.tick(ctx, 1, physics.getFriction());

			const posX = p1.getPos().x;
			const posY = p1.getPos().y;

			assert.ok(Math.abs(posX - 100) < 0.001, `Drift detected on X after ${i} ticks: ${posX}`);
			assert.ok(Math.abs(posY - 100) < 0.001, `Drift detected on Y after ${i} ticks: ${posY}`);
		}
	});

	/**
		 * Test: Stop-Threshold (Grenzwerterkennung).
		 * Verhindert das "unendliche Ausrollen". Wenn die Energie eines Objekts zu gering 
		 * ist, wird sie hart auf Null gesetzt.
		 */
	test('should stop the entity when speed falls below threshold', () => {
		const physics = new defaultPhysics({
			friction: 0,
			linearDrag: 0.8,
			stopThreshold: 0.5,
		});
		const ps = new PhysicsSystem(physics);
		const p1 = new Player().new({ x: 100, y: 100, id: "p1", size: 20 });

		p1.setVel({ x: 0.6, y: 0 });
		ctx.entities.addEntity(p1);

		ps.tick(ctx, 1, physics.getFriction());

		const velocity = p1.getVel();
		assert.strictEqual(velocity.x, 0, 'Velocity X should be zeroed after falling below threshold');
		assert.strictEqual(velocity.y, 0, 'Velocity Y should be zeroed after falling below threshold');
	});

	/**
	 * @test Kontinuierliche Reibung (Velocity Decay)
	 * 
	 * Dieser Test stellt sicher, dass die Reibung in JEDEM Frame angewendet wird.
	 * Er validiert, dass die Geschwindigkeit eine abnehmende Kurve beschreibt und 
	 * nicht linear oder sprunghaft abfällt.
	 * 
	 * Szenario:
	 * Ein Objekt startet mit hoher Geschwindigkeit. Über 9 aufeinanderfolgende Frames 
	 * muss die Geschwindigkeit in jedem einzelnen Schritt niedriger sein als im Frame zuvor.
	 */
	test('should reduce velocity magnitude every frame', () => {
		const physics = new defaultPhysics({
			friction: 0.9,
			linearDrag: 1,
			stopThreshold: 0.1,
		});
		const ps = new PhysicsSystem(physics);
		const p1 = new Player().new({ x: 100, y: 100, id: "p1" });
		p1.setVel({ x: 10, y: 10 });
		ctx.entities.addEntity(p1);

		for (let i = 0; i < 9; i++) {
			const lastVelX = p1.getVel().x;
			ps.tick(ctx, 1, 0.9);

			assert.ok(p1.getVel().x < lastVelX, `Speed did not decrease in frame ${i}`);
		}
	});

	/**
		 * @test
		 * Test: Referenz-Integrität.
		 * Prüft, ob das System wirklich mit den Original-Objekten arbeitet.
		 * In JavaScript/TypeScript ist es kritisch, dass wir keine Kopien verändern, 
		 * da sonst die UI nichts von den Physik-Updates mitbekommen würde.
		 */
	test('should maintain identical object references', () => {
		const physics = new defaultPhysics();
		const ps = new PhysicsSystem(physics);
		const p1 = new Player().new({ x: 100, y: 100, id: "p1" });

		ctx.entities.addEntity(p1);
		const entityInSystem = ctx.entities.getEntities()[0];

		assert.strictEqual(entityInSystem, p1, 'The entity reference in the system must be identical to the original object');

		entityInSystem.setVel({ x: 10, y: 10 });
		ps.tick(ctx, 1, 0.9);

		assert.ok(p1.getVel().x < 10, 'Updating the system should affect the local object reference');
	});
})
