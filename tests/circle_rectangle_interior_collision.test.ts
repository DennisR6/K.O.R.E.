import { expect, test } from "bun:test";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";
import { StructureRectangle } from "../src/structures/structureRectangle.ts";

/**
 * Engine defect hardening 12.2 + physics contract 13.2: embedded
 * circle/rectangle collisions resolve deterministically through the nearest
 * rect edge. The old zero-distance fallback normal (always upward) is gone,
 * ties are documented (left, right, top, bottom), and a single resolution
 * call leaves the circle fully non-overlapping (minimum-translation exit)
 * without altering an unrelated velocity axis.
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
	// overlap = 10 + radius 10 = 20, totalMove = 20.01 -> x = 50 - 20.01.
	expect(player.getPos()).toEqual({ x: 29.99, y: 50 });
	expect(player.getVel()).toEqual({ x: 0, y: 0 });
});

test("exact center fully depenetrates in a single call and stays finite", () => {
	const player = circle(50, 50);
	physics.handleCollision(player, rect);
	const pos = player.getPos();
	// The circle edge must clear the rect (x + 10 <= 40 -> x <= 30).
	expect(pos.x).toBeLessThanOrEqual(30.01);
	expect(pos.y).toBe(50);
	expect(Number.isFinite(pos.x)).toBe(true);
	expect(Number.isFinite(pos.y)).toBe(true);
	// No second correction is required on the next tick: the circle is
	// already non-overlapping, so the follow-up call is a no-op.
	physics.handleCollision(player, rect);
	expect(player.getPos()).toEqual(pos);
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
	// invM1 = invM2 = 1, overlap = 5 + radius 5 = 10, totalMove = 10.01
	// -> circle +5.005, rect -5.005 (single weighted application).
	expect(player.getPos()).toEqual({ x: 50, y: 60.005 });
	expect(movable.getPos()).toEqual({ x: 40, y: 34.995 });
});

test("interior resolution is deterministic across repeated runs", () => {
	const runs: Array<{ x: number; y: number }> = [];
	for (let run = 0; run < 3; run++) {
		const player = circle(50, 50);
		physics.handleCollision(player, rect);
		runs.push({ ...player.getPos() });
	}
	expect(runs).toEqual([{ x: 29.99, y: 50 }, { x: 29.99, y: 50 }, { x: 29.99, y: 50 }]);
});

test("deep penetration resolves fully in a single bounded iteration", () => {
	// The documented full-resolution solver (physics contract 13.2) exits the
	// circle completely on the first resolving call: one call leaves the
	// circle non-overlapping, and no second correction is required on the
	// next tick (touching is not colliding: the check uses strict `<`).
	const player = circle(50, 50);
	const before = { ...player.getPos() };
	physics.handleCollision(player, rect);
	// overlap = 10 + radius 10 = 20 -> the full minimum translation 20.01.
	expect(player.getPos()).toEqual({ x: before.x - 20.01, y: 50 });
	// The next call is a strict no-op: the circle already cleared the rect.
	const settled = { ...player.getPos() };
	physics.handleCollision(player, rect);
	expect(player.getPos()).toEqual(settled);
	// Final state: the circle edge no longer overlaps the rect interior
	// (touch is allowed; the resolver uses strict `<`), and the unrelated
	// axis never moved.
	const finalDistance = Math.abs(player.getPos().x - 40);
	expect(finalDistance).toBeGreaterThanOrEqual(10);
	expect(player.getPos().y).toBe(50);
	expect(player.getVel()).toEqual({ x: 0, y: 0 });
});
