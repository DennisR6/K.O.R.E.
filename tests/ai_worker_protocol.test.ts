import { expect, test } from "bun:test";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { fingerprintCanonicalSnapshot, fingerprintHardAiRequest } from "../src/ai/worker/protocol.ts";

test("worker provenance fingerprints are deterministic and state-sensitive", () => {
	const settings = createDefaultGameSettings(2, 2);
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const snapshot = handler.toSettings();
	const request = {
		snapshot,
		acceptedAction: { actorId: snapshot.players[0]!.id, angle: 0, power: 4 },
		expectedTurnNumber: snapshot.turnNumber,
		expectedNextTeam: 1,
		nextRuleState: { phase: snapshot.ruleState.phase, activeTeam: 1, turnNumber: snapshot.turnNumber + 1, itemUses: 0 },
		aiSettings: { difficulty: "hard" as const, seed: 7, team: 1 },
	};
	expect(fingerprintHardAiRequest(request)).toBe(fingerprintHardAiRequest(structuredClone(request)));
	expect(fingerprintCanonicalSnapshot(snapshot)).toBe(fingerprintCanonicalSnapshot(structuredClone(snapshot)));
	const changed = structuredClone(snapshot);
	changed.players[0]!.position.x += 1;
	expect(fingerprintCanonicalSnapshot(changed)).not.toBe(fingerprintCanonicalSnapshot(snapshot));
});
