import { expect, test } from "bun:test";
import { ObjectEmitter } from "../src/emitter/ObjectEmitter.ts";
import { EmitterSystem } from "../src/systems/Emitter.ts";
import { UiSystem } from "../src/systems/UiSystem.ts";
import { FitWorldCamera } from "../src/ui/FitWorldCamera.ts";
import { createCanonicalPlayableMatchHandler, createCanonicalPlayableMatchSettings, validateReferenceSpawnAndCamera } from "../src/settings/canonicalPlayableMatch.ts";

test("canonical players start alive, contained, visible, and in the fixed camera view", () => {
	const settings = createCanonicalPlayableMatchSettings();
	expect(() => validateReferenceSpawnAndCamera(settings)).not.toThrow();
	const camera = new FitWorldCamera({ x: 800, y: 450 });
	camera.resize(1366, 768);
	expect(camera.getScaleFactor()).toBeFinite();
	expect(camera.getPosition()).toEqual({ x: 0, y: 0 });
	expect(camera.getWorldBounds()).toEqual({ x: 0, y: 0, w: 800, h: 450 });
	for (const player of settings.players) {
		expect(player.isDead).toBe(false);
		expect(camera.containsCircle(player.position, player.size)).toBe(true);
	}

	camera.resize(320, 180);
	expect(camera.getScaleFactor()).toBeFinite();
	expect(camera.getScaleFactor()).toBeGreaterThan(0);
	const roundTripped = camera.viewportToWorld(camera.worldToViewport(settings.players[0]!.position));
	expect(roundTripped.x).toBeCloseTo(settings.players[0]!.position.x, 9);
	expect(roundTripped.y).toBeCloseTo(settings.players[0]!.position.y, 9);
});

test("only the active team's live actor can be submitted from the initial view", () => {
	const handler = createCanonicalPlayableMatchHandler();
	const ui = new UiSystem();
	const emitter = new ObjectEmitter();
	handler.addSystem(ui);
	handler.setMouseHandler(ui);
	handler.addSystem(new EmitterSystem(emitter));
	const entities = handler.getEntityManager().getEntities();
	const active = entities.find(entity => entity.getTeam().includes(0))!;
	const inactive = entities.find(entity => !entity.getTeam().includes(0))!;

	handler.updateMouse(active!.getPos().x, active!.getPos().y);
	handler.handleMousePressed();
	handler.updateMouse(active!.getPos().x + 20, active!.getPos().y);
	handler.handleMouseReleased();
	handler.tick();
	expect(emitter.getLastShot()?.actorId).toBe(active!.getId());

	const secondHandler = createCanonicalPlayableMatchHandler();
	const secondUi = new UiSystem();
	const secondEmitter = new ObjectEmitter();
	secondHandler.addSystem(secondUi);
	secondHandler.setMouseHandler(secondUi);
	secondHandler.addSystem(new EmitterSystem(secondEmitter));
	const inactiveActor = secondHandler.getEntityManager().getEntities().find(entity => !entity.getTeam().includes(0))!;
	secondHandler.updateMouse(inactiveActor.getPos().x, inactiveActor.getPos().y);
	secondHandler.handleMousePressed();
	secondHandler.updateMouse(inactiveActor.getPos().x + 20, inactiveActor.getPos().y);
	secondHandler.handleMouseReleased();
	secondHandler.tick();
	expect(secondEmitter.getLastShot()).toBeUndefined();

	secondUi.setAimAngle(inactiveActor.getId(), 0);
	secondUi.setChargePower(1);
	secondHandler.tick();
	expect(secondUi.selectedActorId).toBeNull();
	expect(() => secondUi.setAimAngle("", Number.NaN)).toThrow();
});

test("reference spawn and camera validation rejects clipped, dead, and mismatched views", () => {
	const invalid = (mutator: (settings: ReturnType<typeof createCanonicalPlayableMatchSettings>) => void) => {
		const settings = createCanonicalPlayableMatchSettings();
		mutator(settings);
		expect(() => validateReferenceSpawnAndCamera(settings)).toThrow();
	};
	invalid(settings => { settings.players[0]!.isDead = true; });
	invalid(settings => { settings.players[0]!.position.x = 5; });
	invalid(settings => { settings.worldSize.x = 801; });
	expect(() => new FitWorldCamera({ x: Number.NaN, y: 450 })).toThrow();
});
