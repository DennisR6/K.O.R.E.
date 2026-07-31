import { EntityManager } from "../../src/entity/EntityManager.ts";
import { Player } from "../../src/entity/Player.ts";
import { createPlayerSettings } from "../../src/entity/types.ts";
import { defaultPhysics } from "../../src/physics/defaultPhysics.ts";
import { SHAPE } from "../../src/physics/physics.ts";
import { StructureRectangle } from "../../src/structures/structureRectangle.ts";
import { PhysicsSystem } from "../../src/systems/PhysicsSystem.ts";
import type { IGameContext } from "../../src/systems/types.ts";
import { SeededRandom } from "../../src/utils/random.ts";

export function physicsFuzzCaseCount(): number {
	const value = Number(process.env.PHYSICS_FUZZ_CASES ?? "100");
	return Number.isSafeInteger(value) && value > 0 ? value : 100;
}

function state(seed: number) {
	const random = new SeededRandom(seed);
	const player = (id: string, x: number) => new Player(createPlayerSettings({
		id,
		position: { x, y: 30 + random.nextInt(140) },
		velocity: { x: random.nextInt(81) - 40, y: random.nextInt(81) - 40 },
		size: 3 + random.nextInt(8),
		bouncyness: random.nextInt(2),
	}));
	// Keep generated bodies on opposite sides of the one thin wall. This still
	// exercises independent high-speed wall impacts without manufacturing an
	// unresolvable two-body/wall trap (covered explicitly by 13.5).
	return { players: [player(`p-${seed}-a`, 30 + random.nextInt(45)), player(`p-${seed}-b`, 120 + random.nextInt(45))], wall: new StructureRectangle(90, 20, 4, 160, "black", [], "solid") };
}

function context(players: Player[], wall: StructureRectangle): IGameContext {
	const entities = new EntityManager(); entities.addEntity(players);
	return { entities, structures: [wall], state: {} as any, turn: 0, activeTeam: 0, dt: 0.1, mouse: { turn: null }, worldSize: { x: 200, y: 200 }, physics: new defaultPhysics({ friction: 1, linearDrag: 0, stopThreshold: 0.01 }), currTurn: 0, activeTeamNumber: 0, myTeamNumber: 0 };
}

/** Runs a reproducible bounded physical scenario and returns its JSON state. */
export function runPhysicsFuzzCase(seed: number): string {
	const { players, wall } = state(seed);
	const system = new PhysicsSystem(new defaultPhysics({ friction: 1, linearDrag: 0, stopThreshold: 0.01 }));
	const ctx = context(players, wall);
	for (let tick = 0; tick < 8; tick++) {
		for (const player of players) {
			const p = player.getPos(), v = player.getVel();
			player.setPos({ x: p.x + v.x * 0.1, y: p.y + v.y * 0.1 });
		}
		try { system.ticker(ctx, 0.1, 1); } catch (error) {
			throw new Error(`physics fuzz seed=${seed} tick=${tick} players=${JSON.stringify(players.map(p => p.toSettings()))} wall=${JSON.stringify(wall.toSettings())}: ${error instanceof Error ? error.message : String(error)}`);
		}
		for (const player of players) {
			const p = player.getPos(), v = player.getVel();
			if (![p.x, p.y, v.x, v.y].every(Number.isFinite)) throw new Error(`physics fuzz seed=${seed} tick=${tick} non-finite state; reproduce: PHYSICS_FUZZ_CASES=1 PHYSICS_FUZZ_SEED=${seed} bun test tests/physics_fuzz.test.ts`);
		}
	}
	return JSON.stringify({ players: players.map(player => player.toSettings()), contacts: system.toSnapshotState(), shape: SHAPE.RECTANGLE });
}
