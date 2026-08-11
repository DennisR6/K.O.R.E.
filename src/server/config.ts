/**
 * Server-published online-play configuration.
 *
 * The public base URL of the game server is read from the `KORE_BASE_URL`
 * environment variable and defaults to the canonical deployment at
 * https://lupricht.net/kore. The server publishes it to the browser through
 * the `/config` JSON endpoint so the menu's "Play Online" action can join a
 * match without hardcoding a client-side server URL.
 */
export const DEFAULT_KORE_BASE_URL = "https://lupricht.net/kore/";
/** Deployment marker used to verify that the staging hook has published the expected build. */
export const DEPLOYMENT_HASH = "2148c4e73588f482f566b6abbf24859e9cfd345d";

export interface ServerConfig {
	baseUrl: string;
	wsUrl: string;
}

/** Resolves durable storage independently of the process working directory. */
export function resolveGameDatabasePath(env: Record<string, string | undefined>, serverDirectory: string): string {
	const configured = env.GAME_DB_PATH?.trim();
	return configured && configured.length > 0 ? configured : `${serverDirectory.replace(/[\\/]$/, "")}/data/kore.db`;
}

/** Converts an http(s) base URL into the matching WebSocket URL. */
export function wsUrlForBaseUrl(baseUrl: string): string {
	const url = new URL(baseUrl);
	if (url.protocol === "https:") url.protocol = "wss:";
	else if (url.protocol === "http:") url.protocol = "ws:";
	return url.toString()
}

/** Reads and validates the online-play configuration from the environment. */
export function readServerConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
	const raw = env.KORE_BASE_URL && env.KORE_BASE_URL.length > 0 ? env.KORE_BASE_URL : DEFAULT_KORE_BASE_URL;
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new Error(`KORE_BASE_URL is not an absolute URL: "${raw}"`);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error(`KORE_BASE_URL must be an http(s) URL, got: "${raw}"`);
	}
	const baseUrl = url.toString()
	return { baseUrl, wsUrl: wsUrlForBaseUrl(baseUrl) };
}

/** JSON response for the `/config` endpoint; never cached. */
export function serveConfig(config: ServerConfig): Response {
	return Response.json(
		{ baseUrl: config.baseUrl, wsUrl: config.wsUrl, buildHash: DEPLOYMENT_HASH },
		{ headers: { "cache-control": "no-store" } },
	);
}
