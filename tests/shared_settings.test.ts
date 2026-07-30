import { test, expect, describe } from "bun:test";
import { GameRegistry } from "../src/server/gameRegistry.js";
import { ServerRuntime, type ServerSocket } from "../src/server/runtime.js";
import { GameDatabase } from "../src/server/db.js";
import { createDefaultGameSettings } from "../src/settings/settings.js";
import { NetworkMessageType } from "../src/server/types.js";

describe("Share Validated Game Settings", () => {
	test("GameRegistry.create accepts valid settings and rejects invalid settings", () => {
		const db = new GameDatabase(":memory:");
		const registry = new GameRegistry(db);
		const validSettings = createDefaultGameSettings();

		const record = registry.create(validSettings, ["user-1", "user-2"]);
		expect(record).toBeDefined();
		expect(record.users).toEqual(["user-1", "user-2"]);

		const invalidSettings = { ...validSettings, playerCount: -5 };
		expect(() => registry.create(invalidSettings as any, ["user-1", "user-2"])).toThrow();
	});

	test("ServerRuntime handles shared validated settings and distributes INIT", () => {
		const db = new GameDatabase(":memory:");
		const registry = new GameRegistry(db);
		const runtime = new ServerRuntime(registry);

		const messages1: string[] = [];
		const socket1: ServerSocket = {
			data: { connectionId: "conn-1" },
			send: (msg) => messages1.push(msg),
		};

		const messages2: string[] = [];
		const socket2: ServerSocket = {
			data: { connectionId: "conn-2" },
			send: (msg) => messages2.push(msg),
		};

		runtime.open(socket1);
		runtime.open(socket2);

		runtime.message(socket1, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "user-1" }));
		runtime.message(socket2, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "user-2" }));

		const validSettings = createDefaultGameSettings();
		runtime.message(socket1, JSON.stringify({ type: "CREATE_GAME", settings: validSettings }));

		expect(messages1.some(m => m.includes("INIT"))).toBe(true);
		expect(messages2.some(m => m.includes("INIT"))).toBe(true);
	});
});
