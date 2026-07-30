import { test, expect, describe } from "bun:test";
import { discordPresence, DiscordPresenceManager } from "../src/discord/presence.js";

describe("Document Discord Configuration and No-Op", () => {
	test("discord presence methods are a complete no-op when disabled", () => {
		const originalId = process.env.DISCORD_CLIENT_ID;
		const originalEnabled = process.env.DISCORD_ENABLED;
		delete process.env.DISCORD_CLIENT_ID;
		delete process.env.DISCORD_ENABLED;

		const manager = new DiscordPresenceManager();
		expect(manager.setMenuState()).toBe(false);
		expect(manager.setMatchState("Arena", 0, 1)).toBe(false);
		expect(manager.update({ details: "Test", state: "State" })).toBe(false);
		expect(manager.getCurrentPresence()).toBeNull();

		expect(discordPresence.setMenuState()).toBe(false);

		if (originalId) process.env.DISCORD_CLIENT_ID = originalId;
		if (originalEnabled) process.env.DISCORD_ENABLED = originalEnabled;
	});
});
