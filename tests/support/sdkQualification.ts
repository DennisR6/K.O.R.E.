import { GameHandler, GameHandlerBuilder } from "../../src/kore/runtime/Handler.js";
import { kore } from "../../src/kore/sdk/index.js";
import { RulePhase, WinCondition } from "../../src/rules/types.js";
import type { GameSettings } from "../../src/settings/settings.js";
import type { KoreMatchDefinition } from "../../src/kore/sdk/match.js";

export const QUALIFICATION_MAP_ID = "sdk-qualification-arena-v1";
export const QUALIFICATION_ITEM_ID = "sdk-qualification-dash";

export function createQualificationSettings(): GameSettings {
	const penguins = kore.createTeam({ teamNr: 0, name: "Penguins", playerCount: 1 });
	const bears = kore.createTeam({ teamNr: 1, name: "Bears", playerCount: 1 });
	const dash = kore.createItem({
		id: QUALIFICATION_ITEM_ID,
		name: "Qualification Dash",
		type: "utility",
		effects: [{ type: "modifyForce", value: { factor: 1.25 } }],
		targetType: "self",
		duration: { type: "instant", value: 0 },
		useLimit: { perTurn: 1, perGame: 1 },
		targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false },
	});
	const settings = kore.createDefaultMap({ id: QUALIFICATION_MAP_ID, name: "SDK Qualification Arena" })
		.addBackground({ type: "color", color: "#dff6ff" })
		.addTeam(penguins)
		.addTeam(bears)
		.addPlayerSpawn({ team: penguins, x: 40, y: 180, w: 120, h: 90 })
		.addPlayerSpawn({ team: bears, x: 640, y: 180, w: 120, h: 90 })
		.addRectangle({ x: 380, y: 160, w: 40, h: 130 })
		.addForceZone({ id: "qualification-force", x: 250, y: 225, r: 22, angle: 0, power: 1 })
		.addKillZone({ id: "qualification-kill", x: 400, y: 390, r: 18 })
		.addItem(dash)
		.addFixedLoadout({ team: 0, items: [{ itemId: QUALIFICATION_ITEM_ID, uses: 1 }] })
		.build();
	settings.players = settings.players.map((player, index) => ({ ...player, id: `00000000-0000-4000-8000-0000000390${index}` }));
	const validate: typeof kore.validate = kore.validate;
	validate(settings);
	return settings;
}

export function createQualificationDefinition(seed = 39001): KoreMatchDefinition {
	const settings = createQualificationSettings();
	const gameMode = kore.createGameMode({
		id: "sdk-qualification-mode-v1",
		phases: [RulePhase.Item, RulePhase.Aim, RulePhase.Charge, RulePhase.Push, RulePhase.Physics],
		maxItemsPerTurn: 1,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: settings.gameMode?.itemEconomy,
	});
	return kore.createMatchDefinition({
		mapId: QUALIFICATION_MAP_ID,
		settings,
		gameMode,
		seed,
		header: { myTeam: [0], allTeams: ["Penguins", "Bears"] },
	});
}

export function createSdkQualificationHandler(seed = 39001): GameHandler {
	return kore.createRuntimeMatch(createQualificationDefinition(seed));
}

/** Test-only legacy construction of the same canonical settings. */
export function createLegacyQualificationHandler(): GameHandler {
	return new GameHandlerBuilder().defaultSystems().fromSettings(createQualificationSettings()).build();
}

export function firstActorId(handler: GameHandler): string {
	const actor = handler.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(0));
	if (!actor) throw new Error("Qualification fixture has no active team-0 actor");
	return actor.getId();
}

export function stableSnapshot(value: unknown): string {
	return JSON.stringify(value);
}
