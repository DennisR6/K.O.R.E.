import type { DiscordConfig } from "./types.js";

export function getDiscordConfig(): DiscordConfig {
	const enabled = process.env.DISCORD_ENABLED === "true" || Boolean(process.env.DISCORD_CLIENT_ID);
	const clientId = process.env.DISCORD_CLIENT_ID;
	return {
		enabled,
		clientId,
		active: enabled && Boolean(clientId),
	};
}
