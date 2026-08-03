import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { validateSystemSettingsList } from "../src/systems/systemSettings.ts";
import { UiSystem } from "../src/systems/UiSystem.ts";
import { DirectionArrow } from "../src/systems/DirectionArrow.ts";
import { EmitterSystem } from "../src/systems/Emitter.ts";

test("engine system snapshots round trip as JSON-identical data", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings()).build();
	const snapshot = handler.toSettings();
	const restored = new GameHandlerBuilder().fromSettings(JSON.parse(JSON.stringify(snapshot))).build();
	expect(restored.toSettings()).toEqual(snapshot);
});

test("system snapshot boundary rejects duplicates, unknown versions and executable state", () => {
	expect(() => validateSystemSettingsList([{ systemId: "core.physics", schemaVersion: 1, state: { fps: 1, contacts: [] } }, { systemId: "core.physics", schemaVersion: 1, state: { fps: 1, contacts: [] } }], ["core.physics", "core.physics"])).toThrow();
	expect(() => validateSystemSettingsList([{ systemId: "core.physics", schemaVersion: 2, state: {} }], ["core.physics"])).toThrow();
	expect(() => validateSystemSettingsList([{ systemId: "core.physics", schemaVersion: 1, state: { value: () => undefined } }], ["core.physics"])).toThrow();
});

test("mid-playback restored system graph reaches the uninterrupted snapshot", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings()).build();
	const actor = handler.getEntityManager().getEntities()[0];
	const finalState = handler.getEntityManager().toSettings();
	handler.playTurn({ actorId: actor.getId(), input: { angle: 0, power: 1 }, durationFrames: 3, finalState });
	handler.tick();
	const restored = new GameHandlerBuilder().fromSettings(JSON.parse(JSON.stringify(handler.toSettings()))).build();
	for (let frame = 0; frame < 4; frame++) { handler.tick(); restored.tick(); }
	expect(restored.toSettings()).toEqual(handler.toSettings());
});

test("registered browser adapters export only deterministic JSON state", () => {
	const ui = new UiSystem();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings())
		.addSystem(ui).addSystem(new DirectionArrow(ui)).addSystem(new EmitterSystem()).build();
	const snapshot = JSON.parse(JSON.stringify(handler.toSettings()));
	expect(new GameHandlerBuilder().fromSettings(snapshot).build().toSettings()).toEqual(snapshot);
});
