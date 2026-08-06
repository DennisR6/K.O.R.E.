import { DEFAULT_KORE_BASE_URL, wsUrlForBaseUrl } from "../server/config.js";

/**
 * Browser-side online-play configuration.
 *
 * The server advertises its public base URL and matching WebSocket URL through
 * `/config` (see `src/server/config.ts`). This module fetches that contract
 * and falls back to the page origin and finally to the built-in default
 * deployment so "Play Online" works even when the page is served without the
 * Bun backend.
 */

export interface OnlineServerConfig {
	baseUrl: string;
	wsUrl: string;
}

/** Derives a WebSocket URL from the page origin (browser fallback). */
export function wsUrlFromLocation(location: { protocol: string; host: string }): string {
	const protocol = location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${location.host}`;
}

/** Fetches the server-advertised online-play configuration. */
export async function fetchOnlineServerConfig(
	fetchImpl: typeof fetch = fetch,
	// Relative rather than origin-rooted: a page at /kore/ must ask its
	// reverse-proxy mount for /kore/config, not an unrelated host-root /config.
	configPath = "config",
): Promise<OnlineServerConfig> {
	const response = await fetchImpl(configPath, { cache: "no-store" });
	if (!response.ok) throw new Error(`Server config unavailable: HTTP ${response.status}`);
	const body = (await response.json()) as Partial<OnlineServerConfig>;
	if (typeof body.baseUrl !== "string" || typeof body.wsUrl !== "string" || body.baseUrl === "" || body.wsUrl === "") {
		throw new Error("Malformed server config response");
	}
	return { baseUrl: body.baseUrl, wsUrl: body.wsUrl };
}

/**
 * Resolves the WebSocket URL used to join an online match: the server's
 * `/config` advertisement wins, then the page origin, then the built-in
 * default deployment.
 */
export async function resolveOnlineServerUrl(options: {
	fetchImpl?: typeof fetch;
	location?: { protocol: string; host: string };
	configPath?: string;
} = {}): Promise<string> {
	try {
		return (await fetchOnlineServerConfig(options.fetchImpl, options.configPath)).wsUrl;
	} catch {
		if (options.location) return wsUrlFromLocation(options.location);
		if (typeof window !== "undefined") return wsUrlFromLocation(window.location);
		return wsUrlForBaseUrl(DEFAULT_KORE_BASE_URL);
	}
}

/**
 * Absolute page URL that starts an online match on the configured server.
 * Preserves the current path (path-prefix deployments such as /kore) and adds
 * the `skipmenu` and `url` query parameters the network startup branch reads.
 */
export async function buildOnlineJoinUrl(
	pageUrl: string,
	options: {
		fetchImpl?: typeof fetch;
		location?: { protocol: string; host: string };
		configPath?: string;
		mapPreference?: string;
		modePreference?: string;
	} = {},
): Promise<string> {
	const url = new URL(pageUrl);
	url.searchParams.set("skipmenu", "1");
	url.searchParams.set("url", await resolveOnlineServerUrl(options));
	if (options.mapPreference) url.searchParams.set("map", options.mapPreference);
	if (options.modePreference) url.searchParams.set("mode", options.modePreference);
	return url.toString();
}
