import { expect, test } from "bun:test";
import { createActorEligibilityConstraint, createActorEligibilityConstraintLifetime, isActorEligible, advanceActorEligibilityConstraintLifetime, validateActorEligibilityState } from "../src/engine/contracts/actorEligibility.ts";

test("actor eligibility constraints exclude only acting entities", () => {
	const constraint = createActorEligibilityConstraint({ id: "lock", mode: "excluded" });

	expect(isActorEligible([])).toBe(true);
	expect(isActorEligible([constraint])).toBe(false);
});

test("actor eligibility lifetime is separate and deterministic", () => {
	const lifetime = createActorEligibilityConstraintLifetime({ id: "lock:lifetime", constraintId: "lock", durationUnit: "turns", duration: 2, remaining: 2 });

	expect(advanceActorEligibilityConstraintLifetime(lifetime)).toMatchObject({ constraintId: "lock", remaining: 1 });
	expect(advanceActorEligibilityConstraintLifetime({ ...lifetime, remaining: 1 })).toBeUndefined();
});

test("actor eligibility rejects unsupported modes", () => {
	expect(() => createActorEligibilityConstraint({ id: "bad", mode: "forced" as never })).toThrow("mode");
});

test("actor eligibility lifetime must reference an existing constraint", () => {
	const lifetime = createActorEligibilityConstraintLifetime({ id: "missing:lifetime", constraintId: "missing", durationUnit: "turns", duration: 1 });

	expect(() => validateActorEligibilityState([], [lifetime])).toThrow("unknown constraint");
});

test("actor eligibility provenance does not change pure eligibility", () => {
	const first = createActorEligibilityConstraint({ id: "first", mode: "excluded", sourceId: "one", sourceOrder: 1 });
	const second = createActorEligibilityConstraint({ id: "second", mode: "excluded", sourceId: "two", sourceOrder: 99 });

	expect(isActorEligible([first])).toBe(false);
	expect(isActorEligible([second])).toBe(false);
});
