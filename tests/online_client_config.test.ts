import { describe, expect, test } from "bun:test";
import {
	buildOnlineJoinUrl,
	fetchOnlineServerConfig,
	resolveOnlineServerUrl,
	wsUrlFromLocation,
} from "../src/utils/onlineConfig.js";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
	return new Response(ok ? JSON.stringify(body) : String(body), { status });
}

describe("client online-play config", () => {
	test("derives the WebSocket URL from the page origin", () => {
		expect(wsUrlFromLocation({ protocol: "https:", host: "lupricht.net" })).toBe("wss://lupricht.net");
		expect(wsUrlFromLocation({ protocol: "http:", host: "localhost:4001" })).toBe("ws://localhost:4001");
	});

	test("parses the server config endpoint", async () => {
		const config = await fetchOnlineServerConfig(
			async () => jsonResponse({ baseUrl: "https://lupricht.net/kore", wsUrl: "wss://lupricht.net/kore" }),
			"/config",
		);
		expect(config).toEqual({ baseUrl: "https://lupricht.net/kore", wsUrl: "wss://lupricht.net/kore" });
	});

	test("uses a document-relative config endpoint for path-prefix deployments", async () => {
		let requested = "";
		await fetchOnlineServerConfig(async (input) => {
			requested = String(input);
			return jsonResponse({ baseUrl: "https://lupricht.net/kore/", wsUrl: "wss://lupricht.net/kore/" });
		});
		expect(requested).toBe("config");
	});

	test("rejects failing or malformed config responses", async () => {
		await expect(
			fetchOnlineServerConfig(async () => jsonResponse("nope", false, 404)),
		).rejects.toThrow(/HTTP 404/);
		await expect(
			fetchOnlineServerConfig(async () => jsonResponse({ baseUrl: "https://x" })),
		).rejects.toThrow(/Malformed server config/);
		await expect(
			fetchOnlineServerConfig(async () => jsonResponse({ baseUrl: "", wsUrl: "" })),
		).rejects.toThrow(/Malformed server config/);
	});

	test("prefers the server config, then the page origin, then the default deployment", async () => {
		expect(await resolveOnlineServerUrl({
			fetchImpl: async () => jsonResponse({ baseUrl: "https://a/b", wsUrl: "wss://a/b" }),
			location: { protocol: "http:", host: "localhost:1" },
		})).toBe("wss://a/b");

		expect(await resolveOnlineServerUrl({
			fetchImpl: async () => { throw new Error("no config"); },
			location: { protocol: "https:", host: "example.org" },
		})).toBe("wss://example.org");

		// No location and no config: the canonical deployment is the last resort.
		expect(await resolveOnlineServerUrl({
			fetchImpl: async () => { throw new Error("no config"); },
		})).toBe("wss://lupricht.net/kore/");
	});

	test("builds the join URL with skipmenu and the configured server, preserving the path", async () => {
		const joinUrl = await buildOnlineJoinUrl("https://lupricht.net/kore?mapbuilder=1", {
			fetchImpl: async () => jsonResponse({ baseUrl: "https://lupricht.net/kore", wsUrl: "wss://lupricht.net/kore" }),
			location: { protocol: "https:", host: "lupricht.net" },
		});
		const url = new URL(joinUrl);
		expect(url.pathname).toBe("/kore");
		expect(url.searchParams.get("skipmenu")).toBe("1");
		expect(url.searchParams.get("url")).toBe("wss://lupricht.net/kore");
	});
});
