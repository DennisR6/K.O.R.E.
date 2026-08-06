import { GameState } from "../src/engine/types.js";
import { RulePhase, WinCondition } from "../src/rules/types.js";
import { kore } from "../src/kore/sdk/index.js";
import { validateKoreMatchDefinition, type KoreMatchDefinition } from "../src/kore/sdk/match.js";

/** Author, validate, run, serialize, and restore one deterministic match. */
export function run(): Record<string, unknown> {
	const penguins = kore.createTeam({ teamNr: 0, name: "Penguins", playerCount: 2 });
	const settings = kore.createDefaultMap({ id: "example-04-arena", name: "Lifecycle Arena" })
		.addTeam(penguins)
		.addPlayerSpawn({ team: penguins, x: 40, y: 120, w: 180, h: 180 })
		.addPlayerSpawn({ teamNr: 1, playerCount: 2, x: 580, y: 120, w: 180, h: 180 })
		.build();
	const gameMode = kore.createGameMode({
		id: "example-04-mode",
		phases: [RulePhase.Item, RulePhase.Physics],
		maxItemsPerTurn: 1,
		winCondition: WinCondition.LastTeamStanding,
	});
	const definition = kore.createMatchDefinition({
		mapId: settings.id,
		settings,
		gameMode,
		seed: 12345,
		header: { myTeam: [0], allTeams: ["Penguins", "Bears"] },
	});

	const wire = JSON.stringify(definition);
	const restoredDefinition: KoreMatchDefinition = JSON.parse(wire) as KoreMatchDefinition;
	validateKoreMatchDefinition(restoredDefinition);
	const handler = kore.createRuntimeMatch(restoredDefinition);
	const actorId = restoredDefinition.settings.players[0]!.id;
	const aiSettings = kore.ai.createSettings({ difficulty: "easy", seed: 7, team: 0 });
	const aiShots: Array<{ actorId: string; angle: number; power: number }> = [];
	const aiDecided = kore.ai.createTurnEmitter(aiSettings).executeTurn(handler, aiSettings, {
		sendShot: (actor, angle, power) => aiShots.push({ actorId: actor, angle, power }),
	});
	const packet = handler.simulateTurn(actorId, aiShots[0]?.angle ?? 90, aiShots[0]?.power ?? 5);
	const snapshot = handler.toSettings();
	const restored = kore.restoreHandler(snapshot);

	return {
		initialState: handler.getState(),
		startsOnYourTurn: handler.getState() === GameState.Your_turn,
		aiDecided,
		aiShots: aiShots.length,
		durationFrames: packet.durationFrames,
		restoreEquivalent: JSON.stringify(restored.toSettings()) === JSON.stringify(snapshot),
	};
}
