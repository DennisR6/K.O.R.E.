import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { kore } from "../src/kore/sdk/index.js";
import { KORE_MATCH_DEFINITION_VERSION, createGameMode, createMatchDefinition, createMatchSystemProfile, validateKoreMatchDefinition } from "../src/kore/sdk/match.js";
import { createRuntimeHandler } from "../src/engine/runtimeFactory.js";
import { GameState } from "../src/engine/types.js";
import { RulePhase, WinCondition, type GameModeSettings } from "../src/rules/types.js";
import { BoundarySystem } from "../src/systems/BoundarySystem.js";
import { GameStateManager } from "../src/systems/GameStateManager.js";
import { PlaybackSystem } from "../src/systems/PlayBackSystem.js";
import { PhysicsSystem } from "../src/systems/PhysicsSystem.js";
import { WinningSystem } from "../src/systems/WinningSystem.js";
import { createSystemFromSettings } from "../src/systems/systemSettings.js";
import { defaultPhysics } from "../src/physics/defaultPhysics.js";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.js";
import type { SystemSettings } from "../src/engine/contracts/systemSettings.js";
import type { EngineFrameworkSettings } from "../src/engine/sdk/index.js";

const CANONICAL_MATCH_SYSTEM_ORDER = ["core.playback", "core.physics", "core.boundary", "core.game-state-manager", "core.winning"];

function canonicalMode(): GameModeSettings {
	return createGameMode({ id: "match-sdk-test", phases: [RulePhase.Item, RulePhase.Physics], maxItemsPerTurn: 1, winCondition: WinCondition.LastTeamStanding, itemEconomy: { fixedLoadouts: [], mapPickups: [] } });
}

test("createGameMode authors validated, detached rule configuration", () => {
	const mode = canonicalMode();
	expect(mode).toEqual({ id: "match-sdk-test", phases: [RulePhase.Item, RulePhase.Physics], maxItemsPerTurn: 1, winCondition: WinCondition.LastTeamStanding, itemEconomy: { fixedLoadouts: [], mapPickups: [] } });
	expect(() => createGameMode({ id: "bad", phases: [] })).toThrow("at least one rule phase");
	expect(() => createGameMode({ id: "bad", phases: [RulePhase.Physics], maxItemsPerTurn: 1 })).toThrow("Item allowance");
	expect(() => createGameMode({ id: "bad", phases: [RulePhase.Item, RulePhase.Physics], maxItemsPerTurn: 0 })).toThrow("positive item allowance");
	expect(() => createGameMode({ id: "bad", phases: [RulePhase.Item, RulePhase.Physics], maxItemsPerTurn: 1, itemEconomy: { fixedLoadouts: [{ team: 0, items: [] }], mapPickups: [] } })).not.toThrow();
	expect(() => createGameMode({ id: "bad", phases: [RulePhase.Item], maxItemsPerTurn: 1 })).toThrow("aim, charge, push");
	// Output is detached: later mutations never reach the authored mode.
	const input = { id: "detach", phases: [RulePhase.Physics] as RulePhase[], itemEconomy: { fixedLoadouts: [] as never[], mapPickups: [] as never[] } };
	const authored = createGameMode(input);
	input.phases.push(RulePhase.Aim);
	expect(authored.phases).toEqual([RulePhase.Physics]);
});

test("createMatchSystemProfile is deterministic, ordered like the legacy pipeline, and hydratable", () => {
	const profile = createMatchSystemProfile(2);
	expect(profile.systemOrder).toEqual(CANONICAL_MATCH_SYSTEM_ORDER);
	expect(profile.systems.map(system => system.systemId)).toEqual([...CANONICAL_MATCH_SYSTEM_ORDER].sort());
	expect(createMatchSystemProfile(2)).toEqual(profile);
	expect(() => createMatchSystemProfile(0)).toThrow("at least one team");
	// The profile states are exactly the fresh runtime systems' serialized states.
	const expected: Record<string, unknown> = {
		"core.playback": new PlaybackSystem().toSettings().state,
		"core.physics": new PhysicsSystem(new defaultPhysics()).toSettings().state,
		"core.boundary": new BoundarySystem().toSettings().state,
		"core.game-state-manager": new GameStateManager().toSettings().state,
		"core.winning": new WinningSystem(2).toSettings().state,
	};
	for (const system of profile.systems) expect(system.state).toEqual(expected[system.systemId]);
	// Every profile system restores through the allowlisted runtime deserializer.
	const restored = new Map<string, unknown>();
	for (const id of profile.systemOrder) restored.set(id, createSystemFromSettings(profile.systems.find(system => system.systemId === id)! as SystemSettings, restored as never));
	expect(restored.get("core.winning")).toBeInstanceOf(WinningSystem);
});

test("authorMatchSettings applies the match header to base settings and stays detached", () => {
	const base = createCanonicalPlayableMatchSettings();
	const settings = kore.authorMatchSettings(base, {
		matchId: "00000000-0000-4000-8000-000000000099",
		myTeam: [0, 1],
		allTeams: ["Team A", "Team B"],
		playerIds: Array.from({ length: base.players.length }, (_, index) => `player-${index}`),
		items: [],
		gameMode: canonicalMode(),
	});
	expect(settings.id).toBe("00000000-0000-4000-8000-000000000099");
	expect(settings.myTeam).toEqual([0, 1]);
	expect(settings.allTeams).toEqual(["Team A", "Team B"]);
	expect(settings.players.map(player => player.id)).toEqual(Array.from({ length: base.players.length }, (_, index) => `player-${index}`));
	expect(settings.gameMode).toEqual(canonicalMode());
	// Detached: authoring output never mutates the base template.
	settings.myTeam.push(9);
	expect(base.myTeam).toEqual([0, 1]);
	expect(() => kore.authorMatchSettings(base, { matchId: "x", myTeam: [0, 1], gameMode: canonicalMode(), playerIds: ["only-one"] })).toThrow("match the player count");
	expect(() => kore.authorMatchSettings(base, { matchId: "", myTeam: [0, 1], gameMode: canonicalMode() })).toThrow("non-empty id");
});

test("createMatchDefinition builds a validated, detached JSON-safe match definition", () => {
	const settings = createCanonicalPlayableMatchSettings();
	const definition = createMatchDefinition({ mapId: "ice-map-v1", settings, gameMode: settings.gameMode!, seed: 12345 });
	expect(definition.schemaVersion).toBe(KORE_MATCH_DEFINITION_VERSION);
	expect(definition.id).toBe(settings.id);
	expect(definition.mapId).toBe("ice-map-v1");
	expect(definition.seed).toBe(12345);
	expect(definition.systems.map(system => system.systemId)).toEqual([...CANONICAL_MATCH_SYSTEM_ORDER].sort());
	expect(definition.systemOrder).toEqual(CANONICAL_MATCH_SYSTEM_ORDER);
	expect(() => validateKoreMatchDefinition(definition)).not.toThrow();
	expect(JSON.parse(JSON.stringify(definition))).toEqual(definition);
	// Mode-specific headers are applied by the definition boundary.
	const versus = createMatchDefinition({ settings, gameMode: settings.gameMode!, seed: 7, header: { myTeam: [0], allTeams: ["Human", "easy KI"], ai: { difficulty: "easy", seed: 7, team: 1 } } });
	expect(versus.settings.myTeam).toEqual([0]);
	expect(versus.settings.allTeams).toEqual(["Human", "easy KI"]);
	expect(versus.settings.ai).toMatchObject({ difficulty: "easy", seed: 7, team: 1 });
	// Detached: definition mutations never leak into the source settings.
	definition.settings.gameMode!.id = "mutated";
	expect(settings.gameMode!.id).toBe("local-ice-duel-v1");
	// Rejections.
	expect(() => createMatchDefinition({ settings, gameMode: settings.gameMode!, seed: 1.5 })).toThrow("safe integer seed");
	expect(() => createMatchDefinition({ settings, gameMode: { id: "bad", phases: [], maxItemsPerTurn: 0, winCondition: WinCondition.LastTeamStanding, itemEconomy: { fixedLoadouts: [], mapPickups: [] } }, seed: 1 })).toThrow();
	const malformed = { ...definition, systemOrder: ["core.playback"] };
	expect(() => validateKoreMatchDefinition(malformed)).toThrow("Invalid match definition system order");
});

test("createRuntimeMatch builds the canonical handler through the runtime factory", () => {
	const settings = createCanonicalPlayableMatchSettings();
	const definition = createMatchDefinition({ mapId: "ice-map-v1", settings, gameMode: settings.gameMode!, seed: 12345 });
	const handler = kore.createRuntimeMatch(definition);
	expect(handler.getState()).toBe(GameState.Your_turn);
	expect(handler.getSystems().map(system => (system as { systemId?: string }).systemId)).toEqual(CANONICAL_MATCH_SYSTEM_ORDER);
	// The serialized snapshot keeps the same systems, order, mode, and rule state.
	const snapshot = handler.toSettings();
	expect(snapshot.systems?.map(system => system.systemId)).toEqual([...CANONICAL_MATCH_SYSTEM_ORDER].sort());
	expect(snapshot.systemOrder).toEqual(CANONICAL_MATCH_SYSTEM_ORDER);
	expect(snapshot.gameMode?.id).toBe("local-ice-duel-v1");
	// A fresh handler restored from the snapshot through the same factory is
	// serialization-equivalent (deterministic round trip).
	const restored = createRuntimeHandler(snapshot);
	expect(restored.toSettings()).toEqual(snapshot);
});

test("handler construction is confined to the runtime factory boundary", () => {
	// Canonical match composition no longer constructs handlers directly.
	for (const file of ["src/scenes/matchPipeline.ts", "src/settings/canonicalPlayableMatch.ts"]) {
		const source = readFileSync(file, "utf8");
		expect(source).not.toMatch(/GameHandlerBuilder/);
		expect(source).not.toMatch(/new GameHandler\(/);
	}
	// The KORE match authoring module never touches the legacy builder.
	const matchSource = readFileSync("src/kore/sdk/match.ts", "utf8");
	expect(matchSource).not.toMatch(/GameHandlerBuilder/);
	expect(matchSource).not.toMatch(/from\s+["'].*engine\/Handler["']/);
	// The designated boundary is the only production construction site.
	const factorySource = readFileSync("src/engine/runtimeFactory.ts", "utf8");
	expect(factorySource).toMatch(/new GameHandlerBuilder/);
	// Every production module stays classified (milestone 27 inventory).
	const inventory = readFileSync("src/sdkMigration/inventory.ts", "utf8");
	expect(inventory).toContain("src/engine/runtimeFactory.ts");
	expect(inventory).toContain("Handler runtime factory");
});

test("canonical match authoring preserves the exact canonical serialized settings", () => {
	// The SDK-authored canonical settings must stay byte-identical to the
	// shipped reference snapshot the tests and browser flows rely on.
	const canonical = createCanonicalPlayableMatchSettings();
	const reauthored = kore.authorMatchSettings(createDefaultBase(), {
		matchId: canonical.id,
		myTeam: canonical.myTeam,
		allTeams: canonical.allTeams,
		playerIds: canonical.players.map(player => player.id),
		items: canonical.items,
		gameMode: canonical.gameMode!,
	});
	expect(reauthored).toEqual(canonical);
	expect(() => validateKoreMatchDefinition({ schemaVersion: KORE_MATCH_DEFINITION_VERSION, id: canonical.id, seed: 12345, settings: canonical, systems: createMatchSystemProfile(2).systems, systemOrder: createMatchSystemProfile(2).systemOrder })).not.toThrow();
});

function createDefaultBase(): ReturnType<typeof createCanonicalPlayableMatchSettings> {
	const base = createCanonicalPlayableMatchSettings();
	base.id = "00000000-0000-4000-8000-000000000000";
	base.players = base.players.map((player, index) => ({ ...player, id: `00000000-0000-4000-8000-00000000000${index.toString(16)}` }));
	return base;
}
