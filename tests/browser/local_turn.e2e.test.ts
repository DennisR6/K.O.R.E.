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
} from "./browserHarness.ts";

/**
 * Section 16.3: play a local turn through real browser input.
 *
 * The test enters through the visible menu, skips the item phase through the
 * browser-visible panel, selects an active-team figure, and performs a real
 * drag-to-shoot gesture with browser pointer events. The turn must complete
 * exactly one simulation/playback transition; no handler state, TurnPacket,
 * emitter, or gameplay method may be invoked from the test.
 */

/** World-coordinate center of the SDK HUD "Skip phase" button. */
const SKIP_BUTTON_WORLD = { x: 660, y: 327 };

test.describe("Section 16.3 local turn through browser input", () => {
	test.afterAll(() => {
		expect(activeBrowserServers()).toBe(0);
	});

	test("menu path: skip item phase, drag-to-shoot, and complete exactly one turn", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url);
			const capture = captureConsole(page);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");

			// Enter local play through the visible menu first.
			await clickWorld(page, 400, 100); // landing page
			await clickWorld(page, 551, 368); // "Play Local Game"
			await waitFor(async () => (await activeGameModeId(page)) === "local-ice-duel-v1", 10_000, 100, "canonical local match");

			// The canonical match starts in the item phase with twelve live figures.
			const initial = await readMatchState(page);
			expect(initial.state).toBe("GameState.Your_turn");
			expect(initial.phase).toBe("item");
			expect(initial.turnNumber).toBe(0);
			expect(initial.activeTeam).toBe(0);
			expect(initial.entities).toHaveLength(12);
			expect(initial.entities.filter(entity => !entity.dead)).toHaveLength(12);
			expect(finiteEntities(initial)).toBe(true);

			// Skip the item phase through the visible browser panel.
			await clickWorld(page, SKIP_BUTTON_WORLD.x, SKIP_BUTTON_WORLD.y);
			await waitFor(async () => (await readMatchState(page)).phase === "physics", 5_000, 100, "physics phase");
			const ready = await readMatchState(page);
			expect(ready.state).toBe("GameState.Your_turn");

			// Select the active-team figure and drag-to-shoot (power ~6).
			const shooter = ready.entities.find(entity => !entity.dead && entity.team.includes(ready.activeTeam))!;
			expect(shooter).toBeDefined();
			const dragFrom = { x: shooter.x, y: shooter.y };
			const dragTo = { x: shooter.x + 55, y: shooter.y - 30 };
			await dragWorld(page, dragFrom, dragTo);

			// The shot fires on the next engine tick: input locks, playback runs.
			await waitFor(async () => (await readMatchState(page)).state === "GameState.Playing", 5_000, 100, "playback start");
			const playing = await readMatchState(page);
			expect(playing.turnNumber).toBe(0);
			// The dragged figure starts moving under the applied impulse.
			const movingShooter = playing.entities.find(entity => entity.id === shooter.id)!;
			expect(Math.hypot(movingShooter.vx, movingShooter.vy)).toBeGreaterThan(0);
			expect(finiteEntities(playing)).toBe(true);

			// Input is locked during playback: a drag must not fire another turn.
			const otherFigure = playing.entities.find(entity => entity.id !== shooter.id)!;
			await dragWorld(page, { x: otherFigure.x, y: otherFigure.y }, { x: otherFigure.x - 40, y: otherFigure.y - 20 });
			expect((await readMatchState(page)).state).toBe("GameState.Playing");
			expect((await readMatchState(page)).turnNumber).toBe(0);

			// Playback completes and the active team advances exactly once.
			await waitFor(async () => (await readMatchState(page)).state === "GameState.Your_turn", 30_000, 100, "turn completion");
			const after = await readMatchState(page);
			expect(after.turnNumber).toBe(1);
			expect(after.activeTeam).toBe(1);
			expect(after.phase).toBe("item");
			expect(after.playbackFrames).toBe(0);
			expect(finiteEntities(after)).toBe(true);
			// The accepted turn changed the world: the shooter moved.
			const settledShooter = after.entities.find(entity => entity.id === shooter.id)!;
			expect(Math.hypot(settledShooter.x - shooter.x, settledShooter.y - shooter.y)).toBeGreaterThan(0.5);
			// And the drag during playback caused no second turn.
			expect(after.turnNumber).toBe(1);

			assertCleanConsole(capture);
		} finally {
			await closeBrowser(browser);
			await server.stop();
		}
		expect(activeBrowserServers()).toBe(0);
	});

	test("diagnostic route: skipmenu=1 opens the direct gameplay route and completes one turn", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
			const capture = captureConsole(page);
			const response = await page.goto(`${server.url}/?skipmenu=1`, { waitUntil: "load" });
			expect(response?.status()).toBe(200);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");

			const initial = await readMatchState(page);
			// The direct route uses the default settings: physics phase, more figures.
			expect(initial.phase).toBe("physics");
			expect(initial.turnNumber).toBe(0);
			expect(initial.entities.length).toBeGreaterThanOrEqual(2);
			expect(finiteEntities(initial)).toBe(true);

			// Drag-to-shoot directly (no item phase on this route).
			const shooter = initial.entities.find(entity => !entity.dead && entity.team.includes(initial.activeTeam))!;
			await dragWorld(page, { x: shooter.x, y: shooter.y }, { x: shooter.x + 55, y: shooter.y - 30 });
			await waitFor(async () => (await readMatchState(page)).state === "GameState.Playing", 5_000, 100, "playback start");
			await waitFor(async () => (await readMatchState(page)).state === "GameState.Your_turn", 30_000, 100, "turn completion");
			const after = await readMatchState(page);
			expect(after.turnNumber).toBe(1);
			expect(after.activeTeam).toBe(1);
			expect(finiteEntities(after)).toBe(true);

			assertCleanConsole(capture);
		} finally {
			await closeBrowser(browser);
			await server.stop();
		}
		expect(activeBrowserServers()).toBe(0);
	});
});
