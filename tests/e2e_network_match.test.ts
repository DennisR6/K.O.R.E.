import { describe, expect, test } from "bun:test";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { ServerRuntime, type ServerSocket } from "../src/server/runtime.ts";
import { NetworkMessageType, type WebSocketData } from "../src/server/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { RulePhase, MatchEndReason, type GameModeSettings } from "../src/rules/types.ts";
import { ankerItem, powerDashItem } from "../src/item/officialItems.ts";
import { validateReplayDocument } from "../src/replay/types.ts";
import { ReplayPlayer } from "../src/replay/player.ts";

const userOne = "11111111-1111-4111-8111-111111111111";
const userTwo = "22222222-2222-4222-8222-222222222222";

class FakeSocket implements ServerSocket {
	public sent: string[] = [];
	public listeners: Array<(event: MessageEvent) => void> = [];
	constructor(public data: WebSocketData) {}
	public send(message: string): void {
		this.sent.push(message);
	}
	public addEventListener(_type: "message", listener: (event: MessageEvent) => void): void {
		this.listeners.push(listener);
	}
	public receive(message: string): void {
		this.listeners.forEach((listener) => listener({ data: message } as MessageEvent));
	}
	public lastPacket(): any {
		return JSON.parse(this.sent.at(-1)!);
	}
}

describe("E2E Network Match Lifecycle", () => {
	test("runs complete network match with item authority, disconnect/reconnect, result, and replay persistence", () => {
		const database = new GameDatabase(":memory:");
		const registry = new GameRegistry(database, 1);
		const runtime = new ServerRuntime(registry);

		// Custom settings with items and item phase
		const baseSettings = createDefaultGameSettings(2, 1);
		baseSettings.items = [powerDashItem, ankerItem];
		const gameMode: GameModeSettings = {
			phases: [RulePhase.Item, RulePhase.Physics],
			maxItemsPerTurn: 1,
			itemEconomy: {
				fixedLoadouts: [
					{ team: 0, items: [{ itemId: "power-dash", uses: 2 }] },
					{ team: 1, items: [{ itemId: "anker", uses: 1 }] },
				],
				mapPickups: [],
			},
		};
		baseSettings.gameMode = gameMode;

		// 1. Connect and Create Game with custom settings
		const socketOne = new FakeSocket({ connectionId: "conn-1" });
		const socketTwo = new FakeSocket({ connectionId: "conn-2" });

		runtime.open(socketOne);
		runtime.open(socketTwo);

		runtime.message(socketOne, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: userOne }));
		runtime.message(socketTwo, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: userTwo }));

		const record = registry.create(baseSettings, [userOne, userTwo]);
		registry.connectUser(userOne);
		registry.connectUser(userTwo);

		socketOne.send(JSON.stringify({ type: NetworkMessageType.INIT, settings: registry.settingsForUser(record, userOne), ruleState: record.ruleState }));
		socketTwo.send(JSON.stringify({ type: NetworkMessageType.INIT, settings: registry.settingsForUser(record, userTwo), ruleState: record.ruleState }));

		const initOne = socketOne.lastPacket();
		const initTwo = socketTwo.lastPacket();

		expect(initOne.type).toBe(NetworkMessageType.INIT);
		expect(initTwo.type).toBe(NetworkMessageType.INIT);
		expect(initOne.ruleState.phase).toBe(RulePhase.Item);
		expect(initOne.settings.activeTeam).toBe(0);

		const gameId = record.id;
		const [actor1, actor2] = record.handler.getEntityManager().getEntities();

		// 2. Item Authority Test
		// User 2 (wrong team) tries to use item -> rejected
		runtime.message(socketTwo, JSON.stringify({
			type: NetworkMessageType.USE_ITEM,
			actorId: actor1.getId(),
			itemId: "power-dash",
			target: { type: "self" },
		}));
		expect(socketTwo.lastPacket().message).toBe("It is not your turn");

		// User 1 (active team) uses valid item -> accepted and broadcast
		runtime.message(socketOne, JSON.stringify({
			type: NetworkMessageType.USE_ITEM,
			actorId: actor1.getId(),
			itemId: "power-dash",
			target: { type: "self" },
		}));

		const itemBroadcastOne = socketOne.lastPacket();
		const itemBroadcastTwo = socketTwo.lastPacket();

		expect(itemBroadcastOne.type).toBe(NetworkMessageType.ITEM_USED);
		expect(itemBroadcastOne).toEqual(itemBroadcastTwo);
		expect(itemBroadcastOne.ruleState.itemUses).toBe(1);

		// Advance phase from Item to Physics via skip if required, or submit shot when phase is physics
		// Notice server registry.submitTurn requires physics phase
		record.ruleState = record.rules.advancePhase(record.ruleState);
		record.handler.setRuleState(record.ruleState);

		// 3. Turn Resolution (Physics Phase)
		runtime.message(socketOne, JSON.stringify({
			type: NetworkMessageType.SHOOT,
			actorId: actor1.getId(),
			angle: 0,
			power: 5,
		}));

		const turnBroadcastOne = socketOne.lastPacket();
		const turnBroadcastTwo = socketTwo.lastPacket();

		expect(turnBroadcastOne.type).toBe(NetworkMessageType.TURN);
		expect(turnBroadcastOne).toEqual(turnBroadcastTwo);
		expect(turnBroadcastOne.turnNumber).toBe(1);
		expect(turnBroadcastOne.activeTeam).toBe(1);

		// 4. Disconnect & SQLite Eviction & Reconnect
		runtime.close(socketOne);
		runtime.close(socketTwo);

		// Evict inactive game to SQLite database
		registry.evictInactive(Date.now() + 100);
		expect(registry.isCached(gameId)).toBe(false);

		// User Two reconnects
		const socketTwoReconnect = new FakeSocket({ connectionId: "conn-2-reconnect" });
		runtime.open(socketTwoReconnect);
		runtime.message(socketTwoReconnect, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: userTwo }));

		const restoredInit = socketTwoReconnect.lastPacket();
		expect(restoredInit.type).toBe(NetworkMessageType.INIT);
		expect(restoredInit.settings.id).toBe(gameId);
		expect(restoredInit.settings.activeTeam).toBe(1);
		expect(restoredInit.settings.turnNumber).toBe(1);

		// 5. Result & Replay Persistence
		const replay = registry.getReplay(gameId);
		expect(replay).toBeDefined();
		if (!replay) throw new Error("Replay missing");

		expect(() => validateReplayDocument(replay)).not.toThrow();
		expect(replay.actions.length).toBe(2);
		expect(replay.actions[0].type).toBe("itemUse");
		expect(replay.actions[1].type).toBe("shoot");

		const replayPlayer = new ReplayPlayer(replay);
		const replayFinalState = replayPlayer.playAll();
		expect(replayFinalState).toBeDefined();

		database.close();
	});
});
