import { expect, test } from "bun:test";
import { engine, EngineSystemRegistry, EngineWorldBuilder } from "../sdk/engine_sdk.js";
import { ui, UiRuntime, validateUiSettings } from "../sdk/ui_sdk.js";
import { audio, AudioEmitter, validateAudioCommand } from "../sdk/audio_sdk.js";
import { presentation, validateAnimationSettings } from "../sdk/presentation_sdk.js";
import { kore, createPlayer } from "../sdk/kore_sdk.js";

test("standalone Engine SDK bundle builds and validates a world", () => {
	expect(EngineSystemRegistry).toBeDefined();
	expect(EngineWorldBuilder).toBeDefined();
	const world = engine.createWorld({ id: "standalone-world", worldSize: { x: 100, y: 80 } }).addEntity({ id: "entity" }).build();
	engine.validate(world);
	expect(world.id).toBe("standalone-world");
});

test("standalone UI SDK bundle builds and validates a menu", () => {
	const settings = ui.createMenu({ id: "standalone-menu", size: { width: 320, height: 180 } }).addScreen(ui.screen({ id: "main", elements: [ui.button({ id: "start", text: "Start", rect: { x: 10, y: 10, width: 100, height: 30 } })] })).build();
	validateUiSettings(settings);
	const runtime = UiRuntime.fromSettings(settings);
	expect(runtime.getActiveScreen()).toBe("main");
});

test("standalone KORE SDK bundle authors a player and map", () => {
	const player = createPlayer({ id: "standalone-player", teamNr: 0 });
	expect(player.team).toEqual([0]);
	const map = kore.createDefaultMap({ id: "standalone-map" }).addPlayerSpawn({ x: 40, y: 130, w: 180, h: 180, teamNr: 0, playerCount: 1 }).addPlayerSpawn({ x: 580, y: 130, w: 180, h: 180, teamNr: 1, playerCount: 1 }).build();
	expect(map.id).toBe("standalone-map");
});

test("standalone Audio SDK bundle emits and validates commands", () => {
	const emitter = new AudioEmitter("standalone-audio");
	const command = audio.command.play({ sourceId: "standalone-audio", soundId: "click" });
	validateAudioCommand(command);
	emitter.emit(command);
	expect(emitter.drainSoundCommands()).toEqual([command]);
});

test("standalone Presentation SDK bundle validates and projects animation state", () => {
	const animation = presentation.createAnimation({ id: "pulse", channel: "ui", durationTicks: 2, priority: 1, interruption: "replace", tracks: [{ id: "opacity", keyframes: [{ tick: 0, value: 1 }, { tick: 2, value: 0 }] }] });
	validateAnimationSettings(animation);
	const runtime = presentation.createRuntime("standalone-presentation", { animations: [animation] });
	runtime.emit(presentation.play("pulse-1", "pulse"));
	expect(runtime.tick().animations[0]?.animationId).toBe("pulse");
});

test("standalone bundles preserve runtime public export names", async () => {
	const [engineBundle, uiBundle, audioBundle, presentationBundle, koreBundle] = await Promise.all([
		import("../sdk/engine_sdk.js"),
		import("../sdk/ui_sdk.js"),
		import("../sdk/audio_sdk.js"),
		import("../sdk/presentation_sdk.js"),
		import("../sdk/kore_sdk.js"),
	]);
	const engineExports = Object.keys(engineBundle).sort();
	for (const name of ["DEFERRED_EFFECT_DURATION_UNITS", "DEFERRED_EFFECT_SCHEMA_VERSION", "STRUCTURE_LIFECYCLE_DURATION_UNITS", "STRUCTURE_LIFECYCLE_SCHEMA_VERSION", "TEMPORAL_DURATION_UNITS", "TEMPORAL_MODIFIER_SCHEMA_VERSION", "MOVEMENT_APPLY_FORCE_FIELD_EFFECT_ID", "advanceDeferredEffect", "advanceTemporalModifier", "createDeferredEffect", "createDeferredEffectTemplate", "createTemporalModifier", "createTemporalModifierTemplate", "validateDeferredEffect", "validateTemporalModifier"]) expect(engineExports).toContain(name);
	expect(engineExports).toContain("engine");
	expect(Object.keys(uiBundle).sort()).toEqual(["UiMenuBuilder", "UiRuntime", "createDefaultUiFramework", "ui", "validateUiSettings"].sort());
	expect(Object.keys(audioBundle).sort()).toEqual(["ApplicationAudioMixer", "AudioEmitter", "AudioRuntime", "SoundSystem", "audio", "createAudioRuntime", "createAudioSettings", "createDefaultAudioFramework", "validateApplicationAudioSettings", "validateAudioBatch", "validateAudioCommand", "validateAudioSettings"].sort());
	expect(Object.keys(presentationBundle).sort()).toEqual(["PresentationRuntime", "presentation", "validateAnimationSettings", "validatePresentationEvent", "validatePresentationRuntimeSettings"].sort());
	expect(Object.keys(koreBundle).sort()).toEqual(["KoreMapBuilder", "TriggerDefinitionCatalog", "applyRuntimeForceEffects", "composeItemEffects", "createDefaultKoreFramework", "createEntityResolvedTarget", "createItem", "createPlayer", "createPositionResolvedTarget", "createRuntimeItemEffect", "kore", "resolveRuntimeItemEffects", "validateResolvedEffectTarget", "validateTriggerDefinition"].sort());
});
