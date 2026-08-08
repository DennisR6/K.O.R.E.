import { expect, test } from "bun:test";
import { advanceStructureLifecycle, createStructureLifecycle } from "../src/engine/contracts/structureLifecycle.ts";

test("structure lifecycle advances and expires at the deterministic turn boundary", () => {
	const lifecycle = createStructureLifecycle({ id: "lifecycle-1", structureId: "wall-1", durationUnit: "turns", duration: 2 });
	expect(advanceStructureLifecycle(lifecycle)?.remaining).toBe(1);
	expect(advanceStructureLifecycle(advanceStructureLifecycle(lifecycle)!)).toBeUndefined();
});

test("structure lifecycle state is JSON-safe and restores remaining duration", () => {
	const lifecycle = createStructureLifecycle({ id: "lifecycle-1", structureId: "wall-1", durationUnit: "turns", duration: 3, remaining: 1, sourceId: "mini-wall", targetId: "player-1" });
	expect(JSON.parse(JSON.stringify(lifecycle))).toEqual(lifecycle);
});

test("structure lifecycle rejects invalid duration and structure state", () => {
	expect(() => createStructureLifecycle({ id: "", structureId: "wall-1", durationUnit: "turns", duration: 1 })).toThrow("stable id");
	expect(() => createStructureLifecycle({ id: "lifecycle-1", structureId: "wall-1", durationUnit: "turns", duration: 0 })).toThrow("positive integer");
});
