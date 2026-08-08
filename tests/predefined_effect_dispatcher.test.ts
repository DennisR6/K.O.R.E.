import { expect, test } from "bun:test";
import { createCanonicalPlayableMatchHandler } from "../src/settings/canonicalPlayableMatch.ts";
import { CounterSystem } from "../src/systems/CounterSystem.ts";
import { MovementSystem } from "../src/systems/MovementSystem.ts";
import { TransformSystem } from "../src/systems/TransformSystem.ts";
import { COUNTER_ADD_EFFECT_ID } from "../src/engine/sdk/index.ts";

test("Counter and Movement use the same predefined host and runtime-object APIs", () => {
	const handler = createCanonicalPlayableMatchHandler();
	handler.addSystem(new CounterSystem());
	const actor = handler.getEntityManager().getEntities()[0]!;
	handler.getContext().counters.push({ schemaVersion: 1, id: "coins", value: 1 });

	handler.dispatchEngineEffect({ schemaVersion: 1, type: "movement.set-velocity", target: { type: "entity", entityId: actor.getId() }, typeValue: { x: 4, y: -2 } });
	handler.dispatchEngineEffect({ schemaVersion: 1, type: "movement.add-velocity", target: { type: "entity", entityId: actor.getId() }, typeValue: { x: 1, y: 3 } });
	handler.dispatchEngineEffect({ schemaVersion: 1, type: "movement.scale-speed", target: { type: "entity", entityId: actor.getId() }, typeValue: { factor: 0.5 } });
	handler.dispatchEngineEffect({ schemaVersion: 1, type: COUNTER_ADD_EFFECT_ID, target: { type: "counter", counterId: "coins" }, typeValue: { amount: 2 } });

	expect(actor.getVel()).toEqual({ x: 2.5, y: 0.5 });
	expect(handler.getCounter("coins").value).toBe(3);
});

test("predefined dispatch rejects missing and ambiguous interpreters", () => {
	const missing = createCanonicalPlayableMatchHandler();
	missing.replaceSystems([]);
	expect(() => missing.dispatchEngineEffect({ schemaVersion: 1, type: "movement.set-velocity", target: { type: "entity", entityId: "missing" }, typeValue: { x: 1, y: 1 } })).toThrow("No predefined system");

	const ambiguous = createCanonicalPlayableMatchHandler();
	ambiguous.addSystem(new MovementSystem());
	const actor = ambiguous.getEntityManager().getEntities()[0]!;
	expect(() => ambiguous.dispatchEngineEffect({ schemaVersion: 1, type: "movement.set-velocity", target: { type: "entity", entityId: actor.getId() }, typeValue: { x: 1, y: 1 } })).toThrow("Multiple predefined systems");
});

test("predefined dispatch validates the current envelope and target before mutation", () => {
	const handler = createCanonicalPlayableMatchHandler();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const before = actor.getVel();
	expect(() => handler.dispatchEngineEffect({ type: "movement.set-velocity", target: { type: "entity", entityId: actor.getId() }, typeValue: { x: 1, y: 1 } })).toThrow("schema version");
	expect(() => handler.dispatchEngineEffect({ schemaVersion: 1, type: "movement.set-velocity", target: { type: "counter", counterId: "missing" }, typeValue: { x: 1, y: 1 } })).toThrow("Unknown counter target");
	expect(() => handler.dispatchEngineEffect({ schemaVersion: 1, type: "movement.set-velocity", target: { type: "entity", entityId: actor.getId() }, typeValue: { x: Number.NaN, y: 1 } })).toThrow("invalid");
	expect(actor.getVel()).toEqual(before);
});

test("transform swap dispatch captures both positions before either write", () => {
	const handler = createCanonicalPlayableMatchHandler();
	const [first, second] = handler.getEntityManager().getEntities();
	first!.setPos({ x: 10, y: 20 });
	second!.setPos({ x: 80, y: 90 });

	handler.dispatchEngineEffect({ schemaVersion: 1, type: "transform.swap-position", target: { type: "entity", entityId: first!.getId() }, typeValue: { otherEntityId: String(second!.getId()) } });

	expect(first!.getPos()).toEqual({ x: 80, y: 90 });
	expect(second!.getPos()).toEqual({ x: 10, y: 20 });
});

test("transform swap dispatch performs no partial mutation on missing or invalid targets", () => {
	const handler = createCanonicalPlayableMatchHandler();
	const [first, second] = handler.getEntityManager().getEntities();
	first!.setPos({ x: 10, y: 20 });
	second!.setPos({ x: 80, y: 90 });
	const command = (otherEntityId: string) => ({ schemaVersion: 1 as const, type: "transform.swap-position", target: { type: "entity" as const, entityId: String(first!.getId()) }, typeValue: { otherEntityId } });

	expect(() => handler.dispatchEngineEffect(command("missing"))).toThrow("Unknown transform swap entity");
	expect(first!.getPos()).toEqual({ x: 10, y: 20 });
	expect(second!.getPos()).toEqual({ x: 80, y: 90 });
	expect(() => handler.dispatchEngineEffect(command(String(first!.getId())))).toThrow("distinct entities");
	expect(first!.getPos()).toEqual({ x: 10, y: 20 });
	expect(second!.getPos()).toEqual({ x: 80, y: 90 });
	second!.setPos({ x: Number.NaN, y: 90 });
	expect(() => handler.dispatchEngineEffect(command(String(second!.getId())))).toThrow("positions must be finite");
	expect(first!.getPos()).toEqual({ x: 10, y: 20 });
});

test("entity-scoped radial force dispatch mutates only its stable entity target", () => {
	const handler = createCanonicalPlayableMatchHandler();
	const [target, unrelated] = handler.getEntityManager().getEntities();
	target!.setPos({ x: 110, y: 100 });
	unrelated!.setPos({ x: 120, y: 100 });
	target!.setVel({ x: 1, y: 2 });
	unrelated!.setVel({ x: 3, y: 4 });

	handler.dispatchEngineEffect({
		schemaVersion: 1,
		type: "movement.apply-force-to-entity",
		target: { type: "entity", entityId: target!.getId() },
		typeValue: { origin: { x: 100, y: 100 }, mode: "attract", force: 2, range: 60 },
	});

	expect(target!.getVel()).toEqual({ x: 3, y: 2 });
	expect(unrelated!.getVel()).toEqual({ x: 3, y: 4 });
});

test("entity-scoped radial force dispatch rejects missing and inactive targets", () => {
	const handler = createCanonicalPlayableMatchHandler();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const command = (entityId: string) => ({ schemaVersion: 1 as const, type: "movement.apply-force-to-entity", target: { type: "entity" as const, entityId }, typeValue: { origin: { x: 100, y: 100 }, mode: "attract", force: 2, range: 60 } });

	expect(() => handler.dispatchEngineEffect(command("missing"))).toThrow("Unknown entity target");
	actor.setPhysicsEnabled(false);
	expect(() => handler.dispatchEngineEffect(command(String(actor.getId())))).toThrow("inactive");
});
