import { expect, test } from "bun:test";
import { GameDatabase } from "../src/server/db.ts";
import { RankedService } from "../src/server/rankedService.ts";

test("ranked service composes season, queue, and finalization boundaries", () => {
	const service = new RankedService(new GameDatabase(":memory:"), { id: "season", rulesetVersion: "ranked-v1", startsAt: 0, endsAt: null, status: "active" });
	service.enqueue("a", 1000, "eu", 0);
	service.enqueue("b", 1010, "eu", 0);
	const match = service.matchmake(1_000);
	expect(match?.mapId).toBe("magma-cradle");
	const finalized = service.finalize("match", { status: "winner", winnerTeam: 0, reason: "last-team-standing", turnNumber: 3 }, [{ playerId: "a", team: 0 }, { playerId: "b", team: 1 }], 2_000);
	expect(finalized.events).toHaveLength(2);
});
