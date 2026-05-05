import { test, describe } from 'node:test';
import assert from 'node:assert';
import { GameState, GameStateType } from "../src/engine/types.ts"
import { PhysicsSystem, PlaybackSystem } from "../src/systems/Systems.ts"
import { defaultPhysics } from '../src/physics/defaultPhysics.ts';
import { EntityManager } from "../src/entity/EntityManager.ts";
import { Player } from '../src/entity/entity.ts';
import { IGameContext } from '../src/systems/types.ts';

//@ts-ignore
const createMockContext = (state: GameStateType) => ({
	state,
	entities: new EntityManager([
		new Player().new(({ x: 0, y: 0, id: "p1", size: 30 })),
	]),
	structures: []
} as IGameContext);

/**
 * @test Game State Machine & System Integration
 * 
 * Diese Suite validiert das "Gehirn" des Spielablaufs. Sie prüft, ob die 
 * verschiedenen Systeme (Physik, Playback) harmonisch zusammenarbeiten und 
 * ob die Engine die Spielphasen korrekt wechselt.
 */
describe('Game State Machine & System Integration', () => {
	/**
		 * Test: Phasenübergang (Lifecycle).
		 * 
		 * Prüft, ob das System nach dem Abspielen einer Animation (Playback) 
		 * automatisch wieder bereit für Benutzereingaben (YOUR_TURN) ist.
		 * 
		 * Flow: SIMULATING -> [Tick 1] -> SIMULATING -> [Tick 2] -> YOUR_TURN
		 */
	test('Sollte von SIMULATING zu YOUR_TURN wechseln, wenn Playback abgelaufen ist', () => {
		const ctx = createMockContext(GameState.SIMULATING);
		const physics = new PhysicsSystem(new defaultPhysics());
		const playback = new PlaybackSystem();

		playback.start(2, []);

		physics.tick(ctx, 1, 1);
		playback.tick(ctx);

		if (playback.getRemainingFrames() <= 0) ctx.state = GameState.SIMULATING_DONE;

		assert.strictEqual(ctx.state, GameState.SIMULATING, "Sollte nach 1 Frame noch simulieren");
		assert.strictEqual(playback.getRemainingFrames(), 1);

		physics.tick(ctx, 1, 1);
		playback.tick(ctx);

		if (playback.getRemainingFrames() <= 0) ctx.state = GameState.YOUR_TURN;

		assert.strictEqual(ctx.state, GameState.YOUR_TURN, "Sollte nach 2 Frames zu YOUR_TURN gewechselt haben");
		assert.strictEqual(playback.getRemainingFrames(), 0);
	});

	/**
		 * Test: State-Guards (Sicherheitsregeln).
		 * 
		 * Einer der wichtigsten Performance- und Logik-Tests. 
		 * Er stellt sicher, dass die Physik-Engine "schläft", wenn der Spieler 
		 * gerade am Zug ist (YOUR_TURN). 
		 * 
		 * Ziel: CPU-Ressourcen sparen und verhindern, dass sich Objekte bewegen, 
		 * während der Spieler noch zielt.
		 */
	test('Physik darf nicht mehr rechnen, wenn State nicht SIMULATING ist', () => {
		const ctx = createMockContext(GameState.YOUR_TURN);
		let moveCalled = false;

		const mockEntity = new Player().new(({ x: 0, y: 0, id: "p1", size: 30 }))
		ctx.entities = new EntityManager([mockEntity]);

		const physics = new PhysicsSystem(new defaultPhysics());
		physics.tick(ctx, 1, 1);


		assert.strictEqual(moveCalled, false, "Physik-Update sollte im IDLE ignoriert werden");
	});
});
