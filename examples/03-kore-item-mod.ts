import { kore } from "../src/kore/sdk/index.js";

/** A declarative item mod authored and revalidated through the public SDK. */
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

	const wireCopy = JSON.parse(JSON.stringify(shield)) as typeof shield;
	const restored = kore.createItem(wireCopy);
	return { id: restored.id, effects: restored.effects.length, duration: restored.duration.type };
}
