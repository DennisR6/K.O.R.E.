import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Section 13 qualification record references every solver evidence file", () => {
	const plan = readFileSync("step-by-step.md", "utf8");
	const report = readFileSync("docs/release-verification.md", "utf8");
	expect(plan).toContain("| 13 | `[x]`");
	expect(plan).toContain("steps/13-physics_solver_hardening_and_continuous_collision_qualification.md");
	expect(plan).toContain("CCD, energy/rest invariants");
	for (const file of ["physics_contact_contract", "circle_rectangle_full_depenetration", "circle_circle_zero_distance", "line_endpoint_collision", "multi_contact_solver", "continuous_collision_detection", "physics_energy_invariants", "collision_effect_lifecycle", "physics_snapshot_continuity", "physics_fuzz", "physics_performance"]) expect(report).toContain(file);
	expect(report).toContain("Physics Solver Qualification");
});
