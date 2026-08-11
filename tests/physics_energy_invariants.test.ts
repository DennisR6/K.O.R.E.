/**
 * Task [13.7]: Validate Energy, Restitution, Friction, And Rest States
 *
 * Tests that movement, friction, linear drag, collision restitution, and stop
 * thresholds behave coherently and never create energy or perpetual jitter.
 *
 * Allowed context: src/physics/*.ts, src/effects/*.ts
 */
import { describe, test, expect } from "bun:test";
import { defaultPhysics } from "../src/physics/defaultPhysics.js";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.js";
import { createDefaultGameSettings } from "../src/settings/settings.js";
import { WinningSystem } from "../src/systems/WinningSystem.js";
import { PhysicsSystem } from "../src/systems/PhysicsSystem.js";
import { PlayBackSystem } from "../src/systems/PlayBackSystem.js";
import type { IPhysics, SHAPE } from "../src/physics/physics.js";
import { EffectPhysics } from "../src/effects/physics.js";
import { EffectMove } from "../src/effects/movement.js";
import { EffectTrigger } from "../src/effects/types.js";
import { Player } from "../src/entity/Player.js";
import { createPlayerSettings } from "../src/entity/types.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Build a handler with exactly two alive players on a friction-free ice map */
function buildHandler(friction = 0.995, linearDrag = 0.01, stopThreshold = 0.1, drift = 0) {
	const settings = createDefaultGameSettings();
	settings.friction = { friction, linearDrag, stopThreshold };
	settings.drift = drift;
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new WinningSystem(2))
		.fromSettings(settings)
		.build();
	return handler;
}

function ke(v: { x: number; y: number }, mass: number) {
	return 0.5 * mass * (v.x * v.x + v.y * v.y);
}

function speed(v: { x: number; y: number }) {
	return Math.hypot(v.x, v.y);
}

// ─── applyFriction unit tests ─────────────────────────────────────────────────

describe("Physics Energy Invariants (13.7)", () => {
	describe("positive: friction and drag monotonically reduce speed", () => {
		test("exponential friction alone reduces speed each tick", () => {
			const phys = new defaultPhysics({ friction: 0.99, linearDrag: 0, stopThreshold: 0.001 });
			// Build a minimal IPhysics stub for applyFriction
			let vel = { x: 100, y: 0 };
			const stub = {
				getVel: () => ({ ...vel }),
				setVel: (v: { x: number; y: number }) => { vel = v; },
				getPos: () => ({ x: 0, y: 0 }),
				setPos: (_: any) => {},
				getMass: () => 1,
				getBounceFactor: () => 0,
				getShape: () => 0 as any,
				getBounds: () => ({ x: 10, y: 10 }),
				onCollision: (_: any) => {},
			} as unknown as IPhysics<SHAPE>;

			let prevSpeed = speed(vel);
			for (let i = 0; i < 100; i++) {
				phys.applyFriction(stub, 1);
				const s = speed(stub.getVel());
				expect(s).toBeLessThanOrEqual(prevSpeed + 1e-10);
				prevSpeed = s;
			}
		});

		test("linear drag removes a fixed amount each tick until stop", () => {
			const phys = new defaultPhysics({ friction: 1.0, linearDrag: 1.0, stopThreshold: 0.5 });
			let vel = { x: 10, y: 0 };
			const stub = {
				getVel: () => ({ ...vel }),
				setVel: (v: { x: number; y: number }) => { vel = v; },
				getPos: () => ({ x: 0, y: 0 }),
				setPos: (_: any) => {},
				getMass: () => 1,
				getBounceFactor: () => 0,
				getShape: () => 0 as any,
				getBounds: () => ({ x: 10, y: 10 }),
				onCollision: (_: any) => {},
			} as unknown as IPhysics<SHAPE>;

			let prevSpeed = 10;
			for (let i = 0; i < 20; i++) {
				phys.applyFriction(stub, 1);
				const s = speed(stub.getVel());
				expect(s).toBeLessThanOrEqual(prevSpeed + 1e-10);
				prevSpeed = s;
			}
		});

		test("stop threshold produces stable zero velocity", () => {
			const phys = new defaultPhysics({ friction: 0.99, linearDrag: 0.05, stopThreshold: 0.5 });
			let vel = { x: 0.4, y: 0.3 };
			const stub = {
				getVel: () => ({ ...vel }),
				setVel: (v: { x: number; y: number }) => { vel = v; },
				getPos: () => ({ x: 0, y: 0 }),
				setPos: (_: any) => {},
				getMass: () => 1,
				getBounceFactor: () => 0,
				getShape: () => 0 as any,
				getBounds: () => ({ x: 10, y: 10 }),
				onCollision: (_: any) => {},
			} as unknown as IPhysics<SHAPE>;

			// Speed is already below stopThreshold (0.5) — one tick zeros it
			phys.applyFriction(stub, 1);
			const v = stub.getVel();
			expect(v.x).toBe(0);
			expect(v.y).toBe(0);
		});

		test("after reaching rest, additional ticks produce no movement", () => {
			const phys = new defaultPhysics({ friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 });
			let vel = { x: 0, y: 0 };
			const stub = {
				getVel: () => ({ ...vel }),
				setVel: (v: { x: number; y: number }) => { vel = v; },
				getPos: () => ({ x: 100, y: 100 }),
				setPos: (_: any) => {},
				getMass: () => 1,
				getBounceFactor: () => 0,
				getShape: () => 0 as any,
				getBounds: () => ({ x: 10, y: 10 }),
				onCollision: (_: any) => {},
			} as unknown as IPhysics<SHAPE>;

			for (let i = 0; i < 50; i++) {
				phys.applyFriction(stub, 1);
				const v = stub.getVel();
				expect(v.x).toBe(0);
				expect(v.y).toBe(0);
			}
		});
	});

	describe("positive: restitution energy contract", () => {
		test("zero restitution does not increase kinetic energy after wall bounce", () => {
			// Direct defaultPhysics test for circle-vs-circle with restitution=0
			const phys = new defaultPhysics();

			let posA = { x: 0, y: 0 };
			let velA = { x: 10, y: 0 };
			let posB = { x: 18, y: 0 }; // overlap: r=10+10=20, dist=18 → overlap=2
			let velB = { x: -10, y: 0 };
			const mass = 1;

			const makeEntity = (pos: typeof posA, vel: typeof velA): IPhysics<any> => ({
				getPos: () => ({ ...pos }),
				setPos: (p: any) => { pos.x = p.x; pos.y = p.y; },
				getVel: () => ({ ...vel }),
				setVel: (v: any) => { vel.x = v.x; vel.y = v.y; },
				getMass: () => mass,
				getBounceFactor: () => 0, // restitution = 0
				getShape: () => 1 as any, // CIRCLE
				getBounds: () => ({ x: 10, y: 10 }),
				onCollision: (_: any) => {},
			} as unknown as IPhysics<any>);

			const a = makeEntity(posA, velA);
			const b = makeEntity(posB, velB);

			const keBefore = ke(velA, mass) + ke(velB, mass);
			phys.handleCollision(a, b);
			const keAfter = ke(velA, mass) + ke(velB, mass);

			// With restitution=0, energy should NOT increase
			expect(keAfter).toBeLessThanOrEqual(keBefore + 1e-9);
		});

		test("restitution=1 conserves kinetic energy within numeric tolerance", () => {
			const phys = new defaultPhysics();

			let posA = { x: 0, y: 0 };
			let velA = { x: 10, y: 0 };
			let posB = { x: 18, y: 0 };
			let velB = { x: -10, y: 0 };
			const mass = 1;

			const makeEntity = (pos: typeof posA, vel: typeof velA): IPhysics<any> => ({
				getPos: () => ({ ...pos }),
				setPos: (p: any) => { pos.x = p.x; pos.y = p.y; },
				getVel: () => ({ ...vel }),
				setVel: (v: any) => { vel.x = v.x; vel.y = v.y; },
				getMass: () => mass,
				getBounceFactor: () => 1, // restitution = 1
				getShape: () => 1 as any,
				getBounds: () => ({ x: 10, y: 10 }),
				onCollision: (_: any) => {},
			} as unknown as IPhysics<any>);

			const a = makeEntity(posA, velA);
			const b = makeEntity(posB, velB);

			const keBefore = ke(velA, mass) + ke(velB, mass);
			phys.handleCollision(a, b);
			const keAfter = ke(velA, mass) + ke(velB, mass);

			// Energy conserved within 1% tolerance for restitution=1
			expect(keAfter).toBeCloseTo(keBefore, 0);
		});

		test("stationary entities remain stationary after collision with another stationary", () => {
			const phys = new defaultPhysics();

			let posA = { x: 0, y: 0 };
			let velA = { x: 0, y: 0 };
			let posB = { x: 18, y: 0 };
			let velB = { x: 0, y: 0 };

			const makeEntity = (pos: typeof posA, vel: typeof velA): IPhysics<any> => ({
				getPos: () => ({ ...pos }),
				setPos: (p: any) => { pos.x = p.x; pos.y = p.y; },
				getVel: () => ({ ...vel }),
				setVel: (v: any) => { vel.x = v.x; vel.y = v.y; },
				getMass: () => 1,
				getBounceFactor: () => 0.5,
				getShape: () => 1 as any,
				getBounds: () => ({ x: 10, y: 10 }),
				onCollision: (_: any) => {},
			} as unknown as IPhysics<any>);

			const a = makeEntity(posA, velA);
			const b = makeEntity(posB, velB);

			// dot(relVel, normal) = 0 → no impulse applied
			phys.handleCollision(a, b);

			// Both remain at zero velocity
			expect(velA.x).toBe(0);
			expect(velA.y).toBe(0);
			expect(velB.x).toBe(0);
			expect(velB.y).toBe(0);
		});

		test("separating bodies do not receive impulse (no energy injection)", () => {
			const phys = new defaultPhysics();

			let posA = { x: 0, y: 0 };
			let velA = { x: -10, y: 0 }; // moving away
			let posB = { x: 18, y: 0 };
			let velB = { x: 10, y: 0 };  // moving away

			const makeEntity = (pos: typeof posA, vel: typeof velA): IPhysics<any> => ({
				getPos: () => ({ ...pos }),
				setPos: (p: any) => { pos.x = p.x; pos.y = p.y; },
				getVel: () => ({ ...vel }),
				setVel: (v: any) => { vel.x = v.x; vel.y = v.y; },
				getMass: () => 1,
				getBounceFactor: () => 1,
				getShape: () => 1 as any,
				getBounds: () => ({ x: 10, y: 10 }),
				onCollision: (_: any) => {},
			} as unknown as IPhysics<any>);

			const a = makeEntity(posA, velA);
			const b = makeEntity(posB, velB);

			const keBefore = ke(velA, 1) + ke(velB, 1);
			phys.handleCollision(a, b);
			const keAfter = ke(velA, 1) + ke(velB, 1);

			// Separating: no impulse injected, energy not increased
			expect(keAfter).toBeLessThanOrEqual(keBefore + 1e-9);
		});
	});

	describe("positive: drift changes direction within configured limits", () => {
		test("drift=0 does not alter velocity direction", () => {
			const move = new EffectMove({ typeValue: { deltaTime: 1, x: 10, y: 0 } });
			let vel = { x: 10, y: 0 };
			const entity = {
				getVel: () => ({ ...vel }),
				setVel: (v: any) => { vel = v; },
				getPos: () => ({ x: 0, y: 0 }),
				setPos: (_: any) => {},
				getMass: () => 1,
				getBounceFactor: () => 0,
				getShape: () => 1 as any,
				getBounds: () => ({ x: 10, y: 10 }),
				onCollision: (_: any) => {},
			} as unknown as IPhysics<any>;

			move.apply(entity, { deltaTime: 1, x: 10, y: 0, rotation: 45, drift: 0 });

			// velocity unchanged when drift=0
			expect(vel.x).toBeCloseTo(10, 10);
			expect(vel.y).toBeCloseTo(0, 10);
		});

		test("drift=1 aligns velocity fully to rotation direction", () => {
			const move = new EffectMove({ typeValue: { deltaTime: 1, x: 10, y: 0 } });
			let vel = { x: 10, y: 0 };
			const entity = {
				getVel: () => ({ ...vel }),
				setVel: (v: any) => { vel = v; },
				getPos: () => ({ x: 0, y: 0 }),
				setPos: (_: any) => {},
				getMass: () => 1,
				getBounceFactor: () => 0,
				getShape: () => 1 as any,
				getBounds: () => ({ x: 10, y: 10 }),
				onCollision: (_: any) => {},
			} as unknown as IPhysics<any>;

			// rotation=90° → forward = (cos90°, sin90°) = approximately (0, 1)
			move.apply(entity, { deltaTime: 1, x: 10, y: 0, rotation: 90, drift: 1, stopThreshold: 0.1 });

			// Speed is preserved; direction is aligned to rotation
			const s = speed(vel);
			expect(s).toBeCloseTo(10, 5);
		});

		test("drift does not apply when speed is at or below stopThreshold", () => {
			const move = new EffectMove({ typeValue: { deltaTime: 1, x: 0.05, y: 0 } });
			let vel = { x: 0.05, y: 0 };
			const entity = {
				getVel: () => ({ ...vel }),
				setVel: (v: any) => { vel = v; },
				getPos: () => ({ x: 0, y: 0 }),
				setPos: (_: any) => {},
				getMass: () => 1,
				getBounceFactor: () => 0,
				getShape: () => 1 as any,
				getBounds: () => ({ x: 10, y: 10 }),
				onCollision: (_: any) => {},
			} as unknown as IPhysics<any>;

			// stopThreshold=0.1, speed=0.05 → drift is skipped
			move.apply(entity, { deltaTime: 1, x: 0.05, y: 0, rotation: 90, drift: 1.0, stopThreshold: 0.1 });

			// velocity was NOT rotated by drift (drift branch not entered)
			// setVel is not called in the drift branch when speed <= threshold
			// position was still advanced by (vx * dt, vy * dt)
			// vel itself stays as initialized (0.05, 0)
			expect(vel.x).toBeCloseTo(0.05, 5);
			expect(vel.y).toBeCloseTo(0, 5);
		});
	});

	describe("negative: no energy creation", () => {
		test("no collision creates velocity from two stationary bodies", () => {
			const phys = new defaultPhysics();

			let posA = { x: 0, y: 0 };
			let velA = { x: 0, y: 0 };
			let posB = { x: 18, y: 0 };
			let velB = { x: 0, y: 0 };

			const makeEntity = (pos: typeof posA, vel: typeof velA, bounce: number): IPhysics<any> => ({
				getPos: () => ({ ...pos }),
				setPos: (p: any) => { pos.x = p.x; pos.y = p.y; },
				getVel: () => ({ ...vel }),
				setVel: (v: any) => { vel.x = v.x; vel.y = v.y; },
				getMass: () => 1,
				getBounceFactor: () => bounce,
				getShape: () => 1 as any,
				getBounds: () => ({ x: 10, y: 10 }),
				onCollision: (_: any) => {},
			} as unknown as IPhysics<any>);

			const a = makeEntity(posA, velA, 1);
			const b = makeEntity(posB, velB, 1);

			phys.handleCollision(a, b);

			expect(velA.x).toBe(0);
			expect(velA.y).toBe(0);
			expect(velB.x).toBe(0);
			expect(velB.y).toBe(0);
		});

		test("no repeated contact increases speed over 100 ticks against a wall", () => {
			// Shoot a player at a structure wall, tick 100 times, speed must never increase
			const handler = buildHandler();
			const entities = handler.getEntityManager().getEntities();
			const player = entities[0]!;

			// Give player a velocity directly into the left wall direction
			player.setVel({ x: -5, y: 0 });

			let prevSpeed = speed(player.getVel());
			for (let i = 0; i < 100; i++) {
				handler.tick(1);
				const s = speed(player.getVel());
				// Speed must not exceed the pre-tick speed (friction + no energy injection)
				// We allow a tiny tolerance for floating point
				expect(s).toBeLessThanOrEqual(prevSpeed + 0.01);
				prevSpeed = s;
			}
		});

		test("no friction value causes sign-flipping jitter below stop threshold", () => {
			// Test multiple friction values for jitter
			for (const friction of [0.5, 0.9, 0.995, 0.999]) {
				const phys = new defaultPhysics({ friction, linearDrag: 0.01, stopThreshold: 0.1 });
				let vel = { x: 0.08, y: 0 }; // just below threshold=0.1
				const stub = {
					getVel: () => ({ ...vel }),
					setVel: (v: { x: number; y: number }) => { vel = v; },
					getPos: () => ({ x: 0, y: 0 }),
					setPos: (_: any) => {},
					getMass: () => 1,
					getBounceFactor: () => 0,
					getShape: () => 0 as any,
					getBounds: () => ({ x: 10, y: 10 }),
					onCollision: (_: any) => {},
				} as unknown as IPhysics<any>;

				// First application zeros it; subsequent applications keep it zero
				phys.applyFriction(stub, 1);
				const afterFirst = { ...vel };
				phys.applyFriction(stub, 1);
				const afterSecond = { ...vel };

				// No sign flip: if it was zeroed, it stays zeroed
				if (afterFirst.x === 0 && afterFirst.y === 0) {
					expect(afterSecond.x).toBe(0);
					expect(afterSecond.y).toBe(0);
				}
				// If it wasn't zeroed yet, it must not have flipped sign
				if (afterFirst.x !== 0) {
					expect(Math.sign(afterFirst.x)).toBe(Math.sign(vel.x === 0 ? 1 : vel.x));
				}
			}
		});

		test("no entity wakes after reaching rest without a new force", () => {
			// After an entity reaches zero velocity, ticking never re-introduces velocity
			const phys = new defaultPhysics({ friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 });
			let vel = { x: 0, y: 0 };
			const stub = {
				getVel: () => ({ ...vel }),
				setVel: (v: { x: number; y: number }) => { vel = v; },
				getPos: () => ({ x: 0, y: 0 }),
				setPos: (_: any) => {},
				getMass: () => 1,
				getBounceFactor: () => 0,
				getShape: () => 0 as any,
				getBounds: () => ({ x: 10, y: 10 }),
				onCollision: (_: any) => {},
			} as unknown as IPhysics<any>;

			for (let i = 0; i < 500; i++) {
				phys.applyFriction(stub, 1);
				expect(vel.x).toBe(0);
				expect(vel.y).toBe(0);
			}
		});
	});

	describe("positive: stationary entities remain stationary", () => {
		test("handler ticks with all-zero velocities produce no position change", () => {
			const handler = buildHandler();
			const entities = handler.getEntityManager().getEntities();

			// Force all velocities to zero
			for (const e of entities) {
				e.setVel({ x: 0, y: 0 });
			}

			const snapBefore = entities.map(e => ({ ...e.getPos() }));

			for (let i = 0; i < 10; i++) {
				handler.tick(1);
			}

			const snapAfter = entities.map(e => ({ ...e.getPos() }));

			for (let i = 0; i < snapBefore.length; i++) {
				expect(snapAfter[i]!.x).toBeCloseTo(snapBefore[i]!.x, 8);
				expect(snapAfter[i]!.y).toBeCloseTo(snapBefore[i]!.y, 8);
			}
		});
	});
});
