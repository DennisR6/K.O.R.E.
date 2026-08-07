import { expect, test } from "bun:test";
import { createCollisionEnterTriggerEvent, createTickTriggerEvent, validateTriggerEvent } from "../src/engine/sdk/index.ts";

test("typed trigger events are versioned, detached, and JSON-safe", () => {
	const tick = createTickTriggerEvent({ sourceId: "world", sequence: 4, dt: 0.016 });
	const collision = createCollisionEnterTriggerEvent({ sourceId: "physics", sequence: 5, entityId: "a", otherId: "wall-1", contactKey: "a|wall-1" });

	expect(tick).toEqual({ schemaVersion: 1, type: "tick", sourceId: "world", sequence: 4, payload: { dt: 0.016 } });
	expect(collision).toEqual({ schemaVersion: 1, type: "collision.enter", sourceId: "physics", sequence: 5, payload: { entityId: "a", otherId: "wall-1", contactKey: "a|wall-1" } });
	expect(JSON.parse(JSON.stringify({ tick, collision }))).toEqual({ tick, collision });
});

test("trigger validation rejects unknown kinds, fields, and invalid timing", () => {
	expect(() => validateTriggerEvent({ schemaVersion: 1, type: "round.start", sourceId: "rules", sequence: 0, payload: {} })).toThrow(/Unknown Trigger event type/);
	expect(() => validateTriggerEvent({ schemaVersion: 1, type: "tick", sourceId: "world", sequence: 0, payload: { dt: -1 } })).toThrow(/dt/);
	expect(() => validateTriggerEvent({ schemaVersion: 1, type: "collision.enter", sourceId: "physics", sequence: 0, payload: { entityId: "a", otherId: "b", contactKey: "c", extra: true } })).toThrow(/unknown field/);
});
