import { expect, test } from "bun:test";
import { advanceCollisionFilterLifetime, createCollisionFilter, createCollisionFilterLifetime, isCollisionAllowed } from "../src/engine/contracts/collisionFilter.ts";

test("collision filters reject excluded relations and preserve unfiltered relations", () => {
	const filter = createCollisionFilter({ id: "filter", excludedCategories: ["entity", "structure"] });

	expect(isCollisionAllowed("entity", [filter], "entity", [])).toBe(false);
	expect(isCollisionAllowed("entity", [filter], "structure", [])).toBe(false);
	expect(isCollisionAllowed("entity", [], "entity", [])).toBe(true);
});

test("collision filter lifetime advances independently from filter categories", () => {
	const lifetime = createCollisionFilterLifetime({ id: "filter:lifetime", filterId: "filter", durationUnit: "turns", duration: 2, remaining: 2 });

	expect(advanceCollisionFilterLifetime(lifetime)).toMatchObject({ filterId: "filter", remaining: 1 });
	expect(advanceCollisionFilterLifetime({ ...lifetime, remaining: 1 })).toBeUndefined();
});

test("collision filter canonical state rejects non-canonical or unsupported categories", () => {
	expect(() => createCollisionFilter({ id: "bad", excludedCategories: ["structure", "entity"] })).toThrow("canonicalized");
	expect(() => createCollisionFilter({ id: "bad", excludedCategories: ["hazard" as never] })).toThrow("supported");
});
