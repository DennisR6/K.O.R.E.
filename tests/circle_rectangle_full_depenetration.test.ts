import { describe, expect, test } from "bun:test";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";
import { SHAPE } from "@coffeemakerstudio/bean";
import { StructureRectangle } from "../src/structures/structureRectangle.ts";
import { PhysicsSystem } from "../src/systems/PhysicsSystem.ts";

/**
 * Section 13.2 - fully resolve embedded circle and rectangle contacts.
 *
 * A single `handleCollision` call resolves an embedded circle/rectangle
 * contact with the complete deterministic minimum translation (overlap +
 * 0.01): the circle leaves the rectangle non-overlapping, the minimum valid
 * exit axis is selected, equal-distance ties follow the documented stable
 * order (left, right, top, bottom), no arbitrary negative-Y fallback exists,
 * and no second correction is required on the next tick. Velocity axes
 * unrelated to the contact remain unchanged.
 *
 * Set `DEPENETRATION_LONG=1` to run the opt-in long sweep suite.
 */

const LONG = process.env.DEPENETRATION_LONG === "1";
const physics = new defaultPhysics();
/** 20x20 rect at (40,40): x 40..60, y 40..60. */
const rect = new StructureRectangle(40, 40, 20, 20);

function circle(x: number, y: number, size = 10, velocity = { x: 0, y: 0 }) {
	return new Player(createPlayerSettings({ position: { x, y }, size, velocity }));
}

function expectNonOverlapping(player: Player, rectangle: StructureRectangle) {
	expect(physics.checkCollision(player, rectangle as never)).toBe(false);
}

/** One embedded circle -> full exit at `to` after a single call. */
function expectFullExit(from: { x: number; y: number }, to: { x: number; y: number }, size = 5) {
	const player = circle(from.x, from.y, size);
	physics.handleCollision(player, rect);
	expect(player.getPos()).toEqual(to);
	expect(player.getVel()).toEqual({ x: 0, y: 0 });
	expectNonOverlapping(player, rect);
}

describe("full circle/rectangle depenetration (13.2)", () => {
	// Nearest-edge exits: left, right, top, bottom.
	const exits: Array<{ from: { x: number; y: number }; to: { x: number; y: number }; name: string }> = [
		{ name: "nearest-left", from: { x: 45, y: 50 }, to: { x: 34.99, y: 50 } },
		{ name: "nearest-right", from: { x: 55, y: 50 }, to: { x: 65.01, y: 50 } },
		{ name: "nearest-top", from: { x: 50, y: 45 }, to: { x: 50, y: 34.99 } },
		{ name: "nearest-bottom", from: { x: 50, y: 55 }, to: { x: 50, y: 65.01 } },
	];
	for (const c of exits) {
		test(`positive: ${c.name} exit resolves fully in one call`, () => expectFullExit(c.from, c.to));
	}

	// Ties use the documented stable order: left, right, top, bottom.
	const ties: Array<{ from: { x: number; y: number }; to: { x: number; y: number }; name: string }> = [
		{ name: "exact-center four-way tie exits left", from: { x: 50, y: 50 }, to: { x: 29.99, y: 50 } }, // size 10
		{ name: "left/top tie exits left", from: { x: 45, y: 45 }, to: { x: 34.99, y: 45 } },
		{ name: "right/bottom tie exits right", from: { x: 55, y: 55 }, to: { x: 65.01, y: 55 } },
		{ name: "right/top tie exits right", from: { x: 55, y: 45 }, to: { x: 65.01, y: 45 } },
		{ name: "left/bottom tie exits left", from: { x: 45, y: 55 }, to: { x: 34.99, y: 55 } },
	];
	for (const c of ties) {
		test(`positive: ${c.name}`, () => expectFullExit(c.from, c.to, c.name.startsWith("exact-center") ? 10 : 5));
	}

	test("positive: top/bottom tie with larger sides exits top", () => {
		const wide = new StructureRectangle(40, 40, 30, 20);
		const player = circle(55, 50, 5);
		physics.handleCollision(player, wide);
		// top = bottom = 10, left = right = 15 -> top wins, overlap 10 + 5.
		expect(player.getPos()).toEqual({ x: 55, y: 34.99 });
		expectNonOverlapping(player, wide);
	});

	test("positive: exterior edge penetration depenetrates fully outwards and bounces", () => {
		const resting = circle(50, 64.9, 5);
		physics.handleCollision(resting, rect);
		expect(resting.getPos()).toEqual({ x: 50, y: 65.01 });
		expectNonOverlapping(resting, rect);

		const moving = circle(50, 64.9, 5, { x: 3, y: -1 });
		physics.handleCollision(moving, rect);
		expect(moving.getPos()).toEqual({ x: 50, y: 65.01 });
		expect(moving.getVel().y).toBeGreaterThan(0);
		expect(moving.getVel().x).toBe(3);
	});

	test("positive: finite-mass rect shares a single mass-weighted depenetration", () => {
		const movable = new StructureRectangle(40, 40, 20, 20);
		movable.setMass(1);
		const player = circle(50, 55, 5);
		physics.handleCollision(player, movable);
		expect(player.getPos()).toEqual({ x: 50, y: 60.005 }); // circle +5.005
		expect(movable.getPos()).toEqual({ x: 40, y: 34.995 }); // rect -5.005
		expectNonOverlapping(player, movable);
	});

	test("positive: immovable rect stays put while the circle exits fully", () => {
		const player = circle(50, 50);
		const before = { x: rect.getPos().x, y: rect.getPos().y };
		physics.handleCollision(player, rect);
		expect(rect.getPos()).toEqual(before);
		expect(player.getPos()).toEqual({ x: 29.99, y: 50 });
		expectNonOverlapping(player, rect);
	});

	test("negative: deep embedding cannot remain after a single physics tick", () => {
		const player = circle(50, 50);
		expect(physics.checkCollision(player, rect as never)).toBe(true);
		physics.handleCollision(player, rect);
		expectNonOverlapping(player, rect);
	});

	test("negative: the resolver cannot oscillate between edges", () => {
		const player = circle(50, 50);
		physics.handleCollision(player, rect);
		const settled = { x: player.getPos().x, y: player.getPos().y };
		physics.handleCollision(player, rect);
		physics.handleCollision(player, rect);
		expect(player.getPos()).toEqual(settled);
		expect(player.getVel()).toEqual({ x: 0, y: 0 });
	});

	test("negative: correction never moves the circle farther into the rectangle", () => {
		for (const [x, y] of [[45, 50], [55, 50], [50, 45], [50, 55], [50, 50]] as const) {
			const player = circle(x, y, 5);
			physics.handleCollision(player, rect);
			expectNonOverlapping(player, rect);
		}
	});

	test("negative: velocity axes unrelated to the contact remain unchanged", () => {
		const player = circle(50, 55, 5, { x: 4, y: 0 });
		physics.handleCollision(player, rect);
		expect(player.getVel()).toEqual({ x: 4, y: 0 });
		expect(player.getPos()).toEqual({ x: 50, y: 65.01 });
	});

	test("negative: containment rectangles never invoke this solver", () => {
		const body = {
			pos: { x: 100, y: 100 },
			vel: { x: 0, y: 0 },
			getShape: () => SHAPE.CIRCLE,
			getPos: () => body.pos,
			setPos: (p: { x: number; y: number }) => { body.pos = p; },
			getVel: () => body.vel,
			setVel: (v: { x: number; y: number }) => { body.vel = v; },
			getBounds: () => ({ x: 20, y: 20 }),
			getMass: () => 1,
			getBounceFactor: () => 0,
			onCollision: () => { throw new Error("containment fired a collision"); },
			physicsEnabled: () => true,
			isDead: () => false,
		};
		const containment = new StructureRectangle(0, 0, 200, 200, undefined, [], "containment");

		let handledPairs = 0;
		const countingStrategy = new defaultPhysics();
		const originalHandle = countingStrategy.handleCollision.bind(countingStrategy);
		countingStrategy.handleCollision = ((a: never, b: never) => {
			handledPairs++;
			expect(a).not.toBe(containment);
			expect(b).not.toBe(containment);
			return originalHandle(a, b);
		}) as never;

		const system = new PhysicsSystem(countingStrategy);
		const ctx = { entities: { getEntities: () => [body] }, structures: [containment] } as never;
		system.ticker(ctx, 1, 0);
		// The deeply embedded circle was never paired with the containment
		// rect: no resolution ran and the position stayed untouched.
		expect(handledPairs).toBe(0);
		expect(body.pos).toEqual({ x: 100, y: 100 });
	});

	// Opt-in long sweeps: DEPENETRATION_LONG=1 bun test ...
	describe.skipIf(!LONG)("opt-in long sweep suite (DEPENETRATION_LONG=1)", () => {
		test("long: every interior position on a grid exits non-overlapping in one call", () => {
			for (let x = 41; x < 60; x += 2) {
				for (let y = 41; y < 60; y += 2) {
					const player = circle(x, y, 5);
					physics.handleCollision(player, rect);
					expectNonOverlapping(player, rect);
				}
			}
		});

		test("long: 1000 ticks after resolution never oscillate or move the circle", () => {
			const player = circle(50, 50);
			physics.handleCollision(player, rect);
			const settled = { x: player.getPos().x, y: player.getPos().y };
			for (let i = 0; i < 1000; i++) {
				physics.handleCollision(player, rect);
				expect(player.getPos()).toEqual(settled);
			}
		});

		test("long: repeated identical resolutions are bit-identical", () => {
			const runs: Array<{ x: number; y: number }> = [];
			for (let run = 0; run < 200; run++) {
				const player = circle(50, 50);
				physics.handleCollision(player, rect);
				runs.push({ ...player.getPos() });
			}
			expect(runs.every(r => r.x === runs[0]!.x && r.y === runs[0]!.y)).toBe(true);
		});
	});
});
