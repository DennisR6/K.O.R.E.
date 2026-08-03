import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { MatchEndReason, MatchStatus } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { GameDatabase } from "../src/server/db.ts";
import { validateFrozenReplayDocument } from "../src/replay/types.ts";

test("frozen replay records validate, persist independently, and reject live snapshots", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings()).build();
	handler.finishMatch({ status: MatchStatus.Draw, winnerTeam: null, reason: MatchEndReason.Draw, turnNumber: 0 });
	const finalSettings = handler.toSettings();
	const replay = { schemaVersion: 1, initialSettings: createDefaultGameSettings(), seed: 1, actions: [], finalSettings, result: finalSettings.matchResult!, completedAt: 1 };
	expect(() => validateFrozenReplayDocument(replay)).not.toThrow();
	const db = new GameDatabase(":memory:");
	db.createGame({ id: "game", settings: finalSettings, users: ["a", "b"], currentTeam: 0, turnNumber: 0, updatedAt: 1, lifecycle: { version: 1, status: "completed", createdAt: 1, statusChangedAt: 1, completedAt: 1 } });
	const share = db.createReplayShare("game", replay, 2);
	replay.actions.push({ type: "shoot", actorId: "mutated", input: { angle: 0, power: 1 } });
	expect(share.replay.actions).toEqual([]);
	expect(() => db.createReplayShare("game", replay, 3)).toThrow();
	db.close();
});
