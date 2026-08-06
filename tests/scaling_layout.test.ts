import { test, expect, describe } from "bun:test";
import { calculateDesktopLayout, isSteamDeckViewport } from "../src/ui/layout.js";

describe("Desktop And Steam Deck Layout Scaling", () => {
	test("recognizes Steam Deck viewport correctly (1280x800)", () => {
		expect(isSteamDeckViewport(1280, 800)).toBe(true);
		const layout = calculateDesktopLayout(1280, 800, 800, 450);
		expect(layout.isSteamDeck).toBe(true);
		expect(layout.scaleFactor).toBeGreaterThan(0);
		expect(layout.uiFontSize).toBe(16);
	});

	test("handles large desktop displays and limits excessive scaling", () => {
		const layout4k = calculateDesktopLayout(3840, 2160, 800, 450);
		expect(layout4k.isLargeDesktop).toBe(true);
		expect(layout4k.scaleFactor).toBe(2.5); // capped scale
		expect(layout4k.uiFontSize).toBe(16);
	});

	test("handles standard desktop displays (1366x768)", () => {
		const layout = calculateDesktopLayout(1366, 768, 800, 450);
		expect(layout.isLargeDesktop).toBe(false);
		expect(layout.isSteamDeck).toBe(false);
		expect(layout.scaleFactor).toBeGreaterThan(0);
	});
});
