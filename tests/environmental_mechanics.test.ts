import { expect, test } from "bun:test";
import { validateMapDocument, loadMapDocument } from "../src/contracts/documents.ts";
import { kore } from "../src/kore/sdk/index.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { EnvironmentalSystem } from "../src/systems/EnvironmentalSystem.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { SHAPE } from "@coffeemakerstudio/bean";
import { FullStructure } from "../src/structures/fullStructure.ts";

const structure = { type: SHAPE.RECTANGLE as SHAPE.RECTANGLE, x: 10, y: 10, w: 20, h: 20, effects: [] };

test("KORE authors versioned environmental mechanics and canonical map conversion", () => {
	const map = kore.createDefaultMap({ id: "environmental-test", worldSize: { x: 100, y: 100 } })
		.addPlayerSpawn({ teamNr: 0, x: 10, y: 40, w: 20, h: 20, playerCount: 1 })
		.addPlayerSpawn({ teamNr: 1, x: 70, y: 40, w: 20, h: 20, playerCount: 1 })
		.addTimedHazard({ id: "pulse", structure, startTick: 1, intervalTicks: 4, durationTicks: 2 })
		.addTriggeredZone({ id: "alarm", structure: { ...structure, x: 40 }, triggerZone: { x: 50, y: 50, r: 5 }, durationTicks: 2 })
		.addForceField({ id: "field", structure: { ...structure, x: 65 } })
		.addMovingStructure({ id: "gate", structure: { ...structure, x: 30 }, to: { x: 60, y: 10 }, periodTicks: 4 })
		.addEnvironmentalCycle({ id: "cycle", structure: { ...structure, x: 80 }, phases: [{ durationTicks: 2, enabled: true }, { durationTicks: 2, enabled: false }] });
	const document = map.buildMapDocument();
	validateMapDocument(document);
	expect(document.environmentalMechanics?.map(mechanic => mechanic.id)).toEqual(["pulse", "alarm", "field", "gate", "cycle"]);
	const settings = map.build();
	expect(settings.environmentalMechanics?.length).toBe(5);
	expect(settings.mapBoundarys.length).toBe(1 + 5);
	const loaded = loadMapDocument(document, createDefaultGameSettings(2, 1));
	expect(loaded.environmentalMechanics?.length).toBe(5);
	expect(loaded.mapBoundarys.length).toBe(document.arenaGeometry.length + document.environmentalMechanics!.length);
});

test("environmental lifecycle is tick deterministic and snapshot-restorable", () => {
	const mechanic = { schemaVersion: 1 as const, id: "pulse", type: "timed-hazard" as const, structure, startTick: 1, intervalTicks: 4, durationTicks: 2 };
	const first = kore.createDefaultMap({ id: "environmental-runtime", worldSize: { x: 100, y: 100 } })
		.addPlayerSpawn({ teamNr: 0, x: 10, y: 40, w: 20, h: 20, playerCount: 1 })
		.addPlayerSpawn({ teamNr: 1, x: 70, y: 40, w: 20, h: 20, playerCount: 1 })
		.addTimedHazard(mechanic).build();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(first).build();
	const environmental = handler.getSystems().find(system => system instanceof EnvironmentalSystem) as EnvironmentalSystem;
	const initialEnvironmentalState = handler.toSettings().systems?.find(system => system.systemId === "core.environmental");
	expect(initialEnvironmentalState?.state).toHaveProperty("structureIds");
	expect(initialEnvironmentalState?.state).not.toHaveProperty("structureIndexes");
	handler.tick();
	const snapshot = handler.toSettings();
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();
	expect(restored.toSettings().systems?.find(system => system.systemId === "core.environmental")).toEqual(handler.toSettings().systems?.find(system => system.systemId === "core.environmental"));
	handler.tick();
	restored.tick();
	expect(restored.toSettings().systems?.find(system => system.systemId === "core.environmental")).toEqual(handler.toSettings().systems?.find(system => system.systemId === "core.environmental"));
	expect(environmental.toSettings().state).toHaveProperty("tick", 2);
});

test("environmental references resolve by Structure ID after map reorder", () => {
	const settings = kore.createDefaultMap({ id: "environmental-reorder", worldSize: { x: 100, y: 100 } })
		.addPlayerSpawn({ teamNr: 0, x: 10, y: 40, w: 20, h: 20, playerCount: 1 })
		.addPlayerSpawn({ teamNr: 1, x: 70, y: 40, w: 20, h: 20, playerCount: 1 })
		.addTimedHazard({ id: "pulse", structure, startTick: 1, intervalTicks: 4, durationTicks: 2 }).build();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const snapshot = handler.toSettings();
	const reordered = { ...snapshot, mapBoundarys: [...snapshot.mapBoundarys].reverse() };
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(reordered).build();
	handler.tick();
	restored.tick();
	const expected = handler.toSettings().systems?.find(system => system.systemId === "core.environmental");
	const actual = restored.toSettings().systems?.find(system => system.systemId === "core.environmental");
	expect(actual).toEqual(expected);
});

test("environmental references survive dynamic Structure insertion", () => {
	const settings = kore.createDefaultMap({ id: "environmental-insertion", worldSize: { x: 100, y: 100 } })
		.addPlayerSpawn({ teamNr: 0, x: 10, y: 40, w: 20, h: 20, playerCount: 1 })
		.addPlayerSpawn({ teamNr: 1, x: 70, y: 40, w: 20, h: 20, playerCount: 1 })
		.addTimedHazard({ id: "pulse", structure, startTick: 1, intervalTicks: 4, durationTicks: 2 }).build();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const targetId = settings.environmentalMechanics![0]!.structure.id!;
	handler.getContext().structures.unshift(new FullStructure({ id: "inserted", type: SHAPE.RECTANGLE, x: 0, y: 0, w: 2, h: 2, effects: [] }));
	handler.tick();
	expect(handler.getContext().structures.find(candidate => candidate.getId() === targetId)?.physicsEnabled()).toBe(true);
});

test("missing environmental Structure IDs fail deterministically instead of retargeting", () => {
	const settings = kore.createDefaultMap({ id: "environmental-missing", worldSize: { x: 100, y: 100 } })
		.addPlayerSpawn({ teamNr: 0, x: 10, y: 40, w: 20, h: 20, playerCount: 1 })
		.addPlayerSpawn({ teamNr: 1, x: 70, y: 40, w: 20, h: 20, playerCount: 1 })
		.addTimedHazard({ id: "pulse", structure, startTick: 1, intervalTicks: 4, durationTicks: 2 }).build();
	const snapshot = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build().toSettings();
	snapshot.systems = snapshot.systems!.map(system => system.systemId === "core.environmental" ? { ...system, state: { ...system.state, structureIds: ["missing-structure"] } } : system);
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();
	expect(() => restored.tick()).toThrow("Unknown environmental structure 'missing-structure'");
});

test("migrates historical environmental Structure indexes to IDs", () => {
	const settings = kore.createDefaultMap({ id: "environmental-legacy", worldSize: { x: 100, y: 100 } })
		.addPlayerSpawn({ teamNr: 0, x: 10, y: 40, w: 20, h: 20, playerCount: 1 })
		.addPlayerSpawn({ teamNr: 1, x: 70, y: 40, w: 20, h: 20, playerCount: 1 })
		.addTimedHazard({ id: "pulse", structure, startTick: 1, intervalTicks: 4, durationTicks: 2 }).build();
	const snapshot = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build().toSettings();
	snapshot.systems = snapshot.systems!.map(system => {
		if (system.systemId !== "core.environmental") return system;
		const structureIds = system.state.structureIds as string[];
		const { structureIds: _structureIds, ...state } = system.state as Record<string, unknown>;
		return { ...system, state: { ...state, structureIndexes: structureIds.map(id => snapshot.mapBoundarys.findIndex(boundary => boundary.id === id)) } };
	});
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();
	expect(restored.toSettings().systems?.find(system => system.systemId === "core.environmental")?.state).toHaveProperty("structureIds");
	expect(restored.toSettings().systems?.find(system => system.systemId === "core.environmental")?.state).not.toHaveProperty("structureIndexes");
});

test("unsupported or malformed environmental mechanics are rejected before authoring", () => {
	const map = kore.createDefaultMap({ id: "invalid-environment", worldSize: { x: 100, y: 100 } });
	expect(() => map.addTimedHazard({ id: "bad", structure, startTick: 0, intervalTicks: 1, durationTicks: 1 })).toThrow();
	expect(() => map.addEnvironmentalCycle({ id: "bad-cycle", structure, phases: [] })).toThrow();
	expect(() => validateMapDocument({ schemaVersion: 1, metadata: { id: "x", name: "x" }, worldSize: { x: 100, y: 100 }, friction: { friction: 1, linearDrag: 0, stopThreshold: 0 }, drift: 0, arenaGeometry: [], spawnRegions: [], hazards: [], environmentalMechanics: [{ schemaVersion: 1, id: "x", type: "unsupported", structure } as never] })).toThrow("Unsupported environmental mechanic");
});
