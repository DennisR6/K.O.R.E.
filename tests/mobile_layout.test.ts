import { test, expect, describe } from "bun:test";
import { calculateMobileLayout, adaptCanvasSizeForViewport } from "../src/ui/layout.js";

describe("Mobile Layout Adaptation", () => {
	test("detects mobile viewport correctly and adjusts touch target padding and font size", () => {
		const mobileLayout = calculateMobileLayout(480, 320);
		expect(mobileLayout.isMobile).toBe(true);
		expect(mobileLayout.touchTargetPadding).toBe(16);
		expect(mobileLayout.uiFontSize).toBe(18);

		const desktopLayout = calculateMobileLayout(1920, 1080);
		expect(desktopLayout.isMobile).toBe(false);
		expect(desktopLayout.touchTargetPadding).toBe(8);
		expect(desktopLayout.uiFontSize).toBe(14);
	});

	test("adapts canvas size for viewport dimensions", () => {
		const adapted = adaptCanvasSizeForViewport(600, 400, 800, 450);
		expect(adapted.width).toBeGreaterThan(0);
		expect(adapted.height).toBeGreaterThan(0);
		expect(adapted.scale).toBeGreaterThan(0);
	});
});
