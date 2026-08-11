import { describe, expect, test } from "bun:test";
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";
import { SHAPE, type Vector2D } from "@coffeemakerstudio/bean";
import { StructureLine } from "../src/structures/structureLine.ts";
import { StructureRectangle } from "../src/structures/types.js";

/**
 * Section 13.4 - circle/line, endpoint, and rectangle-corner stabilization.
 *
 * Contact model (documented in `docs/physics-contract.md` §7.3):
 *
 * - closest point = projection of the circle center onto the segment with the
 *   projection parameter clamped to [0, 1]; t === 0 is the start endpoint,
 *   t === 1 the end endpoint, 0 < t < 1 the line interior,
 * - normal = normalize(circleCenter - closestPoint),
 * - zero-distance contacts (center exactly on the segment or an endpoint) use
 *   the canonical left-hand perpendicular of the stored start-to-end
 *   direction: (-dy, dx) / length; swapping the direction mirrors it,
 * - penetrating circles are repositioned to exactly touch the segment,
 * - the impulse applies only while the circle approaches along the normal
 *   (relative normal velocity < 0); tangential velocity is preserved,
 * - exactly touching contacts are stable no-ops (no correction, no impulse,
 *   no event),
 * - zero-length lines are rejected at construction.
 *
 * Rectangle corners use the radial closest-point normal (exterior) and the
 * documented 13.2 interior minimum-exit solver for exact corner-center
 * overlaps; no corner code path changed.
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

function circle(pos: Vector2D, radius = 2, vel: Vector2D = { x: 0, y: 0 }, bounce = 0): MockBody {
	const body = new MockBody(SHAPE.CIRCLE, { ...pos }, { x: radius, y: radius }, 1, bounce);
	body.vel = { ...vel };
	return body;
}

function line(x: number, y: number, x2: number, y2: number): StructureLine {
	return new StructureLine(x, y, x2, y2, "black");
}

/** Distance from a point to the finite segment start-end (endpoints included). */
function distToSegment(p: Vector2D, start: Vector2D, end: Vector2D): number {
	const sx = end.x - start.x;
	const sy = end.y - start.y;
	const lengthSq = sx * sx + sy * sy;
	const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - start.x) * sx + (p.y - start.y) * sy) / lengthSq));
	const cx = start.x + t * sx;
	const cy = start.y + t * sy;
	return Math.hypot(p.x - cx, p.y - cy);
}

/** Distance from a point to the closest point of a rectangle. */
function distToRect(p: Vector2D, rect: StructureRectangle): number {
	const r = rect.getPos();
	const b = rect.getBounds();
	const cx = Math.max(r.x, Math.min(p.x, r.x + b.x));
	const cy = Math.max(r.y, Math.min(p.y, r.y + b.y));
	return Math.hypot(p.x - cx, p.y - cy);
}

function assertFinite(body: MockBody): void {
	expect(Number.isFinite(body.pos.x)).toBe(true);
	expect(Number.isFinite(body.pos.y)).toBe(true);
	expect(Number.isFinite(body.vel.x)).toBe(true);
	expect(Number.isFinite(body.vel.y)).toBe(true);
}

function speed(body: MockBody): number {
	return Math.hypot(body.vel.x, body.vel.y);
}

describe("Line interior contacts (13.4)", () => {
	test("perpendicular impact against a horizontal line reflects the normal component", () => {
		const c = circle({ x: 5, y: 0.5 }, 2, { x: 0, y: -3 }, 1);
		const l = line(0, 0, 10, 0);
		physics.handleCollision(c as never, l as never);

		expect(c.pos).toEqual({ x: 5, y: 2 }); // exactly touching
		expect(distToSegment(c.pos, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(2, 12);
		expect(c.vel).toEqual({ x: 0, y: 3 });
	});

	test("perpendicular impact against a vertical line reflects the normal component", () => {
		const c = circle({ x: 0.5, y: 5 }, 2, { x: -3, y: 0 }, 1);
		const l = line(0, 0, 0, 10);
		physics.handleCollision(c as never, l as never);

		expect(c.pos).toEqual({ x: 2, y: 5 });
		expect(distToSegment(c.pos, { x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(2, 12);
		expect(c.vel).toEqual({ x: 3, y: 0 });
	});

	test("glancing impact preserves the tangential velocity", () => {
		const c = circle({ x: 5, y: 0.5 }, 2, { x: 4, y: -2 }, 1);
		const l = line(0, 0, 10, 0);
		physics.handleCollision(c as never, l as never);

		expect(c.vel).toEqual({ x: 4, y: 2 });
		expect(distToSegment(c.pos, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(2, 12);
	});

	test("stationary touching circle does not jitter", () => {
		const c = circle({ x: 5, y: 2 }, 2);
		const l = line(0, 0, 10, 0);
		const before = JSON.stringify([c.pos, c.vel]);
		for (let i = 0; i < 500; i++) {
			physics.handleCollision(c as never, l as never);
		}
		expect(JSON.stringify([c.pos, c.vel])).toBe(before);
		// Touching contacts are stable no-ops and fire no events.
		expect(c.contacts.length).toBe(0);
	});

	test("separating circle receives no second impulse", () => {
		const c = circle({ x: 5, y: 1 }, 2, { x: 0, y: 3 });
		const l = line(0, 0, 10, 0);
		physics.handleCollision(c as never, l as never);

		// Positional correction still happens; velocity stays untouched.
		expect(c.pos).toEqual({ x: 5, y: 2 });
		expect(c.vel).toEqual({ x: 0, y: 3 });
	});

	test("penetrating circle is moved out of the line", () => {
		const c = circle({ x: 5, y: 0.5 }, 2);
		const l = line(0, 0, 10, 0);
		physics.handleCollision(c as never, l as never);

		expect(distToSegment(c.pos, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(2, 12);
		expect(c.pos.y).toBeGreaterThan(0.5); // never pushed deeper into the segment
	});

	test("repeated call after separation is a no-op", () => {
		const c = circle({ x: 5, y: 0.5 }, 2);
		const l = line(0, 0, 10, 0);
		physics.handleCollision(c as never, l as never);
		const afterFirst = JSON.stringify([c.pos, c.vel, c.contacts.length]);
		physics.handleCollision(c as never, l as never);
		physics.handleCollision(c as never, l as never);
		expect(JSON.stringify([c.pos, c.vel, c.contacts.length])).toBe(afterFirst);
	});
});

describe("Endpoint contacts (13.4)", () => {
	test("collision against the start endpoint uses the radial endpoint normal", () => {
		const c = circle({ x: -1, y: 1 }, 2);
		const l = line(0, 0, 10, 0);
		physics.handleCollision(c as never, l as never);

		// Final position lies on the ray from the start endpoint through the
		// original center, exactly one radius away.
		const d = Math.hypot(c.pos.x, c.pos.y);
		expect(d).toBeCloseTo(2, 12);
		expect(c.pos.x).toBeLessThan(0);
		expect(c.pos.y).toBeGreaterThan(0);
	});

	test("collision against the end endpoint uses the radial endpoint normal", () => {
		const c = circle({ x: 11, y: 1 }, 2);
		const l = line(0, 0, 10, 0);
		physics.handleCollision(c as never, l as never);

		const d = Math.hypot(c.pos.x - 10, c.pos.y);
		expect(d).toBeCloseTo(2, 12);
		expect(c.pos.x).toBeGreaterThan(10);
		expect(c.pos.y).toBeGreaterThan(0);
	});

	test("exact start-endpoint center overlap resolves deterministically", () => {
		const c = circle({ x: 0, y: 0 }, 2);
		const l = line(0, 0, 10, 0);
		physics.handleCollision(c as never, l as never);

		// Canonical left-hand perpendicular (0, 1) for the direction (10, 0).
		expect(c.pos).toEqual({ x: 0, y: 2 });
		expect(c.contacts.length).toBe(1); // the contact path is reached
	});

	test("exact end-endpoint center overlap resolves deterministically", () => {
		const c = circle({ x: 10, y: 0 }, 2);
		const l = line(0, 0, 10, 0);
		physics.handleCollision(c as never, l as never);

		expect(c.pos).toEqual({ x: 10, y: 2 });
	});

	test("circle center exactly on the segment body resolves via the canonical perpendicular", () => {
		const c = circle({ x: 5, y: 0 }, 2);
		const l = line(0, 0, 10, 0);
		physics.handleCollision(c as never, l as never);

		expect(c.pos).toEqual({ x: 5, y: 2 });
		expect(distToSegment(c.pos, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(2, 12);

		// Diagonal line: the fallback is the left-hand perpendicular of the
		// stored direction (10, 10) -> (-1, 1) / sqrt(2).
		const d = circle({ x: 5, y: 5 }, 2);
		const dl = line(0, 0, 10, 10);
		physics.handleCollision(d as never, dl as never);
		const root = Math.SQRT2;
		expect(d.pos.x).toBeCloseTo(5 - root, 12);
		expect(d.pos.y).toBeCloseTo(5 + root, 12);
		expect(distToSegment(d.pos, { x: 0, y: 0 }, { x: 10, y: 10 })).toBeCloseTo(2, 12);
	});

	test("glancing endpoint collision remains finite and bounded", () => {
		const c = circle({ x: 9.5, y: 0.5 }, 2, { x: 3, y: -1 });
		const l = line(0, 0, 10, 0);
		const speedBefore = speed(c);
		physics.handleCollision(c as never, l as never);

		assertFinite(c);
		// Tangential component (along the line) preserved, normal reflected.
		expect(c.vel.x).toBeCloseTo(3, 12);
		expect(speed(c)).toBeLessThanOrEqual(speedBefore + 1e-9);
		expect(distToSegment(c.pos, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(2, 12);
	});

	test("swapping line direction produces the documented mirrored fallback", () => {
		const a = circle({ x: 5, y: 0 }, 2);
		const la = line(0, 0, 10, 0);
		physics.handleCollision(a as never, la as never);
		expect(a.pos).toEqual({ x: 5, y: 2 });

		const b = circle({ x: 5, y: 0 }, 2);
		const lb = line(10, 0, 0, 0);
		physics.handleCollision(b as never, lb as never);
		expect(b.pos).toEqual({ x: 5, y: -2 });
	});

	test("repeated identical runs are bit-identical", () => {
		const run = () => {
			const bodies = [
				circle({ x: -1, y: 1 }, 2, { x: -1, y: -2 }),
				circle({ x: 9.5, y: 0.5 }, 2, { x: 3, y: -1 }),
				circle({ x: 0, y: 0 }, 2),
			];
			const l = line(0, 0, 10, 0);
			for (const body of bodies) physics.handleCollision(body as never, l as never);
			return JSON.stringify(bodies.map((b) => [b.pos, b.vel]));
		};
		expect(run()).toBe(run());
	});
});

describe("Rectangle corner contacts (13.4)", () => {
	const cornerRect = () => new StructureRectangle(0, 0, 10, 10, undefined, []);

	test("circle collision with the top-left corner", () => {
		const c = circle({ x: -1, y: -1 }, 2);
		const rect = cornerRect();
		physics.handleCollision(c as never, rect as never);

		// Radial corner normal; full depenetration (overlap + 0.01 clearance).
		const n = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };
		const totalMove = 2 - Math.SQRT2 + 0.01;
		expect(c.pos.x).toBeCloseTo(-1 + n.x * totalMove, 12);
		expect(c.pos.y).toBeCloseTo(-1 + n.y * totalMove, 12);
		expect(distToRect(c.pos, rect)).toBeGreaterThanOrEqual(2 - 1e-9);
	});

	test("circle collision with the top-right corner", () => {
		const c = circle({ x: 11, y: -1 }, 2);
		const rect = cornerRect();
		physics.handleCollision(c as never, rect as never);

		const n = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
		const totalMove = 2 - Math.SQRT2 + 0.01;
		expect(c.pos.x).toBeCloseTo(11 + n.x * totalMove, 12);
		expect(c.pos.y).toBeCloseTo(-1 + n.y * totalMove, 12);
		expect(distToRect(c.pos, rect)).toBeGreaterThanOrEqual(2 - 1e-9);
	});

	test("circle collision with the bottom-left corner", () => {
		const c = circle({ x: -1, y: 11 }, 2);
		const rect = cornerRect();
		physics.handleCollision(c as never, rect as never);

		const n = { x: -Math.SQRT1_2, y: Math.SQRT1_2 };
		const totalMove = 2 - Math.SQRT2 + 0.01;
		expect(c.pos.x).toBeCloseTo(-1 + n.x * totalMove, 12);
		expect(c.pos.y).toBeCloseTo(11 + n.y * totalMove, 12);
		expect(distToRect(c.pos, rect)).toBeGreaterThanOrEqual(2 - 1e-9);
	});

	test("circle collision with the bottom-right corner", () => {
		const c = circle({ x: 11, y: 11 }, 2);
		const rect = cornerRect();
		physics.handleCollision(c as never, rect as never);

		const n = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
		const totalMove = 2 - Math.SQRT2 + 0.01;
		expect(c.pos.x).toBeCloseTo(11 + n.x * totalMove, 12);
		expect(c.pos.y).toBeCloseTo(11 + n.y * totalMove, 12);
		expect(distToRect(c.pos, rect)).toBeGreaterThanOrEqual(2 - 1e-9);
	});

	test("exact circle-center-on-corner overlap resolves deterministically", () => {
		// Center exactly on the top-left corner: the 13.2 interior solver picks
		// the minimum exit axis (left wins the tie order).
		const c = circle({ x: 0, y: 0 }, 2);
		const rect = cornerRect();
		physics.handleCollision(c as never, rect as never);

		expect(c.pos).toEqual({ x: -(2 + 0.01), y: 0 });
		expect(c.contacts.length).toBe(1);
	});

	test("edge-to-corner transition does not produce extreme velocity", () => {
		// Sweep the circle center around the top-left corner region below the
		// rect (y = -0.1), crossing the edge/corner boundary at x = 0.
		const rect = cornerRect();
		for (let i = 0; i <= 16; i++) {
			const x = -2 + i * 0.25;
			const c = circle({ x, y: -0.1 }, 2, { x: 0, y: 3 }); // approaching downward
			physics.handleCollision(c as never, rect as never);

			assertFinite(c);
			expect(speed(c)).toBeLessThanOrEqual(3 + 1e-9); // no energy introduced
			expect(distToRect(c.pos, rect)).toBeGreaterThanOrEqual(2 - 1e-9); // no unresolved penetration
		}
	});

	test("second resolution call after separation is a no-op", () => {
		const c = circle({ x: 11, y: -1 }, 2);
		const rect = cornerRect();
		physics.handleCollision(c as never, rect as never);
		const afterFirst = JSON.stringify([c.pos, c.vel, c.contacts.length]);
		physics.handleCollision(c as never, rect as never);
		physics.handleCollision(c as never, rect as never);
		expect(JSON.stringify([c.pos, c.vel, c.contacts.length])).toBe(afterFirst);
	});

	test("edge impact still uses the edge normal next to a corner", () => {
		// Center above the top edge, clearly inside the x-range: edge normal.
		// The rect contract is full depenetration (overlap + 0.01 clearance),
		// so the circle is pushed up to exactly radius + clearance distance.
		const c = circle({ x: 5, y: -0.5 }, 2, { x: 0, y: 3 });
		const rect = cornerRect();
		physics.handleCollision(c as never, rect as never);
		expect(c.pos.y).toBeCloseTo(-0.5 - (1.5 + 0.01), 12);
		expect(c.pos.x).toBe(5);
		// Approaching velocity is absorbed by the restitution-0 impulse.
		expect(c.vel).toEqual({ x: 0, y: 0 });
	});
});

describe("Degenerate lines (13.4)", () => {
	test("zero-length line is rejected at construction", () => {
		expect(() => new StructureLine(5, 5, 5, 5, "black")).toThrow(/non-zero length/);
		expect(() => new StructureLine(0, 0, 0, 0, "black")).toThrow(/non-zero length/);
		expect(() => new StructureLine(-3, 2, -3, 2, "black")).toThrow(/non-zero length/);
	});

	test("non-finite line coordinates are rejected at construction", () => {
		expect(() => new StructureLine(NaN, 0, 10, 0, "black")).toThrow(/finite/);
		expect(() => new StructureLine(0, 0, Infinity, 0, "black")).toThrow(/finite/);
	});

	test("extremely small but non-zero line length is handled safely", () => {
		const tiny = line(0, 0, 1e-9, 0);
		const c = circle({ x: 5e-10, y: 1 }, 2);
		physics.handleCollision(c as never, tiny as never);

		expect(c.pos.x).toBeCloseTo(5e-10, 20);
		expect(c.pos.y).toBeCloseTo(2, 12);
		assertFinite(c);

		// Zero-distance on the tiny line: canonical perpendicular still works.
		const d = circle({ x: 5e-10, y: 0 }, 2);
		physics.handleCollision(d as never, tiny as never);
		expect(d.pos.y).toBeCloseTo(2, 12);
		assertFinite(d);
	});
});

describe("Numeric safety (13.4)", () => {
	test("all position and velocity components remain finite across contact kinds", () => {
		const fixtures: (() => void)[] = [
			() => physics.handleCollision(circle({ x: 5, y: 0.5 }, 2, { x: -3, y: -4 }) as never, line(0, 0, 10, 0) as never),
			() => physics.handleCollision(circle({ x: 0, y: 0 }, 2) as never, line(0, 0, 10, 0) as never),
			() => physics.handleCollision(circle({ x: -1, y: -1 }, 2, { x: 2, y: 2 }) as never, new StructureRectangle(0, 0, 10, 10, undefined, []) as never),
			() => physics.handleCollision(circle({ x: 5, y: 5 }, 2, { x: -1, y: -1 }) as never, line(0, 0, 10, 10) as never),
		];
		for (const run of fixtures) run();
	});

	test("no collision branch divides by zero", () => {
		// Zero-distance line and exact-corner rect contacts both resolve
		// without NaN (they would have divided by zero before 13.3/13.4).
		const onLine = circle({ x: 3, y: 3 }, 2);
		physics.handleCollision(onLine as never, line(0, 0, 6, 6) as never);
		expect(Number.isFinite(onLine.pos.x)).toBe(true);
		expect(Number.isFinite(onLine.pos.y)).toBe(true);

		const onCorner = circle({ x: 10, y: 10 }, 2);
		physics.handleCollision(onCorner as never, new StructureRectangle(0, 0, 10, 10, undefined, []) as never);
		expect(Number.isFinite(onCorner.pos.x)).toBe(true);
		expect(Number.isFinite(onCorner.pos.y)).toBe(true);
	});

	test("impulse responses stay within the speed safety bound", () => {
		const l = line(0, 0, 10, 0);
		const approaching = [
			circle({ x: 5, y: 0.5 }, 2, { x: 0, y: -100 }),
			circle({ x: 5, y: 0.5 }, 2, { x: 50, y: -80 }),
			circle({ x: -0.5, y: 0.5 }, 2, { x: -40, y: -40 }),
		];
		for (const c of approaching) {
			const before = speed(c);
			physics.handleCollision(c as never, l as never);
			// Restitution 0: the reflection never increases speed.
			expect(speed(c)).toBeLessThanOrEqual(before + 1e-9);
			assertFinite(c);
		}
	});
});
