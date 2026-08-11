import { expect, test } from "bun:test";
import { CounterSystem } from "../src/systems/CounterSystem.ts";
import { createCanonicalPlayableMatchHandler } from "../src/settings/canonicalPlayableMatch.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { validateReplayDocument } from "../src/replay/types.ts";
import { COUNTER_ADD_EFFECT_ID } from "@coffeemakerstudio/roast";

test("counter replay actions reproduce canonical state without system-local storage", () => {
	const origin = createCanonicalPlayableMatchHandler();
	origin.addSystem(new CounterSystem());
	const initialSettings = origin.toSettings();
	initialSettings.counters.push({ schemaVersion: 1, id: "kills", value: 4 });
	const replay = {
		schemaVersion: 1,
		seed: 17,
		initialSettings,
		actions: [{ type: "counter" as const, effect: { schemaVersion: 1 as const, type: COUNTER_ADD_EFFECT_ID, target: { type: "counter" as const, counterId: "kills" }, typeValue: { amount: 3 } } }],
	};
	validateReplayDocument(replay);
	const player = new ReplayPlayer(replay);
	expect(player.advance()).toBe(true);
	expect(player.getHandler().getCounter("kills").value).toBe(7);
	expect(player.isComplete()).toBe(true);
});
