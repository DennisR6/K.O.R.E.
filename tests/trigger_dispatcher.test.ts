import { expect, test } from "bun:test";
import { createPlayerSettings } from "../src/entity/types.ts";
import { Player } from "../src/entity/Player.ts";
import { EffectMove } from "../src/effects/movement.ts";
import { EffectPhysics } from "../src/effects/physics.ts";
import { EffectType } from "../src/effects/types.ts";
import { createTickEvent, dispatchTriggeredEffects } from "../src/effects/triggerDispatcher.ts";

test("trigger adapter preserves declared Effect order without changing settings", () => {
	const movement = new EffectMove({ typeValue: { deltaTime: 1, x: 2, y: 0 } });
	const physics = new EffectPhysics({ typeValue: { friction: 1, linearDrag: 0, stopThreshold: 0 } });
	const player = new Player(createPlayerSettings({ velocity: { x: 1, y: 0 } }));
	const order: EffectType[] = [];

	dispatchTriggeredEffects({ effects: [movement, physics], event: createTickEvent("test", 1), apply: effect => {
		order.push(effect.getType());
		effect.apply(player, effect.getType() === EffectType.Movement ? { x: 1, y: 0, deltaTime: 1 } : 12);
	} });

	expect(order).toEqual([EffectType.Movement, EffectType.Physics]);
	expect(player.toSettings().effects).toEqual([]);
});
