import { describe, expect, test, afterAll } from "bun:test";
import {
	activeBrowserServers,
	activeGameModeId,
	assertCleanConsole,
	captureConsole,
	canvasGeometry,
	clickWorld,
	dragWorld,
	ensureBrowserBuild,
	finiteEntities,
	launchBrowser,
	openPage,
	readMatchState,
	startTestServer,
	waitFor,
} from "./browserHarness.ts";

/**
 * Section 16.4: browser gameplay controls and the full result flow.
 *
 * Every interaction goes through real browser pointer events: item use and
 * skip through the browser-visible item panel, drag-to-shoot, result overlay
 * rematch/menu buttons. The kill shot is deterministic and pixel-exact:
 * drags are quantized by Chromium to integer pixels (world grid 0.625 at
 * 1280x720), and the drag vector (175.625, -2.5) reproduces the verified
 * kill angle 179.1849 at power 10 exactly - the team-1 figure ends dead
 * (verified against the authoritative simulation and in the real browser).
 */

/** World-coordinate centers of the visible browser controls. */
const ITEM_BUTTON_WORLD = { x: 645, y: 81 };
const SKIP_BUTTON_WORLD = { x: 660, y: 151 };
const REMATCH_BUTTON_WORLD = { x: 317.5, y: 324 };
const MENU_BUTTON_WORLD = { x: 482.5, y: 324 };

/** Grid-exact kill drag vector (world units, 0.625 grid at 1280x720). */
const KILL_DRAG_VECTOR = { dx: 175.625, dy: -2.5 };

/**
 * Returns the pixel-quantized drag start (the shooter spawn (132,132)
 * quantizes to (131.875,131.875)) and the grid-exact drag end.
 */
function killDrag(shooter: { x: number; y: number }): { from: { x: number; y: number }; to: { x: number; y: number } } {
	const from = { x: Math.floor(shooter.x * 1.6) / 1.6, y: Math.floor(shooter.y * 1.6) / 1.6 };
	return { from, to: { x: from.x + KILL_DRAG_VECTOR.dx, y: from.y + KILL_DRAG_VECTOR.dy } };
}

async function readMatchResult(page: import("playwright").Page): Promise<{
	status: string;
	winnerTeam: number | null;
	reason: string;
	turnNumber: number;
} | null> {
	return await page.evaluate(() => {
		const handler = (window as any).game.handler;
		return handler.getMatchResult() ?? null;
	});
}

async function enterLocalMatch(page: import("playwright").Page): Promise<void> {
	await clickWorld(page, 400, 100); // landing page
	await clickWorld(page, 400, 325); // "Play Local Game"
	await waitFor(async () => (await activeGameModeId(page)) === "local-ice-duel-v1", 10_000, 100, "canonical local match");
	const state = await readMatchState(page);
	expect(state.state).toBe("GameState.Your_turn");
	expect(state.phase).toBe("item");
	expect(state.turnNumber).toBe(0);
	expect(state.activeTeam).toBe(0);
	expect(state.entities).toHaveLength(2);
	expect(state.entities.filter(entity => !entity.dead)).toHaveLength(2);
	expect(finiteEntities(state)).toBe(true);
}

/** Skips the item phase and plays the deterministic kill shot; waits for Game_over. */
async function playKillTurn(page: import("playwright").Page): Promise<void> {
	await clickWorld(page, SKIP_BUTTON_WORLD.x, SKIP_BUTTON_WORLD.y);
	await waitFor(async () => (await readMatchState(page)).phase === "physics", 5_000, 100, "physics phase");
	const shooter = (await readMatchState(page)).entities.find(entity => entity.team.includes(0))!;
	const drag = killDrag(shooter);
	await dragWorld(page, drag.from, drag.to);
	await waitFor(async () => (await readMatchState(page)).state === "GameState.Game_over", 60_000, 100, "match end");
}

describe("Section 16.4 browser gameplay controls and result flow", () => {
	afterAll(() => {
		expect(activeBrowserServers()).toBe(0);
	});

	test("item use, item skip, kill turn, result overlay, rematch, and menu exit", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url);
			const capture = captureConsole(page);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");
			await enterLocalMatch(page);

			// Legal item use through the visible browser panel: the team-0
			// figure holds one power-dash loadout; using it consumes the
			// allowance without leaving the item phase.
			await clickWorld(page, ITEM_BUTTON_WORLD.x, ITEM_BUTTON_WORLD.y);
			const afterUse = await readMatchState(page);
			expect(afterUse.itemUses).toBe(1);
			expect(afterUse.phase).toBe("item");
			expect(afterUse.state).toBe("GameState.Your_turn");

			// Item-phase skip through the panel, then the deterministic kill.
			await playKillTurn(page);

			// The match reached an explicit winner: team 0 is the last team
			// standing; the result overlay condition is visible.
			const result = await readMatchResult(page);
			expect(result).not.toBeNull();
			expect(result?.status).toBe("winner");
			expect(result?.winnerTeam).toBe(0);
			expect(result?.reason).toBe("last-team-standing");
			const ended = await readMatchState(page);
			expect(ended.state).toBe("GameState.Game_over");
			expect(ended.entities.find(entity => entity.team.includes(1))?.dead).toBe(true);

			// Rematch restores a fresh playable state.
			await clickWorld(page, REMATCH_BUTTON_WORLD.x, REMATCH_BUTTON_WORLD.y);
			const fresh = await readMatchState(page);
			expect(fresh.state).toBe("GameState.Your_turn");
			expect(fresh.turnNumber).toBe(0);
			expect(fresh.phase).toBe("item");
			expect(fresh.itemUses).toBe(0);
			expect(fresh.entities.filter(entity => !entity.dead)).toHaveLength(2);
			expect(await readMatchResult(page)).toBeNull();
			// The team-0 figure is back at its canonical spawn.
			const shooter = fresh.entities.find(entity => entity.team.includes(0))!;
			expect(Math.hypot(shooter.x - 132, shooter.y - 132)).toBeLessThan(0.5);

			// Play and finish a second full match, then exit to the menu.
			await playKillTurn(page);
			expect((await readMatchResult(page))?.status).toBe("winner");
			await clickWorld(page, MENU_BUTTON_WORLD.x, MENU_BUTTON_WORLD.y);
			await waitFor(async () => (await activeGameModeId(page)) === null, 5_000, 100, "menu state");
			expect(await canvasGeometry(page)).toBeTruthy();

			assertCleanConsole(capture);
		} finally {
			await browser.close();
			await server.stop();
		}
		expect(activeBrowserServers()).toBe(0);
	}, 180_000);

	test("a drag during the item phase is rejected without mutating the match", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url);
			const capture = captureConsole(page);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");
			await enterLocalMatch(page);

			// Drag-to-shoot while the item phase is active: the shared action
			// validation rejects the shot (not in the physics phase), the turn
			// never starts, and no match state mutates.
			const shooter = (await readMatchState(page)).entities.find(entity => entity.team.includes(0))!;
			const drag = killDrag(shooter);
			await dragWorld(page, drag.from, drag.to);
			await waitFor(async () => (await readMatchState(page)).state === "GameState.Your_turn", 5_000, 100, "rejected input settles");
			const rejected = await readMatchState(page);
			expect(rejected.phase).toBe("item");
			expect(rejected.turnNumber).toBe(0);
			expect(rejected.itemUses).toBe(0);
			expect(rejected.entities.filter(entity => !entity.dead)).toHaveLength(2);
			const unmovedShooter = rejected.entities.find(entity => entity.team.includes(0))!;
			expect(Math.hypot(unmovedShooter.x - 132, unmovedShooter.y - 132)).toBeLessThan(0.5);
			expect(await readMatchResult(page)).toBeNull();

			assertCleanConsole(capture);
		} finally {
			await browser.close();
			await server.stop();
		}
		expect(activeBrowserServers()).toBe(0);
	}, 120_000);
});
