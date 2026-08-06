import { test, expect, describe } from "bun:test";
import { DiscordPresenceManager } from "../src/discord/presence.js";

describe("Report Discord Match Presence", () => {
	test("is a no-op when Discord is disabled", () => {
		const originalId = process.env.DISCORD_CLIENT_ID;
		delete process.env.DISCORD_CLIENT_ID;

		const manager = new DiscordPresenceManager();
		const updated = manager.setMenuState();
		expect(updated).toBe(false);
		expect(manager.getCurrentPresence()).toBeNull();

		if (originalId) process.env.DISCORD_CLIENT_ID = originalId;
	});

	test("updates menu and match presence when active", () => {
		const originalId = process.env.DISCORD_CLIENT_ID;
		process.env.DISCORD_CLIENT_ID = "1234567890";

		const manager = new DiscordPresenceManager();
		const menuUpdated = manager.setMenuState();
		expect(menuUpdated).toBe(true);
		expect(manager.getCurrentPresence()?.details).toBe("Main Menu");

		const matchUpdated = manager.setMatchState("Ice Arena", 0, 1);
		expect(matchUpdated).toBe(true);
		expect(manager.getCurrentPresence()?.details).toContain("Ice Arena");
		expect(manager.getCurrentPresence()?.state).toContain("Turn 1");

		if (originalId) process.env.DISCORD_CLIENT_ID = originalId;
		else delete process.env.DISCORD_CLIENT_ID;
	});
});
