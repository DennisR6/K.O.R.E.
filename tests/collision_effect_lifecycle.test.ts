import { describe, expect, test } from "bun:test";
import { EffectTrigger, EffectType } from "../src/effects/types.ts";
import { EffectGhostMode } from "../src/effects/ghostMode.ts";
import { EffectShield } from "../src/effects/shield.ts";
import { Player } from "../src/entity/Player.ts";
import { EntityManager } from "../src/entity/EntityManager.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";
import { DeadlyObstacleCirle } from "../src/structures/DeadlyObstacleCircle.ts";
import { StructureCircle } from "../src/structures/structureCircle.ts";
import { StructureRectangle } from "../src/structures/structureRectangle.ts";
import { PhysicsSystem } from "../src/systems/PhysicsSystem.ts";
import { NumericSystem } from "../src/systems/NumericSystem.ts";
import { MovementSystem } from "../src/systems/MovementSystem.ts";
import { ParticipationSystem } from "../src/systems/ParticipationSystem.ts";
import { dispatchPredefinedEffect } from "../src/systems/predefinedEffectDispatcher.ts";
import type { IGameContext } from "../src/systems/types.ts";

function context(entities: Player[], structures: any[] = []): IGameContext {
	const manager = new EntityManager();
	manager.addEntity(entities);
	const ctx = {
		entities: manager,
		structures,
		state: {} as any,
		turn: 0,
		activeTeam: 0,
		dt: 1,
		mouse: { turn: null },
		worldSize: { x: 800, y: 450 },
		physics: new defaultPhysics(),
		currTurn: 0,
		activeTeamNumber: 0,
		myTeamNumber: 0,
	};
	const systems = [new NumericSystem(), new MovementSystem(), new ParticipationSystem()];
	for (const entity of entities) entity.setNumericEffectDispatcher(effect => dispatchPredefinedEffect({ ctx, systems, effect }));
	return ctx;
}

function collisionDamage(damage: number) {
	return [{
		schemaVersion: 1 as const,
		type: EffectType.NumericAdd,
		typeValue: { stateId: "hp", amount: -damage },
		trigger: EffectTrigger.Collision,
		triggerValue: [],
	}];
}

describe("collision effect lifecycle (13.8)", () => {
	test("entry applies damage once, persistent contact is quiet, and re-entry applies once", () => {
		const attacker = new Player(createPlayerSettings({
			id: "attacker",
			position: { x: 0, y: 0 },
			size: 10,
			effects: collisionDamage(4),
		}));
		const target = new Player(createPlayerSettings({ id: "target", position: { x: 15, y: 0 }, size: 10 }));
		const ctx = context([attacker, target]);
		const system = new PhysicsSystem(new defaultPhysics());

		system.ticker(ctx, 1, 1);
		expect(target.getHP()).toBe(26);
		system.ticker(ctx, 1, 1);
		expect(target.getHP()).toBe(26);

		target.setPos({ x: 100, y: 0 });
		system.ticker(ctx, 1, 1);
		target.setPos({ x: 15, y: 0 });
		system.ticker(ctx, 1, 1);
		expect(target.getHP()).toBe(22);
	});

	test("same-geometry structures have independent contact identities", () => {
		const player = new Player(createPlayerSettings({ id: "player", position: { x: 0, y: 0 }, size: 5 }));
		const first = new StructureCircle(0, 0, 10, undefined, collisionDamage(2), "solid", "same-geometry-first");
		const second = new StructureCircle(0, 0, 10, undefined, collisionDamage(3), "solid", "same-geometry-second");
		const ctx = context([player], [first, second]);

		new PhysicsSystem(new defaultPhysics()).ticker(ctx, 1, 1);
		expect(player.getHP()).toBe(25);
	});

	test("CCD dispatches a deadly collision exactly once across all substeps", () => {
		class CountingDeadlyObstacle extends DeadlyObstacleCirle {
			public contacts = 0;
			public override onCollision({ entity }: any): void {
				this.contacts++;
				super.onCollision({ entity });
			}
		}
		const player = new Player(createPlayerSettings({ position: { x: 0, y: 50 }, size: 5, velocity: { x: 1000, y: 0 } }));
		const hazard = new CountingDeadlyObstacle(10, 50, 5, undefined, []);
		const ctx = context([player], [hazard]);
		const system = new PhysicsSystem(new defaultPhysics());

		player.setPos({ x: 16, y: 50 });
		system.ticker(ctx, 0.016, 1);
		expect(player.isDead()).toBe(true);
		expect(hazard.contacts).toBe(1);
	});

	test("shield and ghost collision adapters remain single-entry effects", () => {
		const shield = new EffectShield({ typeValue: { capacity: 3 } });
		const ghost = new EffectGhostMode({ typeValue: { durationTurns: 1 } });
		let collisionCallbacks = 0;
		const player = new Player(createPlayerSettings({ id: "shielded", position: { x: 0, y: 0 }, size: 10 }));
		player.onCollision = () => {
			collisionCallbacks++;
			if (!ghost.shouldIgnoreCollision()) player.dispatchNumericAdd("hp", -shield.absorbDamage(3));
		};
		const wall = new StructureCircle(15, 0, 10, undefined, [], "solid");
		const ctx = context([player], [wall]);
		const system = new PhysicsSystem(new defaultPhysics());

		system.ticker(ctx, 1, 1);
		system.ticker(ctx, 1, 1);
		expect(collisionCallbacks).toBe(1);
		expect(player.getHP()).toBe(30);
		expect(shield.getRemainingCapacity()).toBe(3);

		player.setPos({ x: 100, y: 0 });
		system.ticker(ctx, 1, 1);
		player.setPos({ x: 15, y: 0 });
		system.ticker(ctx, 1, 1);
		expect(collisionCallbacks).toBe(2);
		ghost.advanceTurn();
		player.setPos({ x: 100, y: 0 });
		system.ticker(ctx, 1, 1);
		player.setPos({ x: 15, y: 0 });
		system.ticker(ctx, 1, 1);
		expect(collisionCallbacks).toBe(3);
		expect(shield.getRemainingCapacity()).toBe(0);
		expect(player.getHP()).toBe(30);
	});

	test("simultaneous contacts each enter once and a fresh system has no stale object key", () => {
		const player = new Player(createPlayerSettings({ id: "player", position: { x: 0, y: 0 }, size: 5 }));
		const left = new StructureCircle(0, 0, 10, undefined, collisionDamage(2), "solid", "simultaneous-left");
		const right = new StructureCircle(0, 0, 10, undefined, collisionDamage(3), "solid", "simultaneous-right");
		const ctx = context([player], [left, right]);
		const firstSystem = new PhysicsSystem(new defaultPhysics());
		firstSystem.ticker(ctx, 1, 1);
		expect(player.getHP()).toBe(25);

		const restoredPlayer = new Player(player.toSettings());
		restoredPlayer.setPos({ x: 0, y: 0 });
		const restored = context([restoredPlayer], [
			new StructureCircle(0, 0, 10, undefined, collisionDamage(2), "solid", "simultaneous-left"),
			new StructureCircle(0, 0, 10, undefined, collisionDamage(3), "solid", "simultaneous-right"),
		]);
		new PhysicsSystem(new defaultPhysics()).ticker(restored, 1, 1);
		expect(restoredPlayer.getHP()).toBe(20);
	});

	test("a wall contact resolved in one tick does not retain a phantom lifecycle entry", () => {
		const player = new Player(createPlayerSettings({ id: "player", position: { x: 8, y: 5 }, size: 5 }));
		let contacts = 0;
		player.onCollision = () => { contacts++; };
		const wall = new StructureRectangle(10, 0, 10, 10);
		const ctx = context([player], [wall]);
		const system = new PhysicsSystem(new defaultPhysics());
		system.ticker(ctx, 1, 1);
		player.setPos({ x: 8, y: 5 });
		system.ticker(ctx, 1, 1);
		expect(contacts).toBe(2);
	});
});
