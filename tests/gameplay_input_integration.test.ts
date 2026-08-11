import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { GameState } from "../src/kore/runtime/types.ts";
import { ObjectEmitter } from "../src/emitter/ObjectEmitter.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { EmitterSystem } from "../src/systems/Emitter.ts";
import { UiSystem } from "../src/systems/UiSystem.ts";

function createInputFixture() {
	const ui = new UiSystem();
	const emitter = new ObjectEmitter();
	const active = new Player(createPlayerSettings({ id: "active", position: { x: 100, y: 100 }, team: [0] }));
	const inactive = new Player(createPlayerSettings({ id: "inactive", position: { x: 200, y: 100 }, team: [1] }));
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addPlayer(active)
		.addPlayer(inactive)
		.addSystem(ui)
		.addUIMouse(ui)
		.addSystem(new EmitterSystem(emitter))
		.build();
	return { handler, ui, emitter, active, inactive };
}

function drag(handler: ReturnType<typeof createInputFixture>["handler"], start: { x: number; y: number }, end: { x: number; y: number }) {
	handler.updateMouse(start.x, start.y);
	handler.handleMousePressed();
	handler.updateMouse(end.x, end.y);
	handler.handleMouseReleased();
}

/** Pointer position is serialized UI continuity, not authoritative gameplay. */
function gameplaySnapshot(handler: ReturnType<typeof createInputFixture>["handler"]): string {
	const settings = handler.toSettings();
	delete settings.systems;
	delete settings.systemOrder;
	return JSON.stringify(settings);
}

test("mouse input selects the active actor and submits one legal shot", () => {
	const { handler, active, emitter } = createInputFixture();
	drag(handler, { x: 100, y: 100 }, { x: 200, y: 100 });
	handler.tick();

	expect(emitter.getLastShot()).toEqual({ actorId: active.getId(), angle: 180, power: 10 });
	expect(handler.getState()).toBe(GameState.Waiting_for_server);
});

test("minimum drag power is legal and duplicate release cannot submit twice", () => {
	const { handler, emitter } = createInputFixture();
	drag(handler, { x: 100, y: 100 }, { x: 108, y: 100 });
	handler.tick();
	const firstShot = emitter.getLastShot();

	handler.handleMouseReleased();
	handler.tick();
	expect(firstShot?.power).toBe(0.8);
	expect(emitter.getLastShot()).toEqual(firstShot);
});

test("explicit aim and charge updates become one validated shot", () => {
	const { handler, ui, active, emitter } = createInputFixture();
	ui.setAimAngle(active.getId(), 270);
	ui.setChargePower(5);
	handler.tick();

	expect(emitter.getLastShot()).toEqual({ actorId: active.getId(), angle: 270, power: 5 });
});

test("inactive, dead, non-finite, blocked, and terminal input leaves the handler unchanged", () => {
	for (const scenario of ["inactive", "dead", "non-finite", "blocked", "terminal"] as const) {
		const { handler, active, inactive } = createInputFixture();
		if (scenario === "dead") active.setIsDead(true);
		if (scenario === "blocked") handler.setState(GameState.Playing);
		if (scenario === "terminal") handler.setState(GameState.Game_over);
		const before = gameplaySnapshot(handler);

		const actor = scenario === "inactive" ? inactive : active;
		const start = scenario === "non-finite" ? { x: Number.NaN, y: 100 } : actor.getPos();
		drag(handler, start, { x: start.x + 100, y: start.y });
		handler.tick();

		expect(gameplaySnapshot(handler)).toBe(before);
		expect(handler.getState()).toBe(scenario === "blocked" ? GameState.Playing : scenario === "terminal" ? GameState.Game_over : GameState.Your_turn);
	}
});
