import { expect, test } from "bun:test";
import { kore } from "../src/kore/sdk/index.ts";
import { RuleInterpreter } from "../src/rules/RuleInterpreter.ts";
import { GAME_MODE_CATALOG, GAME_MODE_CATALOG_SCHEMA_VERSION, getGameModeCatalogEntry } from "../src/rules/modeCatalog.ts";
import { RulePhase } from "../src/rules/types.ts";
import { createMatchHandler } from "../src/scenes/matchPipeline.ts";
import { parseKoreMenuCommand, KoreMenuCommand, KoreMenuMapIntent } from "../src/kore/ui/menuVocabulary.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { ServerRuntime, type ServerSocket } from "../src/server/runtime.ts";
import { NetworkMessageType, type WebSocketData } from "../src/server/types.ts";

class ModeSocket implements ServerSocket {
	public sent: string[] = [];
	public constructor(public data: WebSocketData) { }
	public send(value: string): void { this.sent.push(value); }
}

test("Milestone 47 exposes two versioned SDK-authored selectable modes", () => {
	const modes = kore.gameModes.list();
	expect(GAME_MODE_CATALOG_SCHEMA_VERSION).toBe(1);
	expect(modes.length).toBeGreaterThanOrEqual(2);
	expect(new Set(modes.map(mode => mode.id)).size).toBe(modes.length);
	for (const entry of modes) {
		expect(entry.schemaVersion).toBe(1);
		expect(entry.mode.schemaVersion).toBe(1);
		expect(() => new RuleInterpreter(entry.mode)).not.toThrow();
	}
	expect(() => kore.createGameMode({ id: "future", schemaVersion: 2 as 1, phases: [RulePhase.Physics] })).toThrow("Unsupported game mode schema version");
	expect(() => getGameModeCatalogEntry("not-a-mode")).toThrow("Unknown or unavailable");
});

test("mode rule traces are deterministic and Complete remains a runtime sentinel", () => {
	for (const entry of GAME_MODE_CATALOG) {
		const first = new RuleInterpreter(entry.mode);
		const second = new RuleInterpreter(structuredClone(entry.mode));
		let left = first.initialState(0, 3);
		let right = second.initialState(0, 3);
		while (left.phase !== RulePhase.Complete) {
			left = first.advancePhase(left);
			right = second.advancePhase(right);
			expect(left).toEqual(right);
		}
		expect(first.startNextTurn(left, 2)).toEqual({ phase: entry.mode.phases[0], activeTeam: 1, turnNumber: 4, itemUses: 0 });
	}
});

test("each selectable mode survives match construction and engine snapshot restore", () => {
	for (const entry of GAME_MODE_CATALOG) {
		const handler = createMatchHandler({ mode: "ai-battle", mapId: "ice-map-v1", gameModeId: entry.id, seed: 47 });
		const snapshot = handler.toSettings();
		expect(snapshot.gameMode?.id).toBe(entry.id);
		expect(kore.restoreHandler(snapshot).toSettings().gameMode).toEqual(snapshot.gameMode);
		handler.dispose();
	}
});

test("menu mode payloads are validated at the KORE vocabulary boundary", () => {
	const modeId = GAME_MODE_CATALOG[0]!.id;
	expect(parseKoreMenuCommand(KoreMenuCommand.SelectMap, { intent: KoreMenuMapIntent.Local, mapId: "ice-map-v1", modeId })).toMatchObject({ payload: { modeId } });
	expect(parseKoreMenuCommand(KoreMenuCommand.SelectMap, { intent: KoreMenuMapIntent.Local, mapId: "ice-map-v1", modeId: "unknown" })).toBeUndefined();
});

test("SDK map builds no longer emit an invalid configured Complete phase", () => {
	const map = kore.createDefaultMap({ id: "milestone-47-map" }).addPlayerSpawn({ teamNr: 0, x: 20, y: 20, w: 100, h: 100, playerCount: 1 }).addPlayerSpawn({ teamNr: 1, x: 680, y: 320, w: 100, h: 100, playerCount: 1 });
	const settings = map.build();
	expect(settings.gameMode?.phases).not.toContain(RulePhase.Complete);
});

test.serial("online initialization negotiates the same catalog mode and persists it in settings", () => {
	const database = new GameDatabase(":memory:");
	const runtime = new ServerRuntime(new GameRegistry(database));
	const one = new ModeSocket({ connectionId: "11111111-1111-4111-8111-111111111111" });
	const two = new ModeSocket({ connectionId: "22222222-2222-4222-8222-222222222222" });
	runtime.open(one); runtime.open(two);
	const login = (socket: ModeSocket, user: string) => runtime.message(socket, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: user, modePreference: "power-rush-v1" }));
	login(one, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"); login(two, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
	runtime.matchmakeOnce();
	const init = JSON.parse(one.sent.at(-1)!);
	expect(init.settings.gameMode.id).toBe("power-rush-v1");
	expect(init.modeId).toBe("power-rush-v1");
	expect(init.ruleState.phase).toBe(RulePhase.Item);
	database.close();
});
