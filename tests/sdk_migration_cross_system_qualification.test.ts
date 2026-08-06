import { expect, test } from "bun:test";
import { GameState } from "../src/engine/types.js";
import { GameEmitter } from "../src/emitter/EngineEmitter.js";
import { ReplayPlayer } from "../src/replay/player.js";
import { ReplayRecorder } from "../src/replay/recorder.js";
import { kore } from "../src/kore/sdk/index.js";
import { MapRepository } from "../src/server/mapRepository.js";
import { GameDatabase } from "../src/server/db.js";
import { GameRegistry } from "../src/server/gameRegistry.js";
import {
	QUALIFICATION_ITEM_ID,
	createLegacyQualificationHandler,
	createQualificationDefinition,
	createQualificationSettings,
	createSdkQualificationHandler,
	firstActorId,
	stableSnapshot,
} from "./support/sdkQualification.js";

test("SDK and legacy runtime construction produce equivalent canonical snapshots", () => {
	const settings = createQualificationSettings();
	const sdk = kore.createHandler(settings);
	const legacy = createLegacyQualificationHandler();
	expect(stableSnapshot(sdk.toSettings())).toBe(stableSnapshot(legacy.toSettings()));

	const actorId = firstActorId(sdk);
	const input = { actorId, angle: 0, power: 4 };
	sdk.resolveTurn(input);
	legacy.resolveTurn(input);
	expect(stableSnapshot(sdk.toSettings())).toBe(stableSnapshot(legacy.toSettings()));
	expect(sdk.getRuleState()).toEqual(legacy.getRuleState());
	expect(sdk.getMatchResult()).toEqual(legacy.getMatchResult());
});

test("SDK match definitions survive JSON, item inventory, and handler restoration", () => {
	const definition = createQualificationDefinition();
	const wire = JSON.parse(JSON.stringify(definition)) as typeof definition;
	const restoredDefinition = kore.createMatchDefinition({
		mapId: wire.mapId,
		settings: wire.settings,
		gameMode: wire.settings.gameMode!,
		seed: wire.seed,
		header: { myTeam: wire.settings.myTeam, allTeams: wire.settings.allTeams },
	});
	const handler = kore.createRuntimeMatch(restoredDefinition);
	const actorId = firstActorId(handler);
	handler.useItem(actorId, QUALIFICATION_ITEM_ID, { type: "self" });
	const snapshot = handler.toSettings();
	const restored = kore.restoreHandler(JSON.parse(JSON.stringify(snapshot)));
	const actor = restored.getEntityManager().getEntityById(actorId);
	expect(actor?.getInventory().find(item => item.itemId === QUALIFICATION_ITEM_ID)?.remainingUses).toBe(0);
	expect(stableSnapshot(restored.toSettings())).toBe(stableSnapshot(snapshot));
	});

test("SDK AI decisions and replay playback are deterministic", () => {
	const run = (): { actions: unknown[]; snapshot: string } => {
		const replaySettings = createQualificationSettings();
		replaySettings.gameMode = { id: "sdk-replay-mode-v1", phases: [kore.types.rulePhase.physics], maxItemsPerTurn: 0, winCondition: kore.types.winCondition.lastTeamStanding, itemEconomy: { fixedLoadouts: [], mapPickups: [] } };
		const handler = kore.createHandler(replaySettings);
		const actorId = firstActorId(handler);
		const aiSettings = kore.ai.createSettings({ difficulty: "easy", seed: 39003, team: 0 });
		const actions: unknown[] = [];
		const decided = kore.ai.createTurnEmitter(aiSettings).executeTurn(handler, aiSettings, {
			sendShot: (id, angle, power) => actions.push({ actorId: id, angle, power }),
		});
		expect(decided).toBe(true);
		expect(actions).toHaveLength(1);

		const recorder = new ReplayRecorder(handler.toSettings(), 39002);
		const shot = actions[0] as { actorId: string; angle: number; power: number };
		recorder.recordShoot(shot.actorId, shot.angle, shot.power);
		const replay = new ReplayPlayer(recorder.getReplay());
		replay.playAll();
		return { actions, snapshot: stableSnapshot(replay.getHandler().toSettings()) };
	};
	const first = run();
	const second = run();
	expect(second).toEqual(first);
	expect(first.actions).toHaveLength(1);
});

test("SDK-authored maps cross the approved repository boundary", () => {
	const database = new GameDatabase(":memory:");
	const settings = createQualificationSettings();
	const document = kore.createDefaultMap({ id: "00000000-0000-4000-8000-000000000039", name: "Repository Map" })
		.addTeam(kore.createTeam({ teamNr: 0, name: "A", playerCount: 1 }))
		.addTeam(kore.createTeam({ teamNr: 1, name: "B", playerCount: 1 }))
		.addPlayerSpawn({ teamNr: 0, playerCount: 1, x: 40, y: 180, w: 120, h: 90 })
		.addPlayerSpawn({ teamNr: 1, playerCount: 1, x: 640, y: 180, w: 120, h: 90 })
		.buildMapDocument();
	database.createMap({ id: document.metadata.id, document, status: "approved" });
	const repository = new MapRepository(database);
	const resolved = repository.buildSettings(document.metadata.id, settings);
	expect(resolved.map.id).toBe(document.metadata.id);
	expect(resolved.settings.mapReference?.mapId).toBe(document.metadata.id);
	expect(resolved.settings.mapReference?.contentHash).toBe(resolved.map.contentHash);
	expect(() => repository.buildSettings("missing-map", settings)).toThrow("not approved");
});

test("an approved SDK map survives authoritative turn persistence and eviction", () => {
	const database = new GameDatabase(":memory:");
	const mapId = "00000000-0000-4000-8000-000000000040";
	const mapDocument = kore.createDefaultMap({ id: mapId, name: "Network Qualification Map" })
		.addTeam(kore.createTeam({ teamNr: 0, name: "A", playerCount: 1 }))
		.addTeam(kore.createTeam({ teamNr: 1, name: "B", playerCount: 1 }))
		.addPlayerSpawn({ teamNr: 0, playerCount: 1, x: 40, y: 180, w: 120, h: 90 })
		.addPlayerSpawn({ teamNr: 1, playerCount: 1, x: 640, y: 180, w: 120, h: 90 })
		.buildMapDocument();
	database.createMap({ id: mapId, document: mapDocument, status: "approved" });
	const template = createQualificationSettings();
	template.gameMode = { id: "sdk-network-mode-v1", phases: [kore.types.rulePhase.physics], maxItemsPerTurn: 0, winCondition: kore.types.winCondition.lastTeamStanding, itemEconomy: { fixedLoadouts: [], mapPickups: [] } };
	const repository = new MapRepository(database);
	const registry = new GameRegistry(database);
	const record = registry.createFromApprovedMap(repository, mapId, template, ["user-a", "user-b"]);
	registry.connectUser("user-a");
	registry.connectUser("user-b");
	const actorId = firstActorId(record.handler);
	const result = registry.submitTurn("user-a", { actorId, angle: 0, power: 2 });
	expect(result.ok).toBe(true);
	const beforeEviction = record.handler.toSettings();
	registry.disconnectUser("user-a");
	registry.disconnectUser("user-b");
	expect(registry.isCached(record.id)).toBe(false);
	const restored = registry.get(record.id);
	expect(restored).toBeDefined();
	expect(restored!.handler.toSettings().mapReference).toEqual(beforeEviction.mapReference);
	expect(stableSnapshot(restored!.handler.toSettings())).toBe(stableSnapshot(beforeEviction));
});

test("qualification fixture has a live initial state and stable final fingerprints", () => {
	const handler = createSdkQualificationHandler();
	expect(handler.getState()).toBe(GameState.Your_turn);
	const actorId = firstActorId(handler);
	const emitter = new GameEmitter(handler, handler.toSettings().gameMode!, 2, 39004);
		emitter.skipPhase();
		emitter.skipPhase();
		emitter.skipPhase();
		emitter.skipPhase();
	emitter.sendShot(actorId, 0, 2);
	while (handler.getState() === GameState.Playing) handler.tick();
	const replay = emitter.recorder.getReplay();
	expect(replay.actions).toHaveLength(1);
	expect(stableSnapshot(handler.toSettings())).toContain("sdk-qualification-arena-v1");
});
