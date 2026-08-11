import { expect, test } from "bun:test";
import { EffectMove } from "../src/effects/movement.ts";
import { EffectPhysics } from "../src/effects/physics.ts";
import { EffectTrigger } from "../src/effects/types.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { SHAPE } from "@coffeemakerstudio/bean";
import { GameSettings } from "../src/settings/settings.ts";
import { SeededRandom } from "../src/utils/random.ts";

test("a fixed seed produces the complete physics regression snapshot", () => {
	const random = new SeededRandom(42);
	const effects = [
		{ trigger: EffectTrigger.Always, triggerValue: [], ...new EffectMove({ typeValue: { x: 0, y: 0, deltaTime: 1 } }).toSettings() },
		{ trigger: EffectTrigger.Always, triggerValue: [], ...new EffectPhysics({ typeValue: { friction: 0.9, linearDrag: 0.1, stopThreshold: 0.01 } }).toSettings() },
	];
	const moving = createPlayerSettings({
		id: "11111111-1111-4111-8111-111111111111",
		position: { x: 68 + random.nextInt(4), y: 99 + random.nextInt(4) },
		velocity: { x: 0, y: 3 + random.nextInt(3) },
		rotation: 0,
		size: 10,
		effects,
	});
	const target = createPlayerSettings({
		id: "22222222-2222-4222-8222-222222222222",
		position: { x: 77 + random.nextInt(4), y: 104 + random.nextInt(3) },
		size: 10,
	});
	const outside = createPlayerSettings({
		id: "33333333-3333-4333-8333-333333333333",
		position: { x: 199 + random.nextInt(3), y: 100 },
		size: 10,
	});
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings({
		...GameSettings,
		drift: 0.25,
		friction: { friction: 0.9, linearDrag: 0.1, stopThreshold: 0.01 },
		players: [moving, target, outside],
		mapBoundarys: [
			{ type: SHAPE.CIRCLE, x: 100, y: 100, r: 90, effects: [] },
			{ type: SHAPE.CIRCLE, x: 120, y: 100, r: 1, effects: [] },
		],
	}).build();

	// These structures define containment only; the player collision is intentional.
	for (const structure of handler.getContext().structures) structure.setPhysicsEnabled(false);
	for (let frame = 0; frame < 3; frame++) handler.tick();

	expect(handler.getEntityManager().serialize().map(player => ({
		id: player.id,
		position: player.position,
		velocity: player.velocity,
		isPhysicsEnabled: player.isPhysicsEnabled,
		isDrawingEnabled: player.isDrawingEnabled,
	}))).toEqual([
		{
			id: moving.id,
			position: { x: 66.83043913872267, y: 110.60364891374049 },
			velocity: { x: 1.346619659898994, y: 2.637705526451129 },
			isPhysicsEnabled: true,
			isDrawingEnabled: true,
		},
		{
			id: target.id,
			position: { x: 85.95805590899384, y: 105.00384661452777 },
			velocity: { x: 2.027026314315535, y: 0.33565438851029156 },
			isPhysicsEnabled: true,
			isDrawingEnabled: true,
		},
		{
			id: outside.id,
			position: { x: 200, y: 100 },
			velocity: { x: 0, y: 0 },
			isPhysicsEnabled: false,
			isDrawingEnabled: false,
		},
	]);
});
