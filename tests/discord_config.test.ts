import { test, expect, describe } from "bun:test";
import { getDiscordConfig } from "../src/discord/config.js";

describe("Configure Discord Integration", () => {
	test("defaults to disabled when no env vars are present", () => {
		const originalId = process.env.DISCORD_CLIENT_ID;
		const originalEnabled = process.env.DISCORD_ENABLED;
		delete process.env.DISCORD_CLIENT_ID;
		delete process.env.DISCORD_ENABLED;

		const config = getDiscordConfig();
		expect(config.enabled).toBe(false);
		expect(config.clientId).toBeUndefined();

		if (originalId) process.env.DISCORD_CLIENT_ID = originalId;
		if (originalEnabled) process.env.DISCORD_ENABLED = originalEnabled;
	});

	test("configures enabled state when client ID is provided via env", () => {
		const originalId = process.env.DISCORD_CLIENT_ID;
		process.env.DISCORD_CLIENT_ID = "1234567890";

		const config = getDiscordConfig();
		expect(config.enabled).toBe(true);
		expect(config.clientId).toBe("1234567890");
		expect(config.active).toBe(true);

		if (originalId) process.env.DISCORD_CLIENT_ID = originalId;
		else delete process.env.DISCORD_CLIENT_ID;
	});
});
