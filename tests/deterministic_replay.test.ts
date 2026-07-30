import { test, expect, describe } from "bun:test";
import { ReplayRecorder } from "../src/replay/recorder.js";
import { ReplayPlayer } from "../src/replay/player.js";
import { createDefaultGameSettings } from "../src/settings/settings.js";

describe("Play Deterministic Replays", () => {
	test("plays back deterministic replays and produces final snapshot", () => {
		const settings = createDefaultGameSettings();
		const recorder = new ReplayRecorder(settings, 123);

		const actorId = settings.players[0]!.id;
		recorder.recordShoot(actorId, 45, 5);

		const replay = recorder.getReplay();
		const player = new ReplayPlayer(replay);
		const finalSnapshot = player.playAll();

		expect(finalSnapshot).toBeDefined();
		expect(Array.isArray(finalSnapshot)).toBe(true);
		expect(finalSnapshot.length).toBe(settings.players.length);
	});
});
