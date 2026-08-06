import { defineConfig } from "@playwright/test";

/**
 * Node-based Playwright test runner for the Section 16 real-browser E2E
 * suite (tests/browser).
 *
 * The specs drive the game exclusively through the shared harness
 * (`tests/browser/browserHarness.ts`): it builds the generated `dist/main.js`
 * bundle, spawns the real Bun server on isolated ports, and launches
 * Chromium itself. This config therefore only controls discovery,
 * parallelism, and outer timeouts; every page protocol call is additionally
 * bounded by the harness so a dead renderer fails fast instead of hanging.
 *
 * The runner is node-based on purpose: the Bun test runner wedges Playwright
 * protocol calls after ~2-3 minutes of continuous browser activity per
 * process (verified experimentally), while the identical workload under
 * node/Playwright runs cleanly for many matches.
 */
export default defineConfig({
	testDir: "./tests/browser",
	testMatch: /\.test\.ts$/,
	// Outer per-test bound. The map catalog needs up to ~8 minutes; all
	// harness waits are far tighter, so this only caps pathological cases.
	timeout: 600_000,
	expect: { timeout: 15_000 },
	// Default (half the cores) is fine; override for constrained machines.
	workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : undefined,
	// Files run in parallel across workers; tests within a file stay serial
	// (each test manages its own server/browser lifecycle).
	fullyParallel: false,
	reporter: [["list"]],
	// Keep runner artifacts inside the git-ignored diagnostics directory.
	outputDir: ".browser-diagnostics/playwright-results",
	forbidOnly: true,
});
