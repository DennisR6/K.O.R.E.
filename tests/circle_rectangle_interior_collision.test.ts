import { expect, test } from "bun:test";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";
import { StructureRectangle } from "../src/structures/structureRectangle.ts";

/**
 * Engine defect hardening 12.2: embedded circle/rectangle collisions resolve
 * deterministically through the nearest rect edge. The old zero-distance
 * fallback normal (always upward) is gone, ties are documented (left, right,
 * top, bottom), and the depenetration applies exactly once without altering
 * an unrelated velocity axis.
 */

const physics = new defaultPhysics();
/** A rect of 20x20 at (40,40) with an embedded test circle at its center. */
const rect = new StructureRectangle(40, 40, 20, 20);

function circle(x: number, y: number, size = 10, velocity = { x: 0, y: 0 }) {
	return new Player(createPlayerSettings({ position: { x, y }, size, velocity }));
}

test("exact center exits left with the documented tie-break", () => {
	const player = circle(50, 50);
	physics.handleCollision(player, rect);
	// left = right = top = bottom = 10 -> tie-break order picks left (-x).
	expect(player.getPos()).toEqual({ x: 48, y: 50 });
	expect(player.getVel()).toEqual({ x: 0, y: 0 });
});

test("exact center fully depenetrates after enough ticks and stays finite", () => {
	const player = circle(50, 50);
	for (let frame = 0; frame < 12; frame++) physics.handleCollision(player, rect);
	const pos = player.getPos();
	// The circle edge must clear the rect (x + 10 <= 40 -> x <= 30).
	expect(pos.x).toBeLessThanOrEqual(30.01);
	expect(pos.y).toBe(50);
	expect(Number.isFinite(pos.x)).toBe(true);
	expect(Number.isFinite(pos.y)).toBe(true);
});

test("an embedded circle near the bottom edge is pushed downward, not upward", () => {
	const player = circle(50, 55, 5);
	physics.handleCollision(player, rect);
	// bottom (5) is the nearest edge; the regression pushed up with (0,-1).
	expect(player.getPos().y).toBeGreaterThan(55);
	expect(player.getPos().x).toBe(50);
});

test("an embedded circle near the top edge is pushed upward", () => {
	const player = circle(50, 45, 5);
	physics.handleCollision(player, rect);
	expect(player.getPos().y).toBeLessThan(45);
	expect(player.getPos().x).toBe(50);
});

test("tie-break order prefers right over top at equal distances", () => {
	// right and top are both 5 -> the documented order picks right (+x).
	const player = circle(55, 45, 5);
	physics.handleCollision(player, rect);
	expect(player.getPos().x).toBeGreaterThan(55);
	expect(player.getPos().y).toBe(45);
});

test("an embedded circle near the left edge is pushed leftward", () => {
	const player = circle(45, 55, 5);
	physics.handleCollision(player, rect);
	expect(player.getPos().x).toBeLessThan(45);
	expect(player.getPos().y).toBe(55);
});

test("an embedded circle near the right edge is pushed rightward", () => {
	const player = circle(55, 50, 5);
	physics.handleCollision(player, rect);
	expect(player.getPos().x).toBeGreaterThan(55);
	expect(player.getPos().y).toBe(50);
});

test("interior depenetration never alters the velocity axis", () => {
	const player = circle(50, 55, 5, { x: 0, y: -5 });
	physics.handleCollision(player, rect);
	expect(player.getVel()).toEqual({ x: 0, y: -5 });
});

test("exterior collision still bounces a circle moving into the rect", () => {
	// Circle below the rect, moving up into the bottom edge.
	const player = circle(50, 64.9, 5, { x: 0, y: -1 });
	physics.handleCollision(player, rect);
	expect(player.getVel().y).toBeGreaterThan(0);
});

test("exterior collision keeps the depenetrated position for immovable rects", () => {
	const player = circle(50, 64.9, 5);
	physics.handleCollision(player, rect);
	expect(player.getPos()).toEqual({ x: 50, y: 65.01 });
});

test("finite-mass rects share a single mass-weighted depenetration", () => {
	const movable = new StructureRectangle(40, 40, 20, 20);
	movable.setMass(1);
	const player = circle(50, 55, 5);
	physics.handleCollision(player, movable);
	// invM1 = invM2 = 1, totalMove = 2 -> circle +1, rect -1 (single application).
	expect(player.getPos()).toEqual({ x: 50, y: 56 });
	expect(movable.getPos()).toEqual({ x: 40, y: 39 });
});

test("interior resolution is deterministic across repeated runs", () => {
	const runs: Array<{ x: number; y: number }> = [];
	for (let run = 0; run < 3; run++) {
		const player = circle(50, 50);
		physics.handleCollision(player, rect);
		runs.push({ ...player.getPos() });
	}
	expect(runs).toEqual([{ x: 48, y: 50 }, { x: 48, y: 50 }, { x: 48, y: 50 }]);
});

test("deep penetration resolves with strictly monotonic bounded iterations", () => {
	// The documented bounded iterative solver (2.0/tick clamp) must strictly
	// reduce the penetration on every resolving tick and finally leave the
	// circle non-overlapping with the rectangle (touching is not colliding:
	// the collision check uses strict `<`).
	const player = circle(50, 50);
	const edgeDistances: number[] = [];
	let guard = 0;
	while (physics.checkCollision(player, rect) && guard < 100) {
		const before = player.getPos().x;
		physics.handleCollision(player, rect);
		if (player.getPos().x === before) break; // touch-only: no resolution
		// Distance from the circle center to the left rect edge (exit axis).
		edgeDistances.push(player.getPos().x - 40);
		guard++;
	}
	expect(edgeDistances.length).toBeGreaterThan(1);
	for (let i = 1; i < edgeDistances.length; i++) {
		expect(edgeDistances[i]).toBeLessThan(edgeDistances[i - 1]);
	}
	// Final state: the circle edge no longer overlaps the rect interior
	// (touch is allowed; the resolver uses strict `<`), and the unrelated
	// axis never moved.
	const finalDistance = Math.abs(player.getPos().x - 40);
	expect(finalDistance).toBeGreaterThanOrEqual(10);
	expect(player.getPos().y).toBe(50);
	expect(player.getVel()).toEqual({ x: 0, y: 0 });
});
