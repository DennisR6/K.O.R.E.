import { expect, test } from "bun:test";
import { buildReplayShareEndpoint, buildReplayViewerUrl } from "../src/utils/replayUrls.ts";

const token = "0123456789abcdef0123456789abcdef";

test("replay URLs retain the application's public base path", () => {
	expect(buildReplayShareEndpoint("https://lupricht.net/kore/?replay=old", token)).toBe(`https://lupricht.net/kore/replays/${token}`);
	expect(buildReplayViewerUrl("https://lupricht.net/kore/?skipmenu=1", token)).toBe(`https://lupricht.net/kore/?replay=${token}`);
});

test("replay URLs still work from a root-mounted local server", () => {
	expect(buildReplayShareEndpoint("http://localhost:4001/?replay=old", token)).toBe(`http://localhost:4001/replays/${token}`);
	expect(buildReplayViewerUrl("http://localhost:4001/", token)).toBe(`http://localhost:4001/?replay=${token}`);
});
