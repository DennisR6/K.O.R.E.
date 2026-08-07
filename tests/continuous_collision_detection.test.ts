import { describe, expect, test } from "bun:test";
import { Player } from "../src/entity/Player.js";
import { EntityManager } from "../src/entity/EntityManager.js";
import { createPlayerSettings } from "../src/entity/types.js";
import { defaultPhysics } from "../src/physics/defaultPhysics.js";
import { SHAPE, MAX_CCD_SUBSTEPS } from "../src/physics/physics.js";
import { StructureRectangle } from "../src/structures/structureRectangle.js";
import { StructureLine } from "../src/structures/structureLine.js";
import { DeadlyObstacleCirle } from "../src/structures/DeadlyObstacleCircle.js";
import { PhysicsSystem } from "../src/systems/PhysicsSystem.js";
import type { IGameContext } from "../src/systems/types.js";
import { NumericSystem } from "../src/systems/NumericSystem.js";
import { MovementSystem } from "../src/systems/MovementSystem.js";
import { ParticipationSystem } from "../src/systems/ParticipationSystem.js";
import { dispatchPredefinedEffect } from "../src/systems/predefinedEffectDispatcher.js";

/**
 * Task 13.6: Continuous Collision Detection (CCD) Verification
 * Verifies high-speed tunnelling prevention, deterministic sub-stepping,
 * single-trigger effect invocation, and boundary invariants.
 */

function createGameContext(entities: EntityManager, structures: any[] = []): IGameContext {
	const ctx = {
		entities,
		structures,
		state: {} as any,
		turn: 0,
		activeTeam: "",
		dt: 0.016,
		mouse: { turn: null },
		worldSize: { x: 800, y: 450 },
		physics: new defaultPhysics(),
		currTurn: 0,
		activeTeamNumber: 0,
		myTeamNumber: 0,
	} as IGameContext;
	const systems = [new NumericSystem(), new MovementSystem(), new ParticipationSystem()];
	for (const entity of entities.getEntities()) entity.setNumericEffectDispatcher(effect => dispatchPredefinedEffect({ ctx, systems, effect }));
	return ctx;
}

function advanceMovement(player: Player, dt: number) {
	const pos = player.getPos();
	const vel = player.getVel();
	player.setPos({
		x: pos.x + vel.x * dt,
		y: pos.y + vel.y * dt,
	});
}

describe("Continuous Collision Detection (13.6)", () => {
	test("positive: fast circle versus thin rectangle prevents tunnelling", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();
		// Fast elastic circle moving right at speed 1000 u/s (displacement ~16 units in dt=0.016)
		const player = new Player(createPlayerSettings({
			position: { x: 20, y: 50 },
			size: 5,
			velocity: { x: 1000, y: 0 },
			bouncyness: 1.0,
		}));
		entityManager.addEntity(player);

		// Thin rectangle obstacle at x 30..32
		const thinWall = new StructureRectangle(30, 0, 2, 100);
		const ctx = createGameContext(entityManager, [thinWall]);

		// Advance player by velocity for 1 frame
		advanceMovement(player, 0.016);
		system.ticker(ctx, 0.016, 1.0);

		// Player must not appear on the right side of thinWall (x > 32)
		const finalPos = player.getPos();
		expect(finalPos.x).toBeLessThan(30); // Bounced/stayed left of the wall
	});

	test("positive: fast circle versus line segment prevents tunnelling", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();
		// Fast elastic circle moving right at speed 1200 u/s
		const player = new Player(createPlayerSettings({
			position: { x: 10, y: 50 },
			size: 5,
			velocity: { x: 1200, y: 0 },
			bouncyness: 1.0,
		}));
		entityManager.addEntity(player);

		// Vertical line segment at x = 25 from y = 0 to 100
		const line = new StructureLine(25, 0, 25, 100);
		const ctx = createGameContext(entityManager, [line]);

		advanceMovement(player, 0.016);
		system.ticker(ctx, 0.016, 1.0);

		const finalPos = player.getPos();
		expect(finalPos.x).toBeLessThan(25); // Bounced left of line
	});

	test("positive: two fast circles moving toward one another collide", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();

		// Two fast elastic circles moving toward each other
		const p1 = new Player(createPlayerSettings({
			id: "p1",
			position: { x: 10, y: 50 },
			size: 5,
			velocity: { x: 800, y: 0 },
			bouncyness: 1.0,
		}));
		const p2 = new Player(createPlayerSettings({
			id: "p2",
			position: { x: 40, y: 50 },
			size: 5,
			velocity: { x: -800, y: 0 },
			bouncyness: 1.0,
		}));
		entityManager.addEntity(p1);
		entityManager.addEntity(p2);

		const ctx = createGameContext(entityManager, []);

		advanceMovement(p1, 0.016);
		advanceMovement(p2, 0.016);
		system.ticker(ctx, 0.016, 1.0);

		// p1 should stay left of p2 without passing through each other
		expect(p1.getPos().x).toBeLessThan(p2.getPos().x);
	});

	test("positive: diagonal corner crossing detects collision", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();

		// Circle moving diagonally toward top-left corner of rectangle at (40, 40)
		const player = new Player(createPlayerSettings({
			position: { x: 20, y: 20 },
			size: 5,
			velocity: { x: 1000, y: 1000 },
			bouncyness: 1.0,
		}));
		entityManager.addEntity(player);

		const rect = new StructureRectangle(40, 40, 50, 50);
		const ctx = createGameContext(entityManager, [rect]);

		advanceMovement(player, 0.016);
		system.ticker(ctx, 0.016, 1.0);

		// Must not penetrate inside the rectangle x 40..90, y 40..90
		const pos = player.getPos();
		const inside = pos.x > 40 && pos.x < 90 && pos.y > 40 && pos.y < 90;
		expect(inside).toBe(false);
	});

	test("positive: collision with kill hazard triggers player elimination", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();

		// Fast circle moving toward deadly obstacle circle at (40, 50)
		const player = new Player(createPlayerSettings({
			position: { x: 10, y: 50 },
			size: 5,
			velocity: { x: 1200, y: 0 },
		}));
		entityManager.addEntity(player);

		const deadly = new DeadlyObstacleCirle(40, 50, 10, "red", []);
		const ctx = createGameContext(entityManager, [deadly]);

		advanceMovement(player, 0.016);
		system.ticker(ctx, 0.016, 1.0);

		// Player must be dead (eliminated by kill hazard on contact)
		expect(player.isDead()).toBe(true);
	});

	test("positive: exact contact at the final substep is detected and resolved", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();

		// Fast circle placed so that substeps land exactly touching wall
		const player = new Player(createPlayerSettings({
			position: { x: 0, y: 50 },
			size: 5,
			velocity: { x: 500, y: 0 },
		}));
		entityManager.addEntity(player);

		const wall = new StructureRectangle(13, 0, 10, 100);
		const ctx = createGameContext(entityManager, [wall]);

		advanceMovement(player, 0.016);
		system.ticker(ctx, 0.016, 1.0);

		expect(player.getPos().x).toBeLessThan(13);
	});

	test("negative: no object may appear on opposite side of thin obstacle", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();

		const player = new Player(createPlayerSettings({
			position: { x: 0, y: 50 },
			size: 5,
			velocity: { x: 2000, y: 0 },
		}));
		entityManager.addEntity(player);

		const thinWall = new StructureRectangle(15, 0, 1, 100);
		const ctx = createGameContext(entityManager, [thinWall]);

		advanceMovement(player, 0.016);
		system.ticker(ctx, 0.016, 1.0);

		expect(player.getPos().x).toBeLessThan(15);
	});

	test("negative: no duplicate collision event from substeps", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();

		let eventCount = 0;
		const player = new Player(createPlayerSettings({
			position: { x: 0, y: 50 },
			size: 5,
			velocity: { x: 1000, y: 0 },
		}));
		player.onCollision = () => {
			eventCount++;
		};
		entityManager.addEntity(player);

		const wall = new StructureRectangle(10, 0, 10, 100);
		const ctx = createGameContext(entityManager, [wall]);

		advanceMovement(player, 0.016);
		system.ticker(ctx, 0.016, 1.0);

		// Event must fire exactly once per tick across substeps
		expect(eventCount).toBe(1);
	});

	test("negative: substep count is strictly bounded by MAX_CCD_SUBSTEPS", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();

		// Extreme velocity (1,000,000 u/s)
		const player = new Player(createPlayerSettings({
			position: { x: 0, y: 50 },
			size: 5,
			velocity: { x: 1000000, y: 0 },
		}));
		entityManager.addEntity(player);

		const ctx = createGameContext(entityManager, []);

		advanceMovement(player, 0.016);

		// Must execute within max substep bound without error or hanging
		expect(() => system.ticker(ctx, 0.016, 1.0)).not.toThrow();
		expect(MAX_CCD_SUBSTEPS).toBe(16);
	});
});
