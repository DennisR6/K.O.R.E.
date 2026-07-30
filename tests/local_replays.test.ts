import { test, expect, describe } from "bun:test";
import { ReplayRecorder } from "../src/replay/recorder.js";
import { validateReplayDocument } from "../src/replay/types.js";
import { createDefaultGameSettings } from "../src/settings/settings.js";

describe("Record Local Replays", () => {
	test("records local actions into valid replay document", () => {
		const settings = createDefaultGameSettings();
		const recorder = new ReplayRecorder(settings, 42);

		recorder.recordShoot("actor-1", 90, 5);
		recorder.recordItemUse("actor-1", "item-1", { targetId: "actor-2" });

		const replay = recorder.getReplay();
		expect(() => validateReplayDocument(replay)).not.toThrow();
		expect(replay.seed).toBe(42);
		expect(replay.actions.length).toBe(2);
		expect(replay.actions[0]?.type).toBe("shoot");
		expect(replay.actions[1]?.type).toBe("itemUse");
	});
});
