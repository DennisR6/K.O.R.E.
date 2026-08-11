import { describe, expect, test } from "bun:test";
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";
import {
	PHYSICS_CONTACT_EPSILON,
	PHYSICS_CONTACT_PERCENT,
	PHYSICS_CONTACT_SLOP,
	SHAPE,
	isFiniteVector,
	validatePhysicsBody,
	type PhysicsBodyState,
	type Vector2D,
} from "@coffeemakerstudio/bean";
import { StructureRectangle } from "../src/structures/types.js";
import { PhysicsSystem } from "../src/systems/PhysicsSystem.ts";

/**
 * Section 13.1 - physics contact and resolution contract.
 * The semantics under test are documented in `docs/physics-contract.md`.
 */

/** Minimal deterministic body implementing the physics surface used by the solver. */
class MockBody {
	public pos: Vector2D;
	public vel: Vector2D;
	public contacts: unknown[] = [];
	public shape: SHAPE;
	public bounds: Vector2D;
	public mass: number;
	public bounce: number;
	public role: "solid" | "containment" | "both" | undefined;

	constructor(shape: SHAPE, pos: Vector2D, bounds: Vector2D, mass = 1, bounce = 0) {
		this.shape = shape;
		this.pos = pos;
		this.bounds = bounds;
		this.mass = mass;
		this.bounce = bounce;
		this.vel = { x: 0, y: 0 };
	}

	public getShape(): SHAPE { return this.shape; }
	public getPos(): Vector2D { return this.pos; }
	public setPos(pos: Vector2D): void { this.pos = pos; }
	public getVel(): Vector2D { return this.vel; }
	public setVel(vel: Vector2D): void { this.vel = vel; }
	public getBounds(): Vector2D { return this.bounds; }
	public getMass(): number { return this.mass; }
	public getBounceFactor(): number { return this.bounce; }
	public onCollision({ entity }: { entity: unknown }): void { this.contacts.push(entity); }
	public physicsEnabled(): boolean { return true; }
	public isDead(): boolean { return false; }
}

function bodyState(body: MockBody): PhysicsBodyState {
	return {
		position: body.pos,
		velocity: body.vel,
		bounds: body.bounds,
		mass: body.mass,
		bounceFactor: body.bounce,
		shape: body.shape,
	};
}

const physics = new defaultPhysics();

describe("Physics Contact Contract (13.1)", () => {
	test("separated bodies remain unchanged", () => {
		const a = new MockBody(SHAPE.CIRCLE, { x: 0, y: 0 }, { x: 10, y: 10 });
		const b = new MockBody(SHAPE.CIRCLE, { x: 100, y: 0 }, { x: 10, y: 10 });
		expect(physics.checkCollision(a as never, b as never)).toBe(false);
		const posA = JSON.stringify(a.pos);
		const velA = JSON.stringify(a.vel);
		physics.handleCollision(a as never, b as never);
		expect(JSON.stringify(a.pos)).toBe(posA);
		expect(JSON.stringify(a.vel)).toBe(velA);
		expect(JSON.stringify(b.pos)).toBe(JSON.stringify({ x: 100, y: 0 }));

		// Separated circle/rectangle pair stays untouched as well.
		const c = new MockBody(SHAPE.CIRCLE, { x: 0, y: 0 }, { x: 5, y: 5 });
		const r = new StructureRectangle(50, 50, 10, 10);
		expect(physics.checkCollision(c as never, r as never)).toBe(false);
		physics.handleCollision(c as never, r as never);
		expect(c.pos).toEqual({ x: 0, y: 0 });
	});

	test("touching bodies remain stable (no depenetration, no jitter)", () => {
		// Two circles exactly touching: dist === rA + rB.
		const a = new MockBody(SHAPE.CIRCLE, { x: 0, y: 0 }, { x: 10, y: 10 });
		const b = new MockBody(SHAPE.CIRCLE, { x: 20, y: 0 }, { x: 10, y: 10 });
		expect(physics.checkCollision(a as never, b as never)).toBe(true);

		const before = JSON.stringify([a.pos, b.pos, a.vel, b.vel]);
		const initialPositions = JSON.stringify([a.pos, b.pos]);
		for (let i = 0; i < 500; i++) {
			physics.handleCollision(a as never, b as never);
			expect(JSON.stringify([a.pos, b.pos])).toBe(initialPositions);
		}
		expect(JSON.stringify([a.pos, b.pos, a.vel, b.vel])).toBe(before);

		// Circle exactly touching a rectangle edge: distance === radius.
		const c = new MockBody(SHAPE.CIRCLE, { x: 10, y: 25 }, { x: 5, y: 5 });
		const r = new StructureRectangle(5, 0, 10, 20);
		expect(physics.checkCollision(c as never, r as never)).toBe(true);
		const beforeRect = JSON.stringify([c.pos, c.vel]);
		for (let i = 0; i < 500; i++) {
			physics.handleCollision(c as never, r as never);
			expect(JSON.stringify(c.pos)).toBe(JSON.stringify({ x: 10, y: 25 }));
		}
		expect(JSON.stringify([c.pos, c.vel])).toBe(beforeRect);
	});

	test("overlapping circles resolve according to the documented contract", () => {
		// dist 15, radius sum 20 -> overlap 5, equal masses.
		const a = new MockBody(SHAPE.CIRCLE, { x: 0, y: 0 }, { x: 10, y: 10 });
		const b = new MockBody(SHAPE.CIRCLE, { x: 15, y: 0 }, { x: 10, y: 10 });
		physics.handleCollision(a as never, b as never);

		const move = ((5 - PHYSICS_CONTACT_SLOP) / 2) * PHYSICS_CONTACT_PERCENT;
		expect(a.pos.x).toBe(-move);
		expect(b.pos.x).toBe(15 + move);
		expect(a.pos.y).toBe(0);
		expect(b.pos.y).toBe(0);

		// The residual overlap is exactly o*(1 - percent) + slop*percent and
		// strictly decreases with every call (monotone deterministic progress).
		const firstResidual = 20 - (15 + 2 * move);
		expect(firstResidual).toBeCloseTo(5 * (1 - PHYSICS_CONTACT_PERCENT) + PHYSICS_CONTACT_SLOP * PHYSICS_CONTACT_PERCENT, 10);
		const before = firstResidual;
		physics.handleCollision(a as never, b as never);
		const secondResidual = 20 - (b.pos.x - a.pos.x);
		expect(secondResidual).toBeLessThan(before);
	});

	test("overlapping circle/rectangle resolves according to the documented contract", () => {
		// Exterior shallow overlap (overlap 1): fully resolved in one call.
		const c = new MockBody(SHAPE.CIRCLE, { x: 19, y: 0 }, { x: 10, y: 10 });
		const r = new StructureRectangle(0, 0, 10, 40);
		physics.handleCollision(c as never, r as never);
		expect(c.pos.x).toBeGreaterThanOrEqual(10 + 10); // distance to edge >= radius

		// Interior: minimum-exit axis, stable tie order left -> right -> top -> bottom.
		const inside = new MockBody(SHAPE.CIRCLE, { x: 5, y: 5 }, { x: 2, y: 2 });
		const box = new StructureRectangle(0, 0, 10, 40);
		physics.handleCollision(inside as never, box as never);
		// left === right === top === 5; the documented order picks left, so the
		// correction is purely horizontal (full exit is task 13.2).
		expect(inside.pos.x).toBeLessThan(5);
		expect(inside.pos.y).toBe(5);

		// Interior tie between top and bottom (left/right strictly larger)
		// picks top per the documented stable order.
		const tie = new MockBody(SHAPE.CIRCLE, { x: 9, y: 5 }, { x: 2, y: 2 });
		const tieBox = new StructureRectangle(0, 0, 18, 10);
		physics.handleCollision(tie as never, tieBox as never);
		expect(tie.pos.y).toBeLessThan(5);
		expect(tie.pos.x).toBe(9);
	});

	test("immovable bodies remain fixed", () => {
		// Circle/circle with one infinite-mass partner.
		const a = new MockBody(SHAPE.CIRCLE, { x: 0, y: 0 }, { x: 10, y: 10 });
		const b = new MockBody(SHAPE.CIRCLE, { x: 15, y: 0 }, { x: 10, y: 10 }, Infinity);
		physics.handleCollision(a as never, b as never);
		expect(b.pos).toEqual({ x: 15, y: 0 });
		expect(a.pos.x).toBeLessThan(0);

		// Circle/rectangle with the immovable rectangle.
		const c = new MockBody(SHAPE.CIRCLE, { x: 19, y: 0 }, { x: 10, y: 10 });
		const r = new StructureRectangle(0, 0, 10, 40);
		const rectPosBefore = JSON.stringify(r.getPos());
		physics.handleCollision(c as never, r as never);
		expect(JSON.stringify(r.getPos())).toBe(rectPosBefore);
		expect(c.pos.x).toBeGreaterThanOrEqual(20);
	});

	test("equal inputs produce bit-identical results", () => {
		const run = () => {
			const a = new MockBody(SHAPE.CIRCLE, { x: 0, y: 0 }, { x: 10, y: 10 });
			const b = new MockBody(SHAPE.CIRCLE, { x: 15, y: 0 }, { x: 10, y: 10 }, 3);
			const rect = new StructureRectangle(0, 0, 10, 40);
			a.vel = { x: 2, y: -1 };
			physics.handleCollision(a as never, b as never);
			physics.handleCollision(a as never, rect as never);
			return JSON.stringify([a.pos, a.vel, b.pos, b.vel, rect.getPos()]);
		};
		expect(run()).toBe(run());
	});

	test("invalid mass, radius, position, velocity, and restitution values are rejected", () => {
		const base = { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, bounds: { x: 10, y: 10 }, mass: 1, bounceFactor: 0.5, shape: SHAPE.CIRCLE };
		expect(() => validatePhysicsBody({ ...base, position: { x: NaN, y: 0 } })).toThrow(/non-finite position/);
		expect(() => validatePhysicsBody({ ...base, position: { x: 0, y: Infinity } })).toThrow(/non-finite position/);
		expect(() => validatePhysicsBody({ ...base, velocity: { x: Infinity, y: 0 } })).toThrow(/non-finite velocity/);
		expect(() => validatePhysicsBody({ ...base, velocity: { x: 0, y: NaN } })).toThrow(/non-finite velocity/);
		expect(() => validatePhysicsBody({ ...base, bounds: { x: -1, y: 10 } })).toThrow(/bounds/);
		expect(() => validatePhysicsBody({ ...base, bounds: { x: NaN, y: 10 } })).toThrow(/bounds/);
		expect(() => validatePhysicsBody({ ...base, bounds: { x: 0, y: 10 } })).toThrow(/positive radius/);
		expect(() => validatePhysicsBody({ ...base, mass: 0 })).toThrow(/mass/);
		expect(() => validatePhysicsBody({ ...base, mass: -3 })).toThrow(/mass/);
		expect(() => validatePhysicsBody({ ...base, mass: NaN })).toThrow(/mass/);
		expect(() => validatePhysicsBody({ ...base, bounceFactor: -0.1 })).toThrow(/bounce/);
		expect(() => validatePhysicsBody({ ...base, bounceFactor: 1.5 })).toThrow(/bounce/);
		expect(() => validatePhysicsBody({ ...base, bounceFactor: NaN })).toThrow(/bounce/);

		// The neutral inherit marker and valid bodies are accepted.
		expect(() => validatePhysicsBody({ ...base, mass: Infinity })).not.toThrow();
		expect(() => validatePhysicsBody({ ...base, bounceFactor: Infinity })).not.toThrow();
		expect(() => validatePhysicsBody({ ...base, bounceFactor: 0 })).not.toThrow();
		expect(() => validatePhysicsBody({ ...base, bounceFactor: 1 })).not.toThrow();
		expect(() => validatePhysicsBody({ ...base, shape: SHAPE.RECTANGLE, bounds: { x: 0, y: 20 } })).not.toThrow();
		expect(() => validatePhysicsBody({ ...base, shape: SHAPE.LINE, bounds: { x: 10, y: 10 } })).not.toThrow();
	});

	test("isFiniteVector detects NaN and Infinity", () => {
		expect(isFiniteVector({ x: 0, y: 0 })).toBe(true);
		expect(isFiniteVector({ x: NaN, y: 0 })).toBe(false);
		expect(isFiniteVector({ x: 0, y: Infinity })).toBe(false);
		expect(isFiniteVector({ x: -Infinity, y: 0 })).toBe(false);
	});

	test("a non-finite contact never produces NaN or Infinity state", () => {
		const a = new MockBody(SHAPE.CIRCLE, { x: 0, y: 0 }, { x: 10, y: 10 });
		const b = new MockBody(SHAPE.CIRCLE, { x: NaN, y: 0 }, { x: 10, y: 10 });
		physics.handleCollision(a as never, b as never);
		expect(Number.isFinite(a.pos.x)).toBe(true);
		expect(Number.isFinite(a.pos.y)).toBe(true);
		expect(Number.isFinite(a.vel.x)).toBe(true);
		expect(Number.isFinite(b.pos.x)).toBe(false); // input garbage stays untouched
	});

	test("collision detection cannot report an unresolvable contact indefinitely", () => {
		// Repeated resolution strictly reduces the overlap until the slop
		// residual; it never oscillates and never increases.
		const a = new MockBody(SHAPE.CIRCLE, { x: 0, y: 0 }, { x: 10, y: 10 });
		const b = new MockBody(SHAPE.CIRCLE, { x: 11, y: 0 }, { x: 10, y: 10 });
		let previous = 9; // initial overlap: 20 - 11
		for (let i = 0; i < 400; i++) {
			physics.handleCollision(a as never, b as never);
			const overlap = 20 - (b.pos.x - a.pos.x);
			expect(overlap).toBeLessThanOrEqual(previous + PHYSICS_CONTACT_EPSILON);
			expect(overlap).toBeGreaterThanOrEqual(0);
			previous = overlap;
		}
		expect(previous).toBeLessThanOrEqual(PHYSICS_CONTACT_SLOP + 1e-9);
		// Stable: further calls do not move the bodies anymore.
		const stable = JSON.stringify([a.pos, b.pos]);
		physics.handleCollision(a as never, b as never);
		physics.handleCollision(a as never, b as never);
		expect(JSON.stringify([a.pos, b.pos])).toBe(stable);
	});

	test("containment-only structures never enter solid collision resolution", () => {
		const circle = new MockBody(SHAPE.CIRCLE, { x: 100, y: 100 }, { x: 20, y: 20 });
		const containment = new StructureRectangle(0, 0, 200, 200, undefined, [], "containment");
		const solid = new StructureRectangle(80, 80, 40, 40, undefined, [], "solid");

		let handledPairs = 0;
		let containmentHandled = false;
		const countingStrategy = new defaultPhysics();
		const originalHandle = countingStrategy.handleCollision.bind(countingStrategy);
		countingStrategy.handleCollision = ((a: never, b: never) => {
			handledPairs++;
			const pair = [a, b];
			if (pair.includes(containment as never)) containmentHandled = true;
			return originalHandle(a, b);
		}) as never;

		const system = new PhysicsSystem(countingStrategy);
		const ctx = {
			entities: { getEntities: () => [circle] },
			structures: [containment, solid],
		} as never;
		system.ticker(ctx, 1, 0);

		expect(containmentHandled).toBe(false);
		expect(handledPairs).toBe(1);
		// The circle overlapped the containment rect but was not depenetrated by it.
		expect(circle.pos.x).toBeLessThan(100); // moved only by the solid rect
	});
});
