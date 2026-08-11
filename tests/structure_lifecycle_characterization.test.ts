import { expect, test } from "bun:test";
import { EffectType, EffectTrigger, SettingOperation, type EffectSettings } from "../src/effects/types.ts";
import { EffectModifyPosition } from "../src/effects/modifyPosition.ts";
import { EffectModifySetting } from "../src/effects/modifySetting.ts";
import { MultiEffect } from "../src/effects/effects.ts";
import { SHAPE } from "../src/physics/physics.ts";
import { StructureCircle } from "../src/structures/structureCircle.ts";
import { FullStructure } from "../src/structures/fullStructure.ts";
import type { RenderContext } from "../src/kore/runtime/RenderContext.ts";

function rendererSpy(): RenderContext & { circles: number; rectangles: number } {
	return {
		WORLD_SIZE_X: 800,
		WORLD_SIZE_Y: 450,
		circles: 0,
		rectangles: 0,
		drawCircle() { this.circles++; },
		drawRect() { this.rectangles++; },
		drawText() {}, setFillColor() {}, setOpacity() {}, setNoFill() {}, setStrokeColor() {}, setStroke() {}, noStroke() {}, rotate() {}, scale() {}, translate() {}, drawImage() {}, getScreenSize() { return { width: 800, height: 450 }; }, clear() {}, push() {}, pop() {}, line() {}, resizeCanvas() {}, setScaleFactor() {}, getScaleFactor() { return 1; }, toWorld(value) { return value; }, toPixel(value) { return value; }, windowScale() { return 1; }, beginClip() {}, endClip() {}, mouseWheel() {}, getTextWidth() { return 0; },
	};
}

function damageEffect(): EffectSettings {
	return { schemaVersion: 1, type: EffectType.NumericAdd, typeValue: { stateId: "hp", amount: -5 } };
}

test("structures participate in collision only while physicsEnabled is true", () => {
	const structure = new StructureCircle(10, 20, 5, "red", []);
	expect(structure.physicsEnabled()).toBe(true);
	structure.setPhysicsEnabled(false);
	expect(structure.physicsEnabled()).toBe(false);
});

test("structure drawing is currently independent of physicsEnabled", () => {
	const structure = new StructureCircle(10, 20, 5, "red", []);
	const renderer = rendererSpy();
	structure.setPhysicsEnabled(false);
	structure.draw(renderer);
	expect(renderer.circles).toBe(1);
});

test("structure position mutation round-trips through geometry", () => {
	const structure = new StructureCircle(10, 20, 5, "red", []);
	new EffectModifyPosition({ typeValue: { x: 40, y: 60 } }).apply(structure);
	expect(structure.getPos()).toEqual({ x: 40, y: 60 });
	expect(structure.toSettings()).toMatchObject({ type: SHAPE.CIRCLE, x: 40, y: 60 });
});

test("mutated structure lifecycle state serializes with deterministic identity", () => {
	const structure = new StructureCircle(10, 20, 5, "red", [{
		trigger: EffectTrigger.Collision,
		triggerValue: [],
		...damageEffect(),
	}], undefined, "explicit-circle");
	structure.setPhysicsEnabled(false);
	const settings = structure.toSettings();
	expect(settings.id).toBe("explicit-circle");
	expect(settings.physicsEnabled).toBe(false);
	expect(settings.drawingEnabled).toBe(true);
	expect(settings.effects).toHaveLength(1);
});

test("EffectModifySetting can mutate the generic physics lifecycle setting", () => {
	const effect = new EffectModifySetting({ typeValue: { operation: SettingOperation.Set, key: "physicsEnabled", value: false } });
	const structure = new StructureCircle(10, 20, 5, "red", []);
	effect.apply(structure);
	expect(structure.physicsEnabled()).toBe(false);
});

test("MultiEffect preserves declaration order at the core Effect boundary", () => {
	const applied: string[] = [];
	const first = { schemaVersion: 1, type: EffectType.Position, typeValue: { x: 1, y: 2 } } satisfies EffectSettings;
	const second = { schemaVersion: 1, type: EffectType.Velocity, typeValue: { x: 3, y: 4 } } satisfies EffectSettings;
	const multi = new MultiEffect({ schemaVersion: 1, type: EffectType.Multi, typeValue: [first, second] });
	const target = new StructureCircle(0, 0, 5, "red", []);
	const originalSetPos = target.setPos.bind(target);
	const originalSetVel = target.setVel.bind(target);
	target.setPos = position => { applied.push("position"); originalSetPos(position); };
	target.setVel = velocity => { applied.push("velocity"); originalSetVel(velocity); };
	multi.apply(target);
	expect(applied).toEqual(["position", "velocity"]);
});

test("structures preserve all four independent physics/drawing states", () => {
	const states = [
		[true, true],
		[true, false],
		[false, true],
		[false, false],
	] as const;
	for (const [physicsEnabled, drawingEnabled] of states) {
		const structure = new FullStructure({ id: `state-${physicsEnabled}-${drawingEnabled}`, type: SHAPE.CIRCLE, x: 10, y: 10, r: 5, effects: [], physicsEnabled, drawingEnabled });
		expect(structure.physicsEnabled()).toBe(physicsEnabled);
		expect(structure.drawingEnabled()).toBe(drawingEnabled);
		expect(structure.toSettings()).toMatchObject({ physicsEnabled, drawingEnabled });
	}
});

test("structure participation flags remain independent canonical state", () => {
	const structure = new FullStructure({ id: "participation-flags", type: SHAPE.CIRCLE, x: 10, y: 10, r: 5, effects: [], physicsEnabled: false, drawingEnabled: false });
	expect(structure.physicsEnabled()).toBe(false);
	expect(structure.drawingEnabled()).toBe(false);
	structure.setPhysicsEnabled(true);
	expect(structure.physicsEnabled()).toBe(true);
	expect(structure.drawingEnabled()).toBe(false);
});
