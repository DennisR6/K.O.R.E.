import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { validateSystemSettingsList } from "../src/systems/systemSettings.ts";

test("engine system snapshots round trip as JSON-identical data", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings()).build();
	const snapshot = handler.toSettings();
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(JSON.parse(JSON.stringify(snapshot))).build();
	expect(restored.toSettings()).toEqual(snapshot);
});

test("system snapshot boundary rejects duplicates, unknown versions and executable state", () => {
	expect(() => validateSystemSettingsList([{ systemId: "core.physics", schemaVersion: 1, state: { fps: 1, contacts: [] } }, { systemId: "core.physics", schemaVersion: 1, state: { fps: 1, contacts: [] } }], ["core.physics", "core.physics"])).toThrow();
	expect(() => validateSystemSettingsList([{ systemId: "core.physics", schemaVersion: 2, state: {} }], ["core.physics"])).toThrow();
	expect(() => validateSystemSettingsList([{ systemId: "core.physics", schemaVersion: 1, state: { value: () => undefined } }], ["core.physics"])).toThrow();
});
