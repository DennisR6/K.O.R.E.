import { ItemLoader } from "../src/item/loader.js";
import { ItemValidator } from "../src/item/validate.js";
import { kore } from "../src/kore/sdk/index.js";

/** A declarative local item mod loaded through the same validator as built-ins. */
export function run(): Record<string, unknown> {
	const shield = kore.createItem({
		id: "example.super-shield",
		name: "Super Shield",
		type: "utility",
		effects: kore.composeItemEffects({ type: "shield", value: { capacity: 3 } }),
		targetType: "self",
		duration: { type: "instant", value: 0 },
		useLimit: { perTurn: 1, perGame: 2 },
		description: "Absorbs three hits.",
	});

	const validator = new ItemValidator();
	validator.registerEffectType("shield");
	const loader = new ItemLoader(validator);
	const stored = loader.registerLocalMod(shield);
	return { id: stored.id, source: loader.getSource(stored.id), effects: stored.effects.length };
}
