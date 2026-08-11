/**
 * Bun-only fixture helper for the replay-viewer browser specs.
 *
 * The @playwright/test runner executes under node, but authoritative match
 * preparation needs `bun:sqlite` (src/server/db.ts). This script runs with
 * `bun run` from the specs and performs the same database preparation the
 * tests used to do in-process; it prints the opaque result (game id or
 * replay token) on stdout.
 *
 * Usage: bun run tests/browser/prepare_replay_fixture.ts <operator|share> <dbPath>
 */
import { createDefaultGameSettings } from "../../src/settings/settings.ts";
import { GameDatabase } from "../../src/server/db.ts";
import { GameRegistry } from "../../src/server/gameRegistry.ts";
import { GameHandlerBuilder } from "../../src/kore/runtime/Handler.ts";
import { MatchEndReason, MatchStatus } from "../../src/rules/types.ts";

const mode = process.argv[2];
const dbPath = process.argv[3];
if (!dbPath) throw new Error("usage: prepare_replay_fixture.ts <operator|share> <dbPath>");

if (mode === "operator") {
	// Mirrors tests/browser/operator_replay_viewer.e2e.test.ts: create one
	// authoritative match with a single submitted turn, then print its id.
	const users = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
	const database = new GameDatabase(dbPath);
	const registry = new GameRegistry(database);
	const record = registry.create(createDefaultGameSettings(2, 1), users);
	const actorId = record.handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!.getId();
	if (!registry.submitTurn(users[0]!, { actorId, angle: 0, power: 4 }).ok) {
		throw new Error("submitTurn failed for the operator replay fixture");
	}
	database.close();
	console.log(record.id);
} else if (mode === "share") {
	// Mirrors tests/browser/shared_replay_viewer.e2e.test.ts: persist a
	// completed match with a frozen replay share, then print the token.
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings()).build();
	handler.finishMatch({ status: MatchStatus.Draw, winnerTeam: null, reason: MatchEndReason.Draw, turnNumber: 0 });
	const finalSettings = handler.toSettings();
	const db = new GameDatabase(dbPath);
	db.createGame({ id: "private-game", settings: finalSettings, users: ["private-a", "private-b"], currentTeam: 0, turnNumber: 0, updatedAt: 1, lifecycle: { version: 1, status: "completed", createdAt: 1, statusChangedAt: 1, completedAt: 1 } });
	const token = db.createReplayShare("private-game", { schemaVersion: 1, initialSettings: createDefaultGameSettings(), seed: 1, actions: [], finalSettings, result: finalSettings.matchResult!, completedAt: 1 }).token;
	db.close();
	console.log(token);
} else {
	throw new Error(`unknown fixture mode: ${mode}`);
}
