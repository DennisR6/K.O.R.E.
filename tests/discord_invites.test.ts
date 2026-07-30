import { test, expect, describe } from "bun:test";
import { validateGameIdentifier, parseDiscordInvite } from "../src/discord/invites.js";
import { GameRegistry } from "../src/server/gameRegistry.js";
import { ServerRuntime, type ServerSocket } from "../src/server/runtime.js";
import { GameDatabase } from "../src/server/db.js";
import { createDefaultGameSettings } from "../src/settings/settings.js";
import { NetworkMessageType } from "../src/server/types.js";

describe("Support Discord Game Invites", () => {
	test("validates game identifiers and parses Discord invites", () => {
		const validUuid = "123e4567-e89b-12d3-a456-426614174000";
		expect(validateGameIdentifier(validUuid)).toBe(true);
		expect(validateGameIdentifier("")).toBe(false);

		const invite = parseDiscordInvite({ gameId: validUuid, secret: "sec" });
		expect(invite.gameId).toBe(validUuid);
		expect(invite.secret).toBe("sec");

		expect(() => parseDiscordInvite({ gameId: "" })).toThrow();
	});

	test("ServerRuntime handles DISCORD_JOIN invite payloads", () => {
		const db = new GameDatabase(":memory:");
		const registry = new GameRegistry(db);
		const runtime = new ServerRuntime(registry);

		const settings = createDefaultGameSettings();
		const record = registry.create(settings, ["user-1", "user-2"]);

		const messages: string[] = [];
		const socket: ServerSocket = {
			data: { connectionId: "conn-invite" },
			send: (msg) => messages.push(msg),
		};

		runtime.open(socket);
		runtime.message(socket, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "user-1" }));
		runtime.message(socket, JSON.stringify({ type: "DISCORD_JOIN", payload: { gameId: record.id } }));

		expect(messages.some(m => m.includes("INIT"))).toBe(true);
	});
});
