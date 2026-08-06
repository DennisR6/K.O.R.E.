import { kore } from "../src/kore/sdk/index.js";

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
		phases: [kore.types.rulePhase.item, kore.types.rulePhase.physics],
		maxItemsPerTurn: 1,
		winCondition: kore.types.winCondition.lastTeamStanding,
	});
	const definition = kore.createMatchDefinition({
		mapId: settings.id,
		settings,
		gameMode,
		seed: 12345,
		header: { myTeam: [0], allTeams: ["Penguins", "Bears"] },
	});

	const wire = JSON.stringify(definition);
	const restoredDefinition: ReturnType<typeof kore.createMatchDefinition> = JSON.parse(wire) as ReturnType<typeof kore.createMatchDefinition>;
	const validateMatchDefinition: typeof kore.validateMatchDefinition = kore.validateMatchDefinition;
	validateMatchDefinition(restoredDefinition);
	const handler = kore.createRuntimeMatch(restoredDefinition);
	const initialState = handler.getState();
	const actorId = restoredDefinition.settings.players[0]!.id;
	const aiSettings = kore.ai.createSettings({ difficulty: "easy", seed: 7, team: 0 });
	const aiShots: Array<{ actorId: string; angle: number; power: number }> = [];
	const aiDecided = kore.ai.createTurnEmitter(aiSettings).executeTurn(handler, aiSettings, {
		sendShot: (actor, angle, power) => aiShots.push({ actorId: actor, angle, power }),
	});
	const shot = aiShots[0] ?? { actorId, angle: 90, power: 5 };
	const packet = handler.simulateTurn(shot.actorId, shot.angle, shot.power);
	handler.resolveTurn(shot);
	const finalState = handler.getState();
	const snapshot = handler.toSettings();
	const restored = kore.restoreHandler(snapshot);

	return {
		initialState,
		finalState,
		startsOnYourTurn: initialState === kore.types.gameState.yourTurn,
		restoredState: restored.getState(),
		aiDecided,
		aiShots: aiShots.length,
		durationFrames: packet.durationFrames,
		restoreEquivalent: JSON.stringify(restored.toSettings()) === JSON.stringify(snapshot),
	};
}
