import { expect, test } from "bun:test";
import { HazardRegistry } from "../src/hazards/registry.ts";

test("hazard registry validates registered collision-trigger documents", () => {
	const registry = new HazardRegistry();
	registry.register({ type: "force" });
	expect(() => registry.validate({ schemaVersion: 1, id: "gust", type: "force", trigger: { type: "collision" }, config: {} })).not.toThrow();
	expect(() => registry.validate({ schemaVersion: 1, id: "void", type: "kill-zone", trigger: { type: "collision" }, config: {} })).toThrow("Unknown hazard type");
	expect(() => registry.register({ type: "force" })).toThrow("already registered");
});
