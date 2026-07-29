import { expect, test } from "bun:test";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { evaluateLastTeamStanding } from "../src/systems/WinningSystem.ts";

function player(team: number, dead: boolean = false): Player {
	const result = new Player(createPlayerSettings({ team: [team] }));
	result.setIsDead(dead);
	return result;
}

test("last-team-standing supports any number of figures per configured team", () => {
	const entities = [player(0, true), player(0, true), player(1, true), player(2), player(2)];

	expect(evaluateLastTeamStanding(entities, 3)).toBe(2);
	entities[1].setIsDead(false);
	expect(evaluateLastTeamStanding(entities, 3)).toBeUndefined();
	entities[1].setIsDead(true);
	entities[3].setIsDead(true);
	entities[4].setIsDead(true);
	expect(evaluateLastTeamStanding(entities, 3)).toBeUndefined();
	expect(() => evaluateLastTeamStanding(entities, 0)).toThrow("at least one team");
});
