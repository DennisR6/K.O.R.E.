import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameHandlerBuilder } from "../../src/engine/Handler.ts";
import { MatchEndReason, MatchStatus } from "../../src/rules/types.ts";
import { createDefaultGameSettings } from "../../src/settings/settings.ts";
import { GameDatabase } from "../../src/server/db.ts";
import { ensureBrowserBuild, launchBrowser, startTestServer, waitFor } from "./browserHarness.ts";

function createFrozenShare(dbPath: string): string {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings()).build();
	handler.finishMatch({ status: MatchStatus.Draw, winnerTeam: null, reason: MatchEndReason.Draw, turnNumber: 0 });
	const finalSettings = handler.toSettings();
	const db = new GameDatabase(dbPath);
	db.createGame({ id: "private-game", settings: finalSettings, users: ["private-a", "private-b"], currentTeam: 0, turnNumber: 0, updatedAt: 1, lifecycle: { version: 1, status: "completed", createdAt: 1, statusChangedAt: 1, completedAt: 1 } });
	const token = db.createReplayShare("private-game", { schemaVersion: 1, initialSettings: createDefaultGameSettings(), seed: 1, actions: [], finalSettings, result: finalSettings.matchResult!, completedAt: 1 }).token;
	db.close();
	return token;
}

test.serial("shared replay viewer loads by URL and manual token without opening a gameplay socket", async () => {
	await ensureBrowserBuild();
	const directory = mkdtempSync(join(tmpdir(), "kore-replay-viewer-"));
	const dbPath = join(directory, "replay.db");
	const token = createFrozenShare(dbPath);
	const server = await startTestServer({ dbPath });
	const browser = await launchBrowser();
	try {
		const page = await browser.newPage();
		await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { readText: async () => { throw new DOMException("denied", "NotAllowedError"); } } }));
		const sockets: string[] = [];
		page.on("websocket", socket => sockets.push(socket.url()));
		await page.goto(`${server.url}/?replay=${token}`);
		await waitFor(async () => {
			const text = await page.locator("#replay-viewer-controls [role=status]").textContent();
			if (text?.includes("unavailable")) throw new Error(`direct replay load failed: ${text}`);
			const error = await page.evaluate(() => (window as any).replayViewer?.getErrorState?.());
			if (error) throw new Error(`direct replay decode failed: ${error}`);
			return text === "Replay loaded. No actions have been recorded yet.";
		}, 10_000, 50, "direct replay load");
		expect(sockets).toEqual([]);
		const input = page.locator("#replay-viewer-controls input");
		await input.fill(token);
		await page.getByRole("button", { name: "Load replay" }).evaluate((button: HTMLButtonElement) => button.click());
		await waitFor(async () => await page.locator("#replay-viewer-controls [role=status]").textContent() === "Replay loaded. No actions have been recorded yet.", 10_000, 50, "manual replay load");
		await page.getByRole("button", { name: "Paste from clipboard" }).evaluate((button: HTMLButtonElement) => button.click());
		await waitFor(async () => (await page.locator("#replay-viewer-controls [role=status]").textContent())?.includes("Clipboard access was denied") ?? false, 10_000, 50, "clipboard denial recovery");
		await input.fill("bad");
		await page.getByRole("button", { name: "Load replay" }).evaluate((button: HTMLButtonElement) => button.click());
		expect(await page.locator("#replay-viewer-controls [role=status]").textContent()).toBe("Enter a valid replay share ID.");
	} finally {
		await browser.close();
		await server.stop();
		rmSync(directory, { recursive: true, force: true });
	}
}, 120_000);
