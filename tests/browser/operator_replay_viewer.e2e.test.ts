import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultGameSettings } from "../../src/settings/settings.ts";
import { GameDatabase } from "../../src/server/db.ts";
import { GameRegistry } from "../../src/server/gameRegistry.ts";
import { ensureBrowserBuild, launchBrowser, nextTestPort, startTestServer, waitFor } from "./browserHarness.ts";

const secret = "operator-replay-viewer-secret-at-least-32-bytes";
const users = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];

test.serial("operator View replay starts playback for an unfinished persisted match", async () => {
	await ensureBrowserBuild();
	const directory = mkdtempSync(join(tmpdir(), "kore-operator-replay-"));
	const dbPath = join(directory, "replay.db");
	const database = new GameDatabase(dbPath);
	const registry = new GameRegistry(database);
	const record = registry.create(createDefaultGameSettings(2, 1), users);
	const actorId = record.handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!.getId();
	expect(registry.submitTurn(users[0]!, { actorId, angle: 0, power: 4 }).ok).toBe(true);
	const gameId = record.id;
	database.close();
	const port = nextTestPort();
	const server = await startTestServer({ port, dbPath, env: { KORE_BASE_URL: `http://localhost:${port}`, KORE_DASHBOARD_OPERATOR_SECRET: secret } });
	const browser = await launchBrowser();
	try {
		const response = await fetch(`${server.url}/operator/replays/${gameId}/view`, { headers: { authorization: `Bearer ${secret}` }, redirect: "manual" });
		expect(response.status).toBe(303);
		const location = response.headers.get("location")!;
		expect(location).toMatch(new RegExp(`^${server.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/\\?replay=[a-f0-9]{32}$`));
		const page = await browser.newPage();
		await page.goto(location);
		await waitFor(async () => await page.locator("#replay-viewer-controls [role=status]").textContent() === "Replay loaded. Playback is read-only.", 10_000, 50, "operator replay load");
		await waitFor(async () => await page.evaluate(() => (window as any).replayViewer?.getPlayer?.()?.getHandler?.().getState?.() === "GameState.Playing"), 10_000, 25, "operator replay playback start");
	} finally {
		await browser.close();
		await server.stop();
		rmSync(directory, { recursive: true, force: true });
	}
}, 120_000);
