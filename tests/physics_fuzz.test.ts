import { describe, expect, test } from "bun:test";
import { physicsFuzzCaseCount, runPhysicsFuzzCase } from "./support/physicsFuzz.ts";

describe("deterministic physics property fuzzing (13.10)", () => {
	const count = physicsFuzzCaseCount();
	test(`runs ${count} seeded finite deterministic cases`, () => {
		const base = Number(process.env.PHYSICS_FUZZ_SEED ?? "1301000");
		for (let index = 0; index < count; index++) {
			const seed = base + index;
			const first = runPhysicsFuzzCase(seed);
			expect(runPhysicsFuzzCase(seed)).toBe(first);
		}
	}, { timeout: 600000 });

	test("invalid case-count input falls back to the 100-case smoke default", () => {
		const old = process.env.PHYSICS_FUZZ_CASES;
		try { process.env.PHYSICS_FUZZ_CASES = "invalid"; expect(physicsFuzzCaseCount()).toBe(100); }
		finally { if (old === undefined) delete process.env.PHYSICS_FUZZ_CASES; else process.env.PHYSICS_FUZZ_CASES = old; }
	});
});
