import { test, describe } from 'node:test';
import assert from 'node:assert';
import { GameState, GameStateType } from "../src/engine/types.ts"
import { PhysicsSystem, PlaybackSystem } from "../src/systems/Systems.ts"
import { defaultPhysics } from '../src/physics/defaultPhysics.ts';
import { EntityManager } from "../src/entity/EntityManager.ts";
import { Player } from '../src/entity/entity.ts';
import { IGameContext } from '../src/systems/types.ts';

const createMockContext = (state: GameStateType) => ({
	state,
	entities: new EntityManager([
		new Player().new(({ x: 0, y: 0, id: "p1", size: 30 })),
	]),
	structures: []
} as IGameContext);

describe('Game State Machine & System Integration', () => {

	test('Sollte von SIMULATING zu YOUR_TURN wechseln, wenn Playback abgelaufen ist', () => {
		// 1. Setup
		const ctx = createMockContext(GameState.SIMULATING);
		const physics = new PhysicsSystem(new defaultPhysics());
		const playback = new PlaybackSystem();

		// Wir setzen das Playback auf genau 2 Frames
		playback.start(2, []);

		// 2. Erster Tick
		// Physik sollte rechnen, Playback dekrementiert
		physics.update(ctx, 16.66);
		playback.update(ctx, 16.66);

		// Orchestrator Logik (würde normalerweise im Handler stehen)
		if (playback.getRemainingFrames() <= 0) ctx.state = GameState.SIMULATING_DONE;

		assert.strictEqual(ctx.state, GameState.SIMULATING, "Sollte nach 1 Frame noch simulieren");
		assert.strictEqual(playback.getRemainingFrames(), 1);

		// 3. Zweiter Tick
		physics.update(ctx, 16.66);
		playback.update(ctx, 16.66);

		// Orchestrator Logik prüft erneut
		if (playback.getRemainingFrames() <= 0) ctx.state = GameState.YOUR_TURN;

		// 4. Prüfung
		assert.strictEqual(ctx.state, GameState.YOUR_TURN, "Sollte nach 2 Frames zu YOUR_TURN gewechselt haben");
		assert.strictEqual(playback.getRemainingFrames(), 0);
	});

	test('Physik darf nicht mehr rechnen, wenn State nicht SIMULATING ist', () => {
		const ctx = createMockContext(GameState.YOUR_TURN);
		let moveCalled = false;

		// Wir mocken eine Entity, um zu sehen ob update gerufen wird
		const mockEntity = new Player().new(({ x: 0, y: 0, id: "p1", size: 30 }))
		ctx.entities = new EntityManager([mockEntity]);

		const physics = new PhysicsSystem(new defaultPhysics());
		physics.update(ctx, 16.66);


		assert.strictEqual(moveCalled, false, "Physik-Update sollte im IDLE ignoriert werden");
	});
});
