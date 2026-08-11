import { describe, expect, test } from "bun:test";
import {
	DEFAULT_KORE_BASE_URL,
	readServerConfig,
	resolveGameDatabasePath,
	serveConfig,
	wsUrlForBaseUrl,
} from "../src/server/config.js";

describe("server online-play config", () => {
	test("defaults to the canonical base URL when the environment is unset", () => {
		const config = readServerConfig({});
		expect(config.baseUrl).toBe("https://lupricht.net/kore/");
		expect(config.wsUrl).toBe("wss://lupricht.net/kore/");
		expect(config.baseUrl).toBe(DEFAULT_KORE_BASE_URL);
	});

	test("reads KORE_BASE_URL from the environment", () => {
		const config = readServerConfig({ KORE_BASE_URL: "http://localhost:4001" });
		expect(config.baseUrl).toBe("http://localhost:4001/");
		expect(config.wsUrl).toBe("ws://localhost:4001/");
	});

	test("treats an empty environment value as unset", () => {
		const config = readServerConfig({ KORE_BASE_URL: "" });
		expect(config.baseUrl).toBe(DEFAULT_KORE_BASE_URL);
		expect(config.wsUrl).toBe("wss://lupricht.net/kore/");
	});

	test("anchors the default durable database path to the server directory", () => {
		expect(resolveGameDatabasePath({}, "/srv/kore")).toBe("/srv/kore/data/kore.db");
		expect(resolveGameDatabasePath({ GAME_DB_PATH: "/var/lib/kore/matches.db" }, "/srv/kore")).toBe("/var/lib/kore/matches.db");
		expect(resolveGameDatabasePath({ GAME_DB_PATH: "  " }, "/srv/kore")).toBe("/srv/kore/data/kore.db");
	});

	test("normalizes trailing slashes and derives the WebSocket URL", () => {
		expect(wsUrlForBaseUrl("https://example.org/kore/")).toBe("wss://example.org/kore/");
		expect(wsUrlForBaseUrl("http://example.org:8080/game")).toBe("ws://example.org:8080/game");
		const config = readServerConfig({ KORE_BASE_URL: "https://example.org/kore/" });
		expect(config.baseUrl).toBe("https://example.org/kore/");
		expect(config.wsUrl).toBe("wss://example.org/kore/");
	});

	test("rejects malformed environment values", () => {
		expect(() => readServerConfig({ KORE_BASE_URL: "not a url" })).toThrow(/not an absolute URL/);
		expect(() => readServerConfig({ KORE_BASE_URL: "ftp://example.org" })).toThrow(/must be an http\(s\) URL/);
	});

	test("serveConfig publishes the JSON contract without caching", async () => {
		const response = serveConfig({ baseUrl: "https://example.org/kore", wsUrl: "wss://example.org/kore" });
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.json()).toEqual({
			baseUrl: "https://example.org/kore",
			wsUrl: "wss://example.org/kore",
			buildHash: "7ec555fc4e3e61352c61ef64174c9958343e009f",
		});
	});
});
