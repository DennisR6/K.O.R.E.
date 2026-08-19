import { afterAll, describe, expect, test } from "bun:test";
import {
	activeBrowserServers,
	nextTestPort,
	startTestServer,
} from "./browser/browserHarness.ts";
import { DEPLOYMENT_HASH } from "../src/server/config.ts";

/**
 * Section 18: the real Bun server publishes the `KORE_BASE_URL` environment
 * value through the `/config` endpoint, which is what the browser menu's
 * "Play Online" action reads to join a match.
 */
describe("Section 18 server /config endpoint integration", () => {
	afterAll(() => {
		// Every server started by this worker must be terminated.
		expect(activeBrowserServers()).toBe(0);
	});

	test("publishes the KORE_BASE_URL environment value over HTTP", async () => {
		const port = nextTestPort();
		const server = await startTestServer({ port, env: { KORE_BASE_URL: "https://example.org/kore" } });
		try {
			const response = await fetch(`${server.url}/config`);
			expect(response.status).toBe(200);
			expect(response.headers.get("cache-control")).toBe("no-store");
				expect(await response.json()).toEqual({
				baseUrl: "https://example.org/kore",
				wsUrl: "wss://example.org/kore",
				buildHash: DEPLOYMENT_HASH,
			});
		} finally {
			await server.stop();
		}
		expect(server.isAlive()).toBe(false);
		expect(activeBrowserServers()).toBe(0);
	}, 30_000);

	test("defaults to the canonical deployment when the environment is unset", async () => {
		const port = nextTestPort();
		const server = await startTestServer({ port, env: { KORE_BASE_URL: "" } });
		try {
			const response = await fetch(`${server.url}/config`);
			expect(response.status).toBe(200);
				expect(await response.json()).toEqual({
				baseUrl: "https://lupricht.net/kore/",
				wsUrl: "wss://lupricht.net/kore/",
				buildHash: DEPLOYMENT_HASH,
			});
		} finally {
			await server.stop();
		}
		expect(server.isAlive()).toBe(false);
		expect(activeBrowserServers()).toBe(0);
	}, 30_000);
});
