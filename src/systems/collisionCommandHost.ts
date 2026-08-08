import { dispatchPredefinedComposition, dispatchPredefinedEffect } from "./predefinedEffectDispatcher.js";
import type { IGameContext, ISystem } from "./types.js";
import type { CollisionCommandBinding } from "../engine/sdk/collisionCommand.js";
import type { EngineEffectComposition } from "../engine/sdk/composition.js";
import type { IEntity } from "../entity/Entity.js";

/** Routes relative collision commands through the shared predefined dispatcher. */
export function dispatchCollisionCommands(options: {
	ctx: IGameContext;
	systems: readonly ISystem[];
	commands: readonly CollisionCommandBinding[];
	target: IEntity;
}): void {
	const target = { type: "entity" as const, entityId: String(options.target.getId()) };
	for (const binding of options.commands) {
		const effect = binding.effect;
		if (effect.type === "effect.composition" && "effects" in effect) {
			dispatchPredefinedComposition({
				ctx: options.ctx,
				systems: options.systems,
				composition: bindComposition(effect, target),
			});
		} else {
			dispatchPredefinedEffect({
				ctx: options.ctx,
				systems: options.systems,
				effect: { ...effect, target },
			});
		}
	}
}

function bindComposition(composition: EngineEffectComposition, target: { type: "entity"; entityId: string }): EngineEffectComposition {
	return {
		...composition,
		effects: composition.effects.map(effect => ({ ...effect, target })),
	};
}
