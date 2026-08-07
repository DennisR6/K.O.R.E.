import { describe, expect, test } from "bun:test";
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";
import {
	PHYSICS_CONTACT_EPSILON,
	PHYSICS_CONTACT_PERCENT,
	PHYSICS_CONTACT_SLOP,
	SHAPE,
	type Vector2D,
} from "../src/physics/physics.ts";
import { PhysicsSystem } from "../src/systems/PhysicsSystem.ts";
import { DeadlyObstacleCirle } from "../src/structures/DeadlyObstacleCircle.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";

/**
 * Section 13.3 - zero-distance circle/circle contacts.
 *
 * Coincident circles (dist === 0) previously hit an early return in
 * `defaultPhysics.handleCollision` and stayed overlapping forever. They now
 * resolve deterministically along the canonical fallback axis (1, 0):
 *
 * - the first body is corrected toward -X, the second toward +X,
 * - correction follows the 13.1 circle/circle model
 *   (`max(overlap - slop, 0) * percent`, split by inverse mass),
 * - `mass === Infinity` bodies never move,
 * - an impulse is applied only when the relative normal velocity is negative
 *   (approaching along the selected axis); stationary, separating, and
 *   identically-moving bodies never gain collision energy.
 *
 * At the `PhysicsSystem` boundary the pair order is entity storage order, so
 * the resolved body assignment is a pure function of storage order. Swapping
 * the two arguments of `handleCollision` mirrors the resolved state along the
 * axis; for equal masses the unordered world state is identical.
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

const physics = new defaultPhysics();

/** Expected half-split for two coincident circles of radius 10, equal masses. */
const expectedMove = ((20 - PHYSICS_CONTACT_SLOP) / 2) * PHYSICS_CONTACT_PERCENT;

/** Creates two stationary coincident circles with the given masses/radii. */
function coincidentPair(radius = 10, massA = 1, massB = 1): [MockBody, MockBody] {
	const a = new MockBody(SHAPE.CIRCLE, { x: 0, y: 0 }, { x: radius, y: radius }, massA);
	const b = new MockBody(SHAPE.CIRCLE, { x: 0, y: 0 }, { x: radius, y: radius }, massB);
	return [a, b];
}

function distance(a: MockBody, b: MockBody): number {
	return Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
}

describe("Zero-distance circle/circle geometry and determinism (13.3)", () => {
	test("equal-mass stationary coincident circles separate on the documented axis", () => {
		const [a, b] = coincidentPair();
		physics.handleCollision(a as never, b as never);

		// First body -> -X, second body -> +X, no Y component.
		expect(a.pos).toEqual({ x: -expectedMove, y: 0 });
		expect(b.pos).toEqual({ x: expectedMove, y: 0 });
		expect(distance(a, b)).toBeCloseTo(2 * expectedMove, 12);
		expect(distance(a, b)).toBeGreaterThan(0);
	});

	test("repeated identical runs produce bit-identical results", () => {
		const run = () => {
			const [a, b] = coincidentPair(10, 3, 1);
			a.vel = { x: -2, y: 4 };
			physics.handleCollision(a as never, b as never);
			return JSON.stringify([a.pos, a.vel, b.pos, b.vel]);
		};
		expect(run()).toBe(run());
		expect(run()).toBe(run());
	});

	test("a single resolution call reduces the exact-overlap state", () => {
		const [a, b] = coincidentPair();
		const combinedRadius = a.bounds.x + b.bounds.x;
		physics.handleCollision(a as never, b as never);

		const overlapAfter = combinedRadius - distance(a, b);
		expect(overlapAfter).toBeLessThan(combinedRadius);
		expect(overlapAfter).toBeCloseTo(
			combinedRadius - 2 * expectedMove,
			12,
		);
		expect(overlapAfter).toBeGreaterThan(PHYSICS_CONTACT_SLOP); // partial per-call contract
	});

	test("different circle radii are handled correctly", () => {
		const a = new MockBody(SHAPE.CIRCLE, { x: 0, y: 0 }, { x: 10, y: 10 });
		const b = new MockBody(SHAPE.CIRCLE, { x: 0, y: 0 }, { x: 4, y: 4 });
		physics.handleCollision(a as never, b as never);

		const penetration = 14;
		const halfMove = ((penetration - PHYSICS_CONTACT_SLOP) / 2) * PHYSICS_CONTACT_PERCENT;
		expect(a.pos.x).toBeCloseTo(-halfMove, 12);
		expect(b.pos.x).toBeCloseTo(halfMove, 12);
		expect(distance(a, b)).toBeCloseTo(2 * halfMove, 12);
	});

	test("all positions and velocities remain finite", () => {
		const [a, b] = coincidentPair();
		physics.handleCollision(a as never, b as never);

		for (const body of [a, b]) {
			expect(Number.isFinite(body.pos.x)).toBe(true);
			expect(Number.isFinite(body.pos.y)).toBe(true);
			expect(Number.isFinite(body.vel.x)).toBe(true);
			expect(Number.isFinite(body.vel.y)).toBe(true);
		}
	});

	test("the correction axis is the canonical (1, 0) fallback, never random", () => {
		// Repeated fresh runs always separate along +X/-X only.
		for (let i = 0; i < 100; i++) {
			const [a, b] = coincidentPair();
			physics.handleCollision(a as never, b as never);
			expect(a.pos.y).toBe(0);
			expect(b.pos.y).toBe(0);
			expect(a.pos.x).toBe(-expectedMove);
			expect(b.pos.x).toBe(expectedMove);
		}

		// Y-velocity is untouched because the axis is purely horizontal.
		const [c, d] = coincidentPair();
		c.vel = { x: 0, y: 7 };
		d.vel = { x: 0, y: -3 };
		physics.handleCollision(c as never, d as never);
		expect(c.vel).toEqual({ x: 0, y: 7 });
		expect(d.vel).toEqual({ x: 0, y: -3 });
	});
});

describe("Zero-distance circle/circle mass handling (13.3)", () => {
	test("equal finite masses split the correction equally", () => {
		const [a, b] = coincidentPair();
		physics.handleCollision(a as never, b as never);
		expect(a.pos.x).toBeCloseTo(-expectedMove, 12);
		expect(b.pos.x).toBeCloseTo(expectedMove, 12);
	});

	test("unequal finite masses split according to inverse mass", () => {
		// massA = 3, massB = 1 -> invMass ratio 1 : 3.
		const [a, b] = coincidentPair(10, 3, 1);
		physics.handleCollision(a as never, b as never);

		const total = 1 / 3 + 1;
		const moveMag = ((20 - PHYSICS_CONTACT_SLOP) / total) * PHYSICS_CONTACT_PERCENT;
		expect(a.pos.x).toBeCloseTo(-moveMag * (1 / 3), 12);
		expect(b.pos.x).toBeCloseTo(moveMag, 12);
		expect(Math.abs(a.pos.x)).toBeLessThan(Math.abs(b.pos.x));
		// The total separation still matches the equal-mass correction.
		expect(distance(a, b)).toBeCloseTo(2 * expectedMove, 12);
	});

	test("first body immovable: first position unchanged, second receives all correction", () => {
		const [a, b] = coincidentPair(10, Infinity, 1);
		physics.handleCollision(a as never, b as never);
		expect(a.pos).toEqual({ x: 0, y: 0 });
		expect(b.pos.x).toBeCloseTo((20 - PHYSICS_CONTACT_SLOP) * PHYSICS_CONTACT_PERCENT, 12);
	});

	test("second body immovable: second position unchanged, first receives all correction", () => {
		const [a, b] = coincidentPair(10, 1, Infinity);
		physics.handleCollision(a as never, b as never);
		expect(b.pos).toEqual({ x: 0, y: 0 });
		expect(a.pos.x).toBeCloseTo(-(20 - PHYSICS_CONTACT_SLOP) * PHYSICS_CONTACT_PERCENT, 12);
	});

	test("both bodies immovable: neither moves and no NaN is produced", () => {
		const [a, b] = coincidentPair(10, Infinity, Infinity);
		physics.handleCollision(a as never, b as never);
		expect(a.pos).toEqual({ x: 0, y: 0 });
		expect(b.pos).toEqual({ x: 0, y: 0 });
		expect(a.vel).toEqual({ x: 0, y: 0 });
		expect(b.vel).toEqual({ x: 0, y: 0 });
		expect(Number.isFinite(a.pos.x)).toBe(true);
		expect(Number.isFinite(b.pos.x)).toBe(true);
	});
});

describe("Zero-distance circle/circle velocity and energy (13.3)", () => {
	test("two stationary bodies gain no velocity", () => {
		const [a, b] = coincidentPair();
		physics.handleCollision(a as never, b as never);
		expect(a.vel).toEqual({ x: 0, y: 0 });
		expect(b.vel).toEqual({ x: 0, y: 0 });
	});

	test("two bodies with identical velocity gain no relative energy", () => {
		const [a, b] = coincidentPair();
		a.vel = { x: 3, y: 2 };
		b.vel = { x: 3, y: 2 };
		physics.handleCollision(a as never, b as never);
		expect(a.vel).toEqual({ x: 3, y: 2 });
		expect(b.vel).toEqual({ x: 3, y: 2 });
		// Positions are still corrected.
		expect(distance(a, b)).toBeGreaterThan(0);
	});

	test("bodies already moving apart receive no extra collision impulse", () => {
		const [a, b] = coincidentPair();
		a.vel = { x: 2, y: 0 };
		b.vel = { x: 5, y: 0 };
		physics.handleCollision(a as never, b as never);
		expect(a.vel).toEqual({ x: 2, y: 0 });
		expect(b.vel).toEqual({ x: 5, y: 0 });
	});

	test("motion perpendicular to the canonical axis receives no impulse", () => {
		// The deterministic axis is (1, 0); only the relative normal velocity
		// along that axis can trigger an impulse.
		const [a, b] = coincidentPair();
		a.vel = { x: 0, y: 3 };
		b.vel = { x: 0, y: -3 };
		physics.handleCollision(a as never, b as never);
		expect(a.vel).toEqual({ x: 0, y: 3 });
		expect(b.vel).toEqual({ x: 0, y: -3 });
	});

	test("approaching bodies receive the existing restitution-based response", () => {
		// Head-on approach along the axis: A -> +X, B -> -X, restitution 0.
		const [a, b] = coincidentPair();
		a.vel = { x: 5, y: 0 };
		b.vel = { x: -5, y: 0 };
		physics.handleCollision(a as never, b as never);
		expect(a.vel.x).toBeCloseTo(0, 12);
		expect(b.vel.x).toBeCloseTo(0, 12);

		// Restitution 1: perfectly elastic swap along the axis.
		const [c, d] = coincidentPair(10, 1, 1, 1);
		c.bounce = 1;
		d.bounce = 1;
		c.vel = { x: 5, y: 0 };
		d.vel = { x: -5, y: 0 };
		physics.handleCollision(c as never, d as never);
		expect(c.vel.x).toBeCloseTo(-5, 12);
		expect(d.vel.x).toBeCloseTo(5, 12);
	});

	test("momentum is conserved within numeric tolerance", () => {
		// Equal masses, restitution 0: momentum before and after is zero.
		const [a, b] = coincidentPair();
		a.vel = { x: 5, y: 0 };
		b.vel = { x: -5, y: 0 };
		physics.handleCollision(a as never, b as never);
		expect(a.vel.x * a.mass + b.vel.x * b.mass).toBeCloseTo(0, 12);

		// Unequal masses: massA = 1, massB = 3.
		const [c, d] = coincidentPair(10, 1, 3);
		c.vel = { x: 5, y: 0 };
		d.vel = { x: -5, y: 0 };
		const momentumBefore = c.vel.x * c.mass + d.vel.x * d.mass;
		physics.handleCollision(c as never, d as never);
		expect(c.vel.x * c.mass + d.vel.x * d.mass).toBeCloseTo(momentumBefore, 12);
	});

	test("restitution zero never increases kinetic energy", () => {
		const [a, b] = coincidentPair();
		a.vel = { x: 5, y: 0 };
		b.vel = { x: -5, y: 0 };
		const energyBefore = 0.5 * a.mass * (a.vel.x ** 2) + 0.5 * b.mass * (b.vel.x ** 2);
		physics.handleCollision(a as never, b as never);
		const energyAfter = 0.5 * a.mass * (a.vel.x ** 2) + 0.5 * b.mass * (b.vel.x ** 2);
		expect(energyAfter).toBeLessThanOrEqual(energyBefore + 1e-9);
	});
});

describe("Zero-distance circle/circle ordering (13.3)", () => {
	test("swapped argument order produces an equivalent unordered world state", () => {
		// Equal masses: the resolved position multiset is identical.
		const run = (swap: boolean) => {
			const [a, b] = coincidentPair();
			if (swap) physics.handleCollision(b as never, a as never);
			else physics.handleCollision(a as never, b as never);
			return [a.pos.x, b.pos.x].sort((p, q) => p - q);
		};
		expect(run(false)).toEqual(run(true));
	});

	test("swapped argument order mirrors the body assignment along the axis", () => {
		const [a, b] = coincidentPair();
		physics.handleCollision(a as never, b as never);
		expect(a.pos.x).toBeCloseTo(-expectedMove, 12);
		expect(b.pos.x).toBeCloseTo(expectedMove, 12);

		const [c, d] = coincidentPair();
		physics.handleCollision(d as never, c as never);
		// The first argument always resolves toward -X.
		expect(d.pos.x).toBeCloseTo(-expectedMove, 12);
		expect(c.pos.x).toBeCloseTo(expectedMove, 12);
	});

	test("entity insertion order does not change the resolved world state (PhysicsSystem)", () => {
		// Every run uses a fresh coincident pair so the bodies start pristine.
		const run = (swap: boolean) => {
			const [x, y] = coincidentPair();
			const ordered: [MockBody, MockBody] = swap ? [y, x] : [x, y];
			const strategy = new defaultPhysics();
			const system = new PhysicsSystem(strategy);
			const ctx = {
				entities: { getEntities: () => ordered },
				structures: [],
			} as never;
			system.ticker(ctx, 1, 0);
			return [ordered[0].pos.x, ordered[1].pos.x].sort((p, q) => p - q);
		};

		// Sorted positions are identical regardless of storage order.
		expect(run(false)).toEqual(run(true));
		expect(run(false)[0]).toBeCloseTo(-9.69422871073112, 10);
		expect(run(false)[1]).toBeCloseTo(9.69422871073112, 10);
	});

	test("pair ordering at the PhysicsSystem boundary is deterministic", () => {
		const calls: [MockBody, MockBody][] = [];
		const strategy = new defaultPhysics();
		const original = strategy.handleCollision.bind(strategy);
		strategy.handleCollision = ((a: never, b: never) => {
			calls.push([a as MockBody, b as MockBody]);
			return original(a, b);
		}) as never;

		const [x, y] = coincidentPair();
		const system = new PhysicsSystem(strategy);
		const ctx = {
			entities: { getEntities: () => [x, y] },
			structures: [],
		} as never;
		system.ticker(ctx, 1, 0);

		expect(calls.length).toBeGreaterThanOrEqual(1);
		// Earlier storage order is the first argument, deterministically.
		expect(calls[0][0]).toBe(x);
		expect(calls[0][1]).toBe(y);
	});

	test("repeated resolution converges to the slop residual without oscillation", () => {
		const [a, b] = coincidentPair();
		let previous = 20; // initial overlap = combined radius
		for (let i = 0; i < 400; i++) {
			physics.handleCollision(a as never, b as never);
			const overlap = 20 - distance(a, b);
			expect(overlap).toBeLessThanOrEqual(previous + PHYSICS_CONTACT_EPSILON);
			expect(overlap).toBeGreaterThanOrEqual(0);
			previous = overlap;
		}
		expect(previous).toBeLessThanOrEqual(PHYSICS_CONTACT_SLOP + 1e-9);
	});
});

describe("Zero-distance circle/circle regression integration (13.3)", () => {
	test("coincident circles fire the collision event path", () => {
		const [a, b] = coincidentPair();
		physics.handleCollision(a as never, b as never);
		expect(a.contacts.length).toBe(1);
		expect(b.contacts.length).toBe(1);
		expect(a.contacts[0]).toBe(b);
		expect(b.contacts[0]).toBe(a);
	});

	test("a player exactly at the center of a collision circle no longer bypasses collision handling", () => {
		const player = new Player(createPlayerSettings({ position: { x: 0, y: 0 } }));
		const killCircle = new DeadlyObstacleCirle(0, 0, 10, undefined, []);
		const handler = new GameHandlerBuilder().defaultSystems().addPlayer(player).addStructure(killCircle).build();
		const killPosBefore = killCircle.getPos();

		handler.getPhysics().handleCollision(player as never, killCircle as never);

		// The kill contact fires: hp drops below zero.
		expect(player.getHP()).toBeLessThan(0);
		// The immovable structure stays fixed; the player is depenetrated.
		expect(killCircle.getPos()).toEqual(killPosBefore);
		expect(Math.hypot(player.getPos().x, player.getPos().y)).toBeGreaterThan(0);
		// Player mass 1, structure mass Infinity -> player receives the full correction.
		const combinedRadius = player.getBounds().x + killCircle.getBounds().x;
		const fullMove = (combinedRadius - PHYSICS_CONTACT_SLOP) * PHYSICS_CONTACT_PERCENT;
		expect(player.getPos().x).toBeCloseTo(-fullMove, 12);
		expect(player.getPos().y).toBe(0);
	});

		test("the exact-center kill fixture dies through the handler physics tick", () => {
		const player = new Player(createPlayerSettings({ position: { x: 100, y: 100 } }));
		const killCircle = new DeadlyObstacleCirle(100, 100, 10, undefined, []);
		const handler = new GameHandlerBuilder().defaultSystems().addPlayer(player).addStructure(killCircle).build();
		handler.tick();

		expect(player.getHP()).toBeLessThan(0);
		expect(Math.hypot(player.getPos().x - 100, player.getPos().y - 100)).toBeGreaterThan(0);
	});
});
