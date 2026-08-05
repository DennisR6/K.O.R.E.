import { describe, expect, test, afterAll } from "@playwright/test";
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
	closeBrowser,
	openPage,
	readMatchState,
	startTestServer,
	waitFor,
	worldToPixel,
} from "./browserHarness.ts";
import { MAP_CATALOG } from "../../src/content/mapCatalog.js";

/**
 * Section 17.8 - browser verification of every qualified map.
 *
 * Every interaction goes through the production UI: the landing page, the
 * main-menu "Choose Map" button, the map-selection rows, the visible item
 * panel, real pointer drags, and the result overlay. The production
 * selection list is exactly the `browserAvailable` catalog entries, so the
 * test walks the same six technically-qualified maps a human would see.
 *
 * The weak opening (a ~12 world-unit drag from the team-0 figure, power ~1.2
 * straight toward the team's own side) is a legal action on every map: it
 * resolves the turn deterministically without touching any hazard or wall
 * far enough to end the match, so each map's "one real pointer-driven legal
 * action" can be observed mid-match and the menu is reached again through a
 * fresh production boot (the app has no in-match exit affordance; leaving a
 * local match is a fresh boot that must stay console-clean).
 *
 * The full-journey case uses Hazard Control's broad verified terminal route
 * (17.6): after a weak opening, every team-1 figure drives itself into the
 * right arena wall (a containment kill; the wall route is verified to kill
 * exactly the shooter without touching team 0), the result overlay offers
 * rematch, and a second terminal match exits to the menu.
 *
 * Failure evidence reuses the Section 16 bounded diagnostics via the shared
 * harness; tests never call `GameEmitter`, handler mutation methods, or
 * gameplay APIs to manufacture results - all input is real pointer input.
 */

/** World-coordinate centers of the visible browser controls. */
const SKIP_BUTTON_WORLD = { x: 660, y: 327 };
const REMATCH_BUTTON_WORLD = { x: 317.5, y: 324 };
const MENU_BUTTON_WORLD = { x: 482.5, y: 324 };
const LANDING_WORLD = { x: 400, y: 100 };
const CHOOSE_MAP_BUTTON_WORLD = { x: 400, y: 409 };

/** Weak opening drag: power ~1.2 straight toward the team's own side. */
const WEAK_DRAG_DX = 12;

/** Verified grid-exact containment suicide drags per team-1 spawn index. */
const SUICIDE_DRAGS = [
	{ from: { x: 650, y: 225 }, to: { x: 533.125, y: 195.625 } },
	{ from: { x: 750, y: 225 }, to: { x: 630, y: 225 } },
	{ from: { x: 650, y: 325 }, to: { x: 533.125, y: 295.625 } },
	{ from: { x: 750, y: 325 }, to: { x: 630, y: 325 } },
	{ from: { x: 650, y: 425 }, to: { x: 531.25, y: 403.75 } },
	{ from: { x: 750, y: 425 }, to: { x: 630, y: 425 } },
] as const;

/**
 * The qualified maps in production selection order (catalog order filtered
 * by `browserAvailable`). frostbite-arena stays blocked and hidden.
 */
const QUALIFIED_MAPS = MAP_CATALOG.filter(entry => entry.browserAvailable);

/** World-center of a map-selection row (menu layout: 500x40 rows at y 80+50i). */
function mapRowWorld(index: number): { x: number; y: number } {
	return { x: 400, y: 100 + index * 50 };
}

/** Grid-quantized drag start (mirrors the Section 16 killDrag helper). */
function quantized(position: { x: number; y: number }): { x: number; y: number } {
	return { x: Math.floor(position.x * 1.6) / 1.6, y: Math.floor(position.y * 1.6) / 1.6 };
}

/** Stable map ID of the active local match (null in the menu). */
async function windowMapId(page: import("playwright").Page): Promise<string | null> {
	return await page.evaluate(() => (window as any).game?.mapId ?? null);
}

/** Reads a single canvas pixel at world coordinates. */
async function probePixel(page: import("playwright").Page, worldX: number, worldY: number): Promise<{ r: number; g: number; b: number }> {
	const geometry = await canvasGeometry(page);
	const pixel = worldToPixel(geometry, worldX, worldY);
	return await page.evaluate(([px, py]) => {
		const canvas = document.querySelector("canvas");
		if (!canvas) throw new Error("no canvas element");
		const context = canvas.getContext("2d");
		if (!context) throw new Error("no 2d canvas context");
		const data = context.getImageData(Math.floor(px), Math.floor(py), 1, 1).data;
		return { r: data[0]!, g: data[1]!, b: data[2]! };
	}, [pixel.x, pixel.y] as [number, number]);
}

function colorNear(a: { r: number; g: number; b: number }, color: readonly [number, number, number], tolerance: number): boolean {
	return Math.abs(a.r - color[0]) + Math.abs(a.g - color[1]) + Math.abs(a.b - color[2]) <= tolerance;
}

function colorDiff(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
	return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

/**
 * Expected structure/hazard render evidence per map: a probe point inside a
 * distinctive engine-drawn structure (or hazard zone) and a reference point
 * on open floor far from every engine structure and the item panel.
 */
const STRUCTURE_PROBES: Record<string, { probe: { x: number; y: number }; ref: { x: number; y: number }; color: readonly [number, number, number] }> = {
	// central wall rect (400,150,10,150); reference on open center floor.
	// The engine template renders its structures in debug blue ("blue").
	"ice-map-v1": { probe: { x: 405, y: 200 }, ref: { x: 405, y: 320 }, color: [0x00, 0x00, 0xff] },
	// left wall rect (66,90,10,270); reference above the wall band
	"cue-clash": { probe: { x: 71, y: 225 }, ref: { x: 71, y: 40 }, color: [0x31, 0x5b, 0x7d] },
	// north lava kill zone circle (390,35,r14); reference below it on floor
	"magma-cradle": { probe: { x: 390, y: 35 }, ref: { x: 390, y: 80 }, color: [0xd9, 0x4b, 0x28] },
	// central wall rect (360,126,80,48), probed left of the template wall art
	"symmetric-duel": { probe: { x: 380, y: 140 }, ref: { x: 380, y: 240 }, color: [0x31, 0x5b, 0x7d] },
	// north-west column rect (300,70,16,80); reference below it on floor
	"structure-control": { probe: { x: 308, y: 110 }, ref: { x: 308, y: 170 }, color: [0x31, 0x5b, 0x7d] },
	// west kill zone circle (300,225,r28); reference above it on floor
	"hazard-control": { probe: { x: 300, y: 225 }, ref: { x: 300, y: 180 }, color: [0xd9, 0x4b, 0x28] },
};

/** Opens the visible menu and navigates to the map-selection page. */
async function openMapSelection(page: import("playwright").Page): Promise<void> {
	await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");
	await clickWorld(page, LANDING_WORLD.x, LANDING_WORLD.y); // landing page -> main menu
	await clickWorld(page, CHOOSE_MAP_BUTTON_WORLD.x, CHOOSE_MAP_BUTTON_WORLD.y); // main menu -> choose map
}

/** Skips the item phase and plays a weak legal opening for the active team. */
async function playWeakOpening(page: import("playwright").Page): Promise<{ movedBy: number; maxPlayback: number }> {
	await skipItemPhase(page);
	const shooter = (await readMatchState(page)).entities.find(entity => entity.team.includes(0))!;
	const start = quantized(shooter);
	await dragWorld(page, start, { x: start.x + WEAK_DRAG_DX, y: start.y });

	// Observe the simulation and its bounded playback while the turn resolves.
	let maxPlayback = 0;
	await waitFor(async () => {
		const state = await readMatchState(page);
		maxPlayback = Math.max(maxPlayback, state.playbackFrames);
		return state.turnNumber === 1;
	}, 60_000, 50, "weak turn resolution");
	const settled = await readMatchState(page);
	const moved = settled.entities.find(entity => entity.team.includes(0))!;
	return { movedBy: Math.hypot(moved.x - shooter.x, moved.y - shooter.y), maxPlayback };
}

/**
 * Hazard Control mid-match weak turn: the live team-0 figure nearest to the
 * team-0 spawn corner (150,225) drifts ~12 world units right. Mirroring the
 * verified engine sequence, the nearest figure is picked every turn because
 * the low-power shot travels far on tiles friction; the pick switches to the
 * next spawn figure instead of pushing one figure out of the arena.
 */
async function playHazardWeak(page: import("playwright").Page): Promise<void> {
	await skipItemPhase(page);
	const shooter = (await readMatchState(page)).entities
		.filter(entity => entity.team.includes(0) && !entity.dead)
		.sort((a, b) => Math.hypot(a.x - 150, a.y - 225) - Math.hypot(b.x - 150, b.y - 225))[0];
	expect(shooter).toBeDefined();
	const start = quantized(shooter);
	await dragWorld(page, start, { x: start.x + WEAK_DRAG_DX, y: start.y });
	await waitFor(async () => {
		const state = await readMatchState(page);
		return state.state === "GameState.Your_turn" && state.activeTeam === 1;
	}, 60_000, 50, "hazard weak turn resolution");
}

/**
 * Waits until the turn provably started: either the Playing state is observed,
 * or the match already resolved it (wall suicides resolve in a few frames and
 * can complete between polls). A rejected drag leaves the state untouched, so
 * the turn number stays equal and this times out with a clear message.
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
 * Hazard Control terminal turn: the team-1 figure at spawn `spawnIndex`
 * (pristine until its turn) drives itself into the right arena wall with the
 * verified power-10 drag; the containment kill eliminates exactly that
 * shooter. After the last spawn the match ends (team 1 eliminated).
 */
async function playSuicideTurn(page: import("playwright").Page, spawnIndex: number, expectEnd: boolean): Promise<void> {
	await skipItemPhase(page);
	const drag = SUICIDE_DRAGS[spawnIndex]!;
	await dragWorld(page, drag.from, drag.to);
	await waitForPlaybackOrResolution(page, "playback start");
	await waitFor(async () => (await readMatchState(page)).state === (expectEnd ? "GameState.Game_over" : "GameState.Your_turn"), 90_000, 100, expectEnd ? "terminal result" : "suicide turn resolution");
}

async function skipItemPhase(page: import("playwright").Page): Promise<void> {
	await waitFor(async () => await page.evaluate(() => {
		const element = (window as any).game.handler.getMouseHandler()?.getRuntime?.().toSettings().screens[0].elements.find((candidate: any) => candidate.id === "hud-skip-item");
		return element?.visible === true && element?.enabled === true;
	}), 5_000, 50, "HUD skip control");
	await clickWorld(page, SKIP_BUTTON_WORLD.x, SKIP_BUTTON_WORLD.y);
	await waitFor(async () => (await readMatchState(page)).phase === "physics", 5_000, 100, "physics phase");
}

/** Plays one full Hazard Control terminal match (weak opening + 6 wall suicides). */
async function playHazardTerminalMatch(page: import("playwright").Page): Promise<void> {
	await playWeakOpening(page);
	for (let i = 0; i < SUICIDE_DRAGS.length; i++) {
		await playSuicideTurn(page, i, i === SUICIDE_DRAGS.length - 1);
		if (i < SUICIDE_DRAGS.length - 1) await playHazardWeak(page);
	}
}

test.describe("Section 17.8 browser verification of qualified maps", () => {
	test.afterAll(() => {
		expect(activeBrowserServers()).toBe(0);
	});

	test("every browser-available map opens through the UI, renders, and resolves one legal pointer action", async () => {
		expect(QUALIFIED_MAPS.length).toBe(6);
		expect(QUALIFIED_MAPS.every(entry => entry.id !== "frostbite-arena")).toBe(true);
		expect(QUALIFIED_MAPS.every(entry => entry.status === "browser-qualified")).toBe(true);

		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url);
			const capture = captureConsole(page);
			await openMapSelection(page);

			for (const [index, entry] of QUALIFIED_MAPS.entries()) {
				// Each map session ends in a fresh boot back at the landing
				// page, so re-open the map-selection page through the UI.
				if (index > 0) await openMapSelection(page);
				const row = mapRowWorld(index);
				await clickWorld(page, row.x, row.y);
				await waitFor(async () => (await windowMapId(page)) === entry.id && (await activeGameModeId(page)) === "local-ice-duel-v1", 10_000, 100, `${entry.id} selection`);

				// Stable map ID, finite visible entities, item phase open.
				const state = await readMatchState(page);
				expect(state.state).toBe("GameState.Your_turn");
				expect(state.phase).toBe("item");
				expect(state.turnNumber).toBe(0);
				expect(state.activeTeam).toBe(0);
				expect(state.entities).toHaveLength(12);
				expect(state.entities.filter(entity => !entity.dead)).toHaveLength(12);
				expect(finiteEntities(state)).toBe(true);

				// Authoritative geometry matches the catalog contract. Document
				// maps count their containment rect inside `structureCount`;
				// the engine-template map adds it separately (7 solids + 6
				// deadly circles + 1 containment).
				const boundaryCount = await page.evaluate(() => (window as any).game.handler.getSettings().mapBoundarys.length);
				expect(boundaryCount).toBe(entry.structureCount + entry.hazardCount + (entry.schemaVersion === "template" ? 1 : 0));

				// Expected structures/hazards are actually rendered: the probe
				// pixel reaches the structure color and contrasts with the
				// open-floor reference pixel.
				const probe = STRUCTURE_PROBES[entry.id]!;
				expect(probe).toBeDefined();
				await waitFor(async () => colorNear(await probePixel(page, probe.probe.x, probe.probe.y), probe.color, 60), 8_000, 100, `${entry.id} structure pixel`);
				const probePx = await probePixel(page, probe.probe.x, probe.probe.y);
				const refPx = await probePixel(page, probe.ref.x, probe.ref.y);
				expect(colorNear(probePx, probe.color, 60)).toBe(true);
				expect(colorDiff(probePx, refPx)).toBeGreaterThan(60);

				// Advance the item phase through the visible panel, then one
				// real pointer-driven legal action with bounded playback.
				const { movedBy, maxPlayback } = await playWeakOpening(page);
				expect(maxPlayback).toBeGreaterThan(0);
				expect(maxPlayback).toBeLessThanOrEqual(1200);
				const settled = await readMatchState(page);
				expect(settled.state).toBe("GameState.Your_turn");
				expect(settled.activeTeam).toBe(1);
				expect(settled.phase).toBe("item");
				expect(settled.turnNumber).toBe(1);
				expect(settled.playbackFrames).toBe(0);
				expect(finiteEntities(settled)).toBe(true);
				expect(settled.entities.filter(entity => !entity.dead)).toHaveLength(12);
				expect(movedBy).toBeGreaterThan(1);
				expect(await readMatchResult(page)).toBeNull();

				// Return to the menu through a fresh production boot.
				await page.goto(server.url, { waitUntil: "load" });
				await waitFor(async () => (await activeGameModeId(page)) === null && (await windowMapId(page)) === null, 10_000, 100, "menu after map session");
			}

			assertCleanConsole(capture);
		} finally {
			await closeBrowser(browser);
			await server.stop();
		}
		expect(activeBrowserServers()).toBe(0);
	});

	test("full journey: hazard-control menu -> map -> terminal result -> rematch -> menu", async () => {
		const entry = QUALIFIED_MAPS.find(candidate => candidate.id === "hazard-control");
		expect(entry).toBeDefined();
		const index = QUALIFIED_MAPS.indexOf(entry!);
		expect(index).toBeGreaterThanOrEqual(0);

		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url);
			const capture = captureConsole(page);
			await openMapSelection(page);

			// Select Hazard Control through the production UI.
			const row = mapRowWorld(index);
			await clickWorld(page, row.x, row.y);
			await waitFor(async () => (await windowMapId(page)) === "hazard-control" && (await activeGameModeId(page)) === "local-ice-duel-v1", 10_000, 100, "hazard-control selection");
			await waitFor(async () => colorNear(await probePixel(page, 300, 225), [0xd9, 0x4b, 0x28], 60), 8_000, 100, "hazard zone pixel");

			// Turn 1: weak opening, no elimination.
			const first = await playWeakOpening(page);
			expect(first.maxPlayback).toBeGreaterThan(0);
			expect(first.maxPlayback).toBeLessThanOrEqual(1200);
			expect((await readMatchState(page)).entities.filter(entity => !entity.dead)).toHaveLength(12);

			// Turns 2-11: every team-1 figure drives itself into the right
			// arena wall (the verified containment terminal route; the wall
			// kills exactly the shooter without touching team 0), with team-0
			// weak turns in between. The sixth wall suicide ends the match.
			for (let i = 0; i < SUICIDE_DRAGS.length; i++) {
				await playSuicideTurn(page, i, i === SUICIDE_DRAGS.length - 1);
				if (i < SUICIDE_DRAGS.length - 1) await playHazardWeak(page);
			}

			const result = await readMatchResult(page);
			expect(result).not.toBeNull();
			expect(result?.status).toBe("winner");
			expect(result?.winnerTeam).toBe(0);
			expect(result?.reason).toBe("last-team-standing");
			const ended = await readMatchState(page);
			expect(ended.entities.filter(entity => entity.team.includes(1)).every(entity => entity.dead)).toBe(true);
			expect(ended.entities.filter(entity => entity.team.includes(0)).every(entity => !entity.dead)).toBe(true);
			expect(await windowMapId(page)).toBe("hazard-control");

			// Rematch restores a fresh playable state on the same map.
			await clickWorld(page, REMATCH_BUTTON_WORLD.x, REMATCH_BUTTON_WORLD.y);
			const fresh = await readMatchState(page);
			expect(fresh.state).toBe("GameState.Your_turn");
			expect(fresh.turnNumber).toBe(0);
			expect(fresh.phase).toBe("item");
			expect(fresh.itemUses).toBe(0);
			expect(fresh.entities.filter(entity => !entity.dead)).toHaveLength(12);
			expect(await readMatchResult(page)).toBeNull();
			expect(await windowMapId(page)).toBe("hazard-control");

			// Play a second terminal match, then exit through the overlay menu.
			await playHazardTerminalMatch(page);
			expect((await readMatchResult(page))?.status).toBe("winner");
			await clickWorld(page, MENU_BUTTON_WORLD.x, MENU_BUTTON_WORLD.y);
			await waitFor(async () => (await activeGameModeId(page)) === null && (await windowMapId(page)) === null, 5_000, 100, "menu state");
			expect(await canvasGeometry(page)).toBeTruthy();

			assertCleanConsole(capture);
		} finally {
			await closeBrowser(browser);
			await server.stop();
		}
		expect(activeBrowserServers()).toBe(0);
	});
});

/** Reads the authoritative match result (null while the match is running). */
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
