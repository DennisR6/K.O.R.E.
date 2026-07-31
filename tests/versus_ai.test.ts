import { describe, expect, test } from "bun:test";
import { EasyAi } from "../src/ai/easyAi.ts";
import { HardAi } from "../src/ai/hardAi.ts";
import { MediumAi } from "../src/ai/mediumAi.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createVersusAiGameSettings, validateGameSettings } from "../src/settings/settings.ts";

describe("Versus AI Game Mode", () => {
	test("createVersusAiGameSettings creates valid 1-player-versus-AI settings", () => {
		const settings = createVersusAiGameSettings("medium", 999, 2, 2);

		expect(() => validateGameSettings(settings)).not.toThrow();
		expect(settings.ai).toBeDefined();
		expect(settings.ai?.difficulty).toBe("medium");
		expect(settings.ai?.seed).toBe(999);
		expect(settings.ai?.team).toBe(1);
	});

	test("GameHandler restores AI settings and creates corresponding AI producer", () => {
		const settings = createVersusAiGameSettings("hard", 777, 2, 2);
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();

		expect(handler.getAiSettings()).toEqual(settings.ai);

		const producer = handler.createAiProducer();
		expect(producer).toBeInstanceOf(HardAi);

		// Snapshot serialization preserves AI settings
		const snapshot = handler.toSettings();
		expect(snapshot.ai).toEqual(settings.ai);

		const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();
		expect(restored.getAiSettings()).toEqual(settings.ai);
		expect(restored.createAiProducer()).toBeInstanceOf(HardAi);
	});

	test("createAiProducer creates EasyAi and MediumAi correctly based on difficulty", () => {
		const easySettings = createVersusAiGameSettings("easy", 100);
		const easyHandler = new GameHandlerBuilder().defaultSystems().fromSettings(easySettings).build();
		expect(easyHandler.createAiProducer()).toBeInstanceOf(EasyAi);

		const medSettings = createVersusAiGameSettings("medium", 200);
		const medHandler = new GameHandlerBuilder().defaultSystems().fromSettings(medSettings).build();
		expect(medHandler.createAiProducer()).toBeInstanceOf(MediumAi);
	});
});
