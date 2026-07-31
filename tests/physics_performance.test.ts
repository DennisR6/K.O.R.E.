import { describe, expect, test } from "bun:test";
import { CCD_MAX_STEP_SIZE, MAX_CCD_SUBSTEPS, MAX_CONTACT_SOLVER_ITERATIONS } from "../src/physics/physics.ts";
import { runPhysicsFuzzCase } from "./support/physicsFuzz.ts";

describe("physics performance budget (13.11)", () => {
	test("bounded deterministic workload has no runaway time or heap growth", () => {
		const before = process.memoryUsage().heapUsed;
		const started = performance.now();
		let bytes = 0;
		for (let seed = 1_310_000; seed < 1_310_200; seed++) bytes += runPhysicsFuzzCase(seed).length;
		const elapsed = performance.now() - started;
		const heapGrowth = process.memoryUsage().heapUsed - before;

		// Broad CI-safe regression budget. The exact figures are reported by the
		// test failure and can be sampled through `bun run bench:physics`.
		expect(elapsed).toBeLessThan(10_000);
		expect(heapGrowth).toBeLessThan(64 * 1024 * 1024);
		expect(bytes).toBeGreaterThan(0);
		expect(MAX_CONTACT_SOLVER_ITERATIONS).toBe(16);
		expect(MAX_CCD_SUBSTEPS).toBe(16);
		expect(CCD_MAX_STEP_SIZE).toBe(4);
	});
});
