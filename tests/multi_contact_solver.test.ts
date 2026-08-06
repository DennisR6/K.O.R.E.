import { describe, expect, test } from "bun:test";
import { Player } from "../src/entity/Player.ts";
import { EntityManager } from "../src/entity/EntityManager.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";
import { SHAPE, MAX_CONTACT_SOLVER_ITERATIONS } from "../src/physics/physics.ts";
import { StructureRectangle } from "../src/structures/structureRectangle.ts";
import { PhysicsSystem } from "../src/systems/PhysicsSystem.ts";
import type { IGameContext } from "../src/systems/types.ts";

describe("Multi-Contact Solver (13.5)", () => {
	test("positive: circle between two parallel walls resolves without overlap", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();
		const player = new Player(createPlayerSettings({ position: { x: 45, y: 50 }, size: 10 }));
		entityManager.addEntity(player);

		const wallLeft = new StructureRectangle(0, 30, 40, 40); // x 0..40
		const wallRight = new StructureRectangle(60, 30, 40, 40); // x 60..100

		const context: IGameContext = {
			entities: entityManager,
			structures: [wallLeft, wallRight],
			state: {} as any,
			turn: 0,
			activeTeam: "",
		};

		system.ticker(context, 1, 0.995);

		const pos = player.getPos();
		expect(pos.x).toBeGreaterThanOrEqual(40);
		expect(pos.x).toBeLessThanOrEqual(60);
		expect(physics.checkCollision(player, wallLeft)).toBe(true);
		expect(physics.checkCollision(player, wallRight)).toBe(false);
	});

	test("positive: circle in a corner resolves cleanly against two walls", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();
		const player = new Player(createPlayerSettings({ position: { x: 32, y: 32 }, size: 10 }));
		entityManager.addEntity(player);

		const wallTop = new StructureRectangle(20, 20, 40, 15); // y 20..35
		const wallLeft = new StructureRectangle(20, 20, 15, 40); // x 20..35

		const context: IGameContext = {
			entities: entityManager,
			structures: [wallTop, wallLeft],
			state: {} as any,
			turn: 0,
			activeTeam: "",
		};

		system.ticker(context, 1, 0.995);

		expect(physics.checkCollision(player, wallTop)).toBe(true);
		expect(physics.checkCollision(player, wallLeft)).toBe(true);
	});

	test("positive: three-circle chain resolves multi-contact propagation", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();
		const c1 = new Player(createPlayerSettings({ position: { x: 0, y: 0 }, size: 10 }));
		const c2 = new Player(createPlayerSettings({ position: { x: 19.98, y: 0 }, size: 10 }));
		const c3 = new Player(createPlayerSettings({ position: { x: 39.96, y: 0 }, size: 10 }));
		entityManager.addEntity(c1);
		entityManager.addEntity(c2);
		entityManager.addEntity(c3);

		const context: IGameContext = {
			entities: entityManager,
			structures: [],
			state: {} as any,
			turn: 0,
			activeTeam: "",
		};

		system.ticker(context, 1, 0.995);

		expect(physics.checkCollision(c1, c2)).toBe(true);
		expect(physics.checkCollision(c2, c3)).toBe(true);
	});

	test("positive: multiple circles against one wall resolve correctly", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();
		const c1 = new Player(createPlayerSettings({ position: { x: 50, y: 50 }, size: 10 })); // touches wall (0..40) at 50
		const c2 = new Player(createPlayerSettings({ position: { x: 70, y: 50 }, size: 10 })); // touches c1 at 70
		entityManager.addEntity(c1);
		entityManager.addEntity(c2);

		const wall = new StructureRectangle(0, 30, 40, 40); // x 0..40

		const context: IGameContext = {
			entities: entityManager,
			structures: [wall],
			state: {} as any,
			turn: 0,
			activeTeam: "",
		};

		system.ticker(context, 1, 0.995);

		expect(physics.checkCollision(c1, wall)).toBe(true);
		expect(physics.checkCollision(c2, wall)).toBe(false);
	});

	test("positive: simultaneous entity and structure contacts", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();
		const p1 = new Player(createPlayerSettings({ position: { x: 50, y: 50 }, size: 10 }));
		const p2 = new Player(createPlayerSettings({ position: { x: 70, y: 50 }, size: 10 }));
		entityManager.addEntity(p1);
		entityManager.addEntity(p2);

		const wall = new StructureRectangle(0, 30, 40, 40);

		const context: IGameContext = {
			entities: entityManager,
			structures: [wall],
			state: {} as any,
			turn: 0,
			activeTeam: "",
		};

		system.ticker(context, 1, 0.995);

		expect(physics.checkCollision(p1, wall)).toBe(true);
		expect(physics.checkCollision(p1, p2)).toBe(true);
	});

	test("negative: no left/right oscillation and stable over multiple ticks", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();
		const p = new Player(createPlayerSettings({ position: { x: 50, y: 50 }, size: 10 }));
		entityManager.addEntity(p);
		const wall = new StructureRectangle(0, 30, 40, 40);

		const context: IGameContext = {
			entities: entityManager,
			structures: [wall],
			state: {} as any,
			turn: 0,
			activeTeam: "",
		};

		for (let i = 0; i < 100; i++) {
			system.ticker(context, 1, 0.995);
		}
		const posAfter100 = { ...p.getPos() };
		system.ticker(context, 1, 0.995);
		expect(p.getPos()).toEqual(posAfter100);
	});

	test("negative: no energy explosion across multi-contact collisions", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const entityManager = new EntityManager();
		const p1 = new Player(createPlayerSettings({ position: { x: 15, y: 50 }, size: 10, velocity: { x: 2, y: 0 } }));
		const p2 = new Player(createPlayerSettings({ position: { x: 45, y: 50 }, size: 10, velocity: { x: -2, y: 0 } }));
		entityManager.addEntity(p1);
		entityManager.addEntity(p2);
		const wall = new StructureRectangle(0, 30, 40, 40);

		const context: IGameContext = {
			entities: entityManager,
			structures: [wall],
			state: {} as any,
			turn: 0,
			activeTeam: "",
		};

		const getEnergy = () => physics.magSq(p1.getVel()) + physics.magSq(p2.getVel());
		const initialEnergy = getEnergy();

		for (let i = 0; i < 15; i++) {
			system.ticker(context, 1, 1.0);
			const currentEnergy = getEnergy();
			expect(currentEnergy).toBeLessThanOrEqual(initialEnergy + 1e-6);
		}
	});

	test("negative: no dependence on array or map iteration order", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);

		const em1 = new EntityManager();
		const p1 = new Player(createPlayerSettings({ position: { x: 50, y: 50 }, size: 10 }));
		const p2 = new Player(createPlayerSettings({ position: { x: 70, y: 50 }, size: 10 }));
		em1.addEntity(p1);
		em1.addEntity(p2);
		const wall1 = new StructureRectangle(0, 30, 40, 40);
		const ctx1: IGameContext = { entities: em1, structures: [wall1], state: {} as any, turn: 0, activeTeam: "" };
		system.ticker(ctx1, 1, 0.995);

		const em2 = new EntityManager();
		const p1_rev = new Player(createPlayerSettings({ position: { x: 50, y: 50 }, size: 10 }));
		const p2_rev = new Player(createPlayerSettings({ position: { x: 70, y: 50 }, size: 10 }));
		em2.addEntity(p2_rev);
		em2.addEntity(p1_rev);
		const wall2 = new StructureRectangle(0, 30, 40, 40);
		const ctx2: IGameContext = { entities: em2, structures: [wall2], state: {} as any, turn: 0, activeTeam: "" };
		system.ticker(ctx2, 1, 0.995);

		expect(p1_rev.getPos()).toEqual(p1.getPos());
		expect(p2_rev.getPos()).toEqual(p2.getPos());
	});

	test("negative: iteration-limit success with unresolved contact throws error", () => {
		const physics = new defaultPhysics();
		const system = new PhysicsSystem(physics);
		const em = new EntityManager();
		const p = new Player(createPlayerSettings({ position: { x: 50, y: 50 }, size: 10 }));
		em.addEntity(p);
		const w1 = new StructureRectangle(0, 40, 47, 20); // x 0..47
		const w2 = new StructureRectangle(53, 40, 47, 20); // x 53..100
		const ctx: IGameContext = { entities: em, structures: [w1, w2], state: {} as any, turn: 0, activeTeam: "" };

		expect(() => system.ticker(ctx, 1, 0.995)).toThrow();
	});
});
