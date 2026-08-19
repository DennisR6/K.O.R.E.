import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameDatabase } from "../src/server/db.ts";
import { serveDebugAssets } from "../src/server/debugAssets.ts";
import { DASHBOARD_DEBUG_ASSET_KEYS_PATH, serveDashboard } from "../src/server/dashboard.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";

test.serial("debug asset keys exchange into an isolated HttpOnly session", async () => {
	const database = new GameDatabase(":memory:");
	const root = mkdtempSync(join(tmpdir(), "kore-debug-assets-"));
	try {
		const registry = new GameRegistry(database);
		const dashboard = await serveDashboard(new Request(`https://example.test${DASHBOARD_DEBUG_ASSET_KEYS_PATH}`, { method: "POST", headers: { authorization: "Bearer 0123456789abcdef0123456789abcdef", "content-type": "application/json" }, body: JSON.stringify({ label: "designer" }) }), registry, { operatorSecret: "0123456789abcdef0123456789abcdef" }, database);
		expect(dashboard?.status).toBe(201);
		const created = await dashboard!.json() as { token: string };
		const session = await serveDebugAssets(new Request("https://example.test/debug-assets/session", { method: "POST", headers: { authorization: `Bearer ${created.token}` } }), database, "0123456789abcdef0123456789abcdef", root);
		expect(session?.status).toBe(200);
		expect(session?.headers.get("set-cookie")).toContain("HttpOnly");
		expect(session?.headers.get("set-cookie")).toContain("Path=/debug-assets");
		const cookie = session!.headers.get("set-cookie")!.split(";")[0]!;
		const list = await serveDebugAssets(new Request("https://example.test/debug-assets", { headers: { cookie } }), database, "0123456789abcdef0123456789abcdef", root);
		expect(list?.status).toBe(200);
		expect((await list!.json()).assets).toContainEqual(expect.objectContaining({ path: "arena.png", override: false }));
		const upload = await serveDebugAssets(new Request("https://example.test/debug-assets/arena.png", { method: "POST", headers: { cookie, "content-type": "image/png" }, body: new Uint8Array([1, 2, 3]) }), database, "0123456789abcdef0123456789abcdef", root);
		expect(upload?.status).toBe(200);
		const file = await serveDebugAssets(new Request("https://example.test/debug-assets/arena.png/file", { headers: { cookie } }), database, "0123456789abcdef0123456789abcdef", root);
		expect(file?.status).toBe(200);
		expect(new Uint8Array(await file!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
		const production = await serveDebugAssets(new Request("https://example.test/debug-assets/arena.png", { method: "POST", headers: { cookie, "content-type": "text/javascript" }, body: "bad" }), database, "0123456789abcdef0123456789abcdef", root);
		expect(production?.status).toBe(415);
		const denied = await serveDebugAssets(new Request("https://example.test/debug-assets"), database, "0123456789abcdef0123456789abcdef", root);
		expect(denied?.status).toBe(404);
	} finally {
		database.close();
		rmSync(root, { recursive: true, force: true });
	}
});
