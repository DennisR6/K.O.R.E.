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
 * rematch/menu buttons. The eleven drags below are grid-exact: they start at
 * the quantized live position of the figure the authoritative search picked
 * (nearest live figure to the next spawn) and end at the quantized endpoint
 * whose derived angle is exactly the power-10 shot that kills one team-1
 * figure per turn. Power-10 ricochets also knock team-0 figures around (and
 * two team-0 figures die from ricochet blowback), so the match ends with
 * team 0 as the last team standing with four survivors.
 */

/** World-coordinate centers of the visible browser controls. */
const ITEM_BUTTON_WORLD = { x: 645, y: 81 };
const SKIP_BUTTON_WORLD = { x: 660, y: 327 };
const REMATCH_BUTTON_WORLD = { x: 317.5, y: 324 };
const MENU_BUTTON_WORLD = { x: 482.5, y: 324 };

interface Drag { from: { x: number; y: number }; to: { x: number; y: number }; }

/**
 * Verified grid-exact kill drags (power 10), one per team-0 figure. Each drag
 * starts on the live figure position (quantized to the 0.625 world grid at
 * 1280x720) that the authoritative search selected for that turn.
 */
const KILL_DRAGS: readonly Drag[] = [
	{ from: { x: 131.875, y: 161.875 }, to: { x: 16.25, y: 28.75 } },
	{ from: { x: 202.5, y: 161.875 }, to: { x: 373.125, y: 201.25 } },
	{ from: { x: 131.875, y: 232.5 }, to: { x: 251.25, y: 103.75 } },
	{ from: { x: 202.5, y: 303.75 }, to: { x: 30.625, y: 266.875 } },
	{ from: { x: 144.375, y: 283.75 }, to: { x: 315.625, y: 246.875 } },
	{ from: { x: 511.25, y: 175 }, to: { x: 336.875, y: 153.125 } },
];

/** Verified grid-exact weak team-1 drags (power ~0.8 straight up). */
const WEAK_DRAGS: readonly Drag[] = [
	{ from: { x: 571.875, y: 131.875 }, to: { x: 571.875, y: 123.75 } },
	{ from: { x: 642.5, y: 202.5 }, to: { x: 642.5, y: 194.375 } },
	{ from: { x: 609.375, y: 270.625 }, to: { x: 609.375, y: 262.5 } },
	{ from: { x: 641.25, y: 161.875 }, to: { x: 641.25, y: 153.75 } },
	{ from: { x: 641.25, y: 188.125 }, to: { x: 641.25, y: 180 } },
];

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
	expect(state.entities).toHaveLength(12);
	expect(state.entities.filter(entity => !entity.dead)).toHaveLength(12);
	expect(finiteEntities(state)).toBe(true);
}

/**
 * Waits until the turn provably started: either the Playing state is observed,
 * or the match already resolved it (fast turns can complete between polls).
 * A rejected drag leaves the state untouched, so the turn number stays equal
 * and this times out with a clear message.
 */
async function waitForPlaybackOrResolution(page: import("playwright").Page, label: string): Promise<void> {
	const before = await readMatchState(page);
	await waitFor(async () => {
		const state = await readMatchState(page);
		return state.state === "GameState.Playing"
			|| state.state === "GameState.Game_over"
			|| (state.state === "GameState.Your_turn" && state.turnNumber !== before.turnNumber);
	}, 10_000, 20, label);
}

/**
 * Skips the item phase and plays one verified drag; waits for the turn to
 * resolve (or for the match to end when `expectEnd` is set).
 */
async function playTurn(page: import("playwright").Page, drag: Drag, expectEnd: boolean): Promise<void> {
	await waitFor(async () => await page.evaluate(() => {
		const element = (window as any).game.handler.getMouseHandler()?.getRuntime?.().toSettings().screens[0].elements.find((candidate: any) => candidate.id === "hud-skip-item");
		return element?.visible === true && element?.enabled === true;
	}), 5_000, 50, "HUD skip control");
	await clickWorld(page, SKIP_BUTTON_WORLD.x, SKIP_BUTTON_WORLD.y);
	await waitFor(async () => (await readMatchState(page)).phase === "physics", 5_000, 100, "physics phase");
	await dragWorld(page, drag.from, drag.to);
	await waitForPlaybackOrResolution(page, "playback start");
	await waitFor(async () => (await readMatchState(page)).state === (expectEnd ? "GameState.Game_over" : "GameState.Your_turn"), 90_000, 100, expectEnd ? "match end" : "turn completion");
}

/** Plays the full deterministic 6-kill / 5-weak match (11 turns). */
async function playMatch(page: import("playwright").Page, useItemOnLastKill: boolean): Promise<void> {
	for (let i = 0; i < KILL_DRAGS.length; i++) {
		if (i > 0) await playTurn(page, WEAK_DRAGS[i - 1]!, false);
		if (useItemOnLastKill && i === KILL_DRAGS.length - 1) {
			// Legal item use through the visible browser panel: the team-0
			// figure holds one power-dash loadout; using it consumes the
			// allowance without leaving the item phase.
			await clickWorld(page, ITEM_BUTTON_WORLD.x, ITEM_BUTTON_WORLD.y);
			const afterUse = await readMatchState(page);
			expect(afterUse.itemUses).toBe(1);
			expect(afterUse.phase).toBe("item");
			expect(afterUse.state).toBe("GameState.Your_turn");
		}
		await playTurn(page, KILL_DRAGS[i]!, i === KILL_DRAGS.length - 1);
	}
}

describe("Section 16.4 browser gameplay controls and result flow", () => {
	afterAll(() => {
		expect(activeBrowserServers()).toBe(0);
	});

	test("item use, item skip, kill turns, result overlay, rematch, and menu exit", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url);
			const capture = captureConsole(page);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");
			await enterLocalMatch(page);

			// Play the full deterministic match; the item phase of the final
			// kill turn is used through the visible panel before the shot.
			await playMatch(page, true);

			// The match reached an explicit winner: team 0 is the last team
			// standing (two team-0 figures died to power-10 ricochet blowback,
			// so only the team-1 wipe-out is asserted); the result overlay
			// condition is visible.
			const result = await readMatchResult(page);
			expect(result).not.toBeNull();
			expect(result?.status).toBe("winner");
			expect(result?.winnerTeam).toBe(0);
			expect(result?.reason).toBe("last-team-standing");
			const ended = await readMatchState(page);
			expect(ended.state).toBe("GameState.Game_over");
			expect(ended.entities.filter(entity => entity.team.includes(1)).every(entity => entity.dead)).toBe(true);
			expect(ended.entities.filter(entity => entity.team.includes(0) && !entity.dead).length).toBeGreaterThanOrEqual(1);

			// Rematch restores a fresh playable state.
			await clickWorld(page, REMATCH_BUTTON_WORLD.x, REMATCH_BUTTON_WORLD.y);
			const fresh = await readMatchState(page);
			expect(fresh.state).toBe("GameState.Your_turn");
			expect(fresh.turnNumber).toBe(0);
			expect(fresh.phase).toBe("item");
			expect(fresh.itemUses).toBe(0);
			expect(fresh.entities.filter(entity => !entity.dead)).toHaveLength(12);
			expect(await readMatchResult(page)).toBeNull();
			// The team-0 figure is back at its canonical spawn.
			const shooter = fresh.entities.find(entity => entity.team.includes(0))!;
			expect(Math.hypot(shooter.x - 132, shooter.y - 162)).toBeLessThan(0.5);

			// Play and finish a second full match, then exit to the menu.
			await playMatch(page, false);
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
	}, 300_000);

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
			await dragWorld(page, KILL_DRAGS[0]!.from, KILL_DRAGS[0]!.to);
			await waitFor(async () => (await readMatchState(page)).state === "GameState.Your_turn", 5_000, 100, "rejected input settles");
			const rejected = await readMatchState(page);
			expect(rejected.phase).toBe("item");
			expect(rejected.turnNumber).toBe(0);
			expect(rejected.itemUses).toBe(0);
			expect(rejected.entities.filter(entity => !entity.dead)).toHaveLength(12);
			const unmovedShooter = rejected.entities.find(entity => entity.team.includes(0))!;
			expect(Math.hypot(unmovedShooter.x - 132, unmovedShooter.y - 162)).toBeLessThan(0.5);
			expect(await readMatchResult(page)).toBeNull();

			assertCleanConsole(capture);
		} finally {
			await browser.close();
			await server.stop();
		}
		expect(activeBrowserServers()).toBe(0);
	}, 120_000);
});
