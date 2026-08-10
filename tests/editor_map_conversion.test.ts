import { expect, test } from "bun:test";
import { convertEditorMapDocument, DOCUMENT_SCHEMA_VERSION, type EditorMapDocument } from "../src/contracts/documents.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import type { MapBoundarySettingsRect } from "../src/settings/settings.ts";
import { SHAPE } from "../src/physics/physics.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { StructureRectangle } from "../src/structures/structureRectangle.ts";

const editorMap: EditorMapDocument = {
	schemaVersion: DOCUMENT_SCHEMA_VERSION,
	name: "Conversion fixture",
	background: null,
	screenResolution: { x: 800, y: 450, factor: 100 },
	mapBoundarys: [{ type: "rectangle", x: 10, y: 20, w: 100, h: 20, color: "#4da3ff" }],
	holes: [{ type: "circle", x: 300, y: 200, r: 30, color: "#ff4444" }],
	players: [
		{ x: 100, y: 110, color: "#00ff00", team: 0 },
		{ x: 140, y: 150, color: "#00ff00", team: 0 },
		{ x: 500, y: 300, color: "#0000ff", team: 1 },
	],
	friction: { friction: 0.98, linearDrag: 0.05, stopThreshold: 0.15 },
	drift: 0.25,
	items: [],
	effects: [
		{ id: "push", type: "push_zone", position: { x: 40, y: 40 }, size: { w: 100, h: 100 }, params: { direction: 90, force: 3 } },
		{ id: "kill", type: "kill_zone", position: { x: 200, y: 200 }, size: { w: 50, h: 50 }, params: { killOnTouch: true } },
	],
	mode: { type: "last_man_standing", params: { itemsEnabled: true, hazardsEnabled: false, allowTies: false } },
	ai: { difficulty: "normal", aggressiveness: 50, riskTaking: 40, itemPriority: 50, hazardAwareness: 60, errorRate: 20 },
};

test("converts editor rectangles, circles, team spawn bounds, and collision hazards", () => {
	const settings = convertEditorMapDocument(editorMap, createDefaultGameSettings(2, 1));

	expect(settings.screenResolution).toEqual({ x: 800, y: 450 });
	expect(settings.worldSize).toEqual({ x: 800, y: 450 });
	expect(settings.friction).toEqual(editorMap.friction);
	expect(settings.drift).toBe(0.25);
	expect(settings.mapBoundarys.slice(0, 2)).toMatchObject([
		{ type: SHAPE.RECTANGLE, x: 10, y: 20, w: 100, h: 20, color: "#4da3ff", effects: [] },
		{ type: SHAPE.CIRCLE, x: 300, y: 200, r: 30, color: "#ff4444", effects: [] },
	]);
	expect(settings.players.map(player => player.position)).toEqual([{ x: 92, y: 102 }, { x: 492, y: 292 }]);

	const [pushZone, killZone] = settings.mapBoundarys.slice(2);
	expect(pushZone).toMatchObject({ type: SHAPE.RECTANGLE, x: 40, y: 40, w: 100, h: 100 });
	expect(pushZone.collisionCommands?.[0]?.effect).toMatchObject({ type: "movement.add-velocity", typeValue: { x: expect.closeTo(0), y: 3 } });
	expect(killZone.effects).toEqual([]);
	expect(killZone.collisionCommands?.[0]?.effect).toMatchObject({ type: "effect.composition", effects: [
		{ type: "participation.set-physics", typeValue: { enabled: false } },
		{ type: "participation.set-drawing", typeValue: { enabled: false } },
	] });
});

test("converted rectangular zones apply push and kill collision effects", () => {
	const settings = convertEditorMapDocument(editorMap, createDefaultGameSettings(2, 1));
	const [pushZone, killZone] = settings.mapBoundarys.slice(2) as [MapBoundarySettingsRect, MapBoundarySettingsRect];
	const pushedPlayer = new Player(createPlayerSettings({ position: { x: 60, y: 60 }, size: 10 }));
	const killedPlayer = new Player(createPlayerSettings({ position: { x: 220, y: 220 }, size: 10 }));
	const handler = new GameHandlerBuilder()
		.defaultSystems(settings.friction)
		.addStructure(new StructureRectangle(pushZone.x, pushZone.y, pushZone.w, pushZone.h, pushZone.color, pushZone.effects, undefined, undefined, undefined, undefined, pushZone.collisionCommands))
		.addStructure(new StructureRectangle(killZone.x, killZone.y, killZone.w, killZone.h, killZone.color, killZone.effects, undefined, undefined, undefined, undefined, killZone.collisionCommands))
		.addPlayer(pushedPlayer)
		.addPlayer(killedPlayer)
		.build();

	handler.tick();
	expect(pushedPlayer.getVel()).toEqual({ x: expect.closeTo(0), y: 3 });
	expect(killedPlayer.isDead()).toBe(true);
});

test("rejects invalid editor documents and unsupported conversion features", () => {
	expect(() => convertEditorMapDocument({ ...editorMap, friction: 1 }, createDefaultGameSettings(2, 1))).toThrow("Invalid editor map physics");
	expect(() => convertEditorMapDocument({ ...editorMap, items: [{ id: "unsupported", name: "", effectType: "", trigger: "", frequency: { mode: "", intervalRounds: 0, killsInterval: 0, lastPlayersThreshold: 0, healthThreshold: 0, boostFactor: 0 }, probability: 0, spawn: { type: "points", points: [], areas: [] } }] }, createDefaultGameSettings(2, 1))).toThrow("Editor map items are not supported");
	expect(() => convertEditorMapDocument({ ...editorMap, effects: [{ id: "slide", type: "slide_zone", position: { x: 0, y: 0 }, size: { w: 10, h: 10 }, params: { slideFactor: 1 } }] }, createDefaultGameSettings(2, 1))).toThrow("Unsupported editor hazard type");
	expect(() => convertEditorMapDocument({ ...editorMap, effects: [{ id: "sticky", type: "sticky_zone", position: { x: 0, y: 0 }, size: { w: 10, h: 10 }, params: { stickFactor: 1 } }] }, createDefaultGameSettings(2, 1))).toThrow("Unsupported editor hazard type");
	expect(() => convertEditorMapDocument({ ...editorMap, mode: { type: "last_man_standing", params: { ...editorMap.mode.params, allowTies: true } } }, createDefaultGameSettings(2, 1))).toThrow("Only the default last_man_standing mode is supported");
	expect(() => convertEditorMapDocument({ ...editorMap, ai: { ...editorMap.ai, difficulty: "hard" } }, createDefaultGameSettings(2, 1))).toThrow("Only the default editor AI configuration is supported");
});
