import { createDefaultKoreInputBindings, KoreInputAction, type KoreInputBindingDetail, type KoreInputBindings } from "../kore/sdk/input.js";

export { KoreInputAction as GameAction } from "../kore/sdk/input.js";
type GameAction = KoreInputAction;
export type ActionBindingDetail = KoreInputBindingDetail;
export type GameActionBindings = KoreInputBindings;

export function createDefaultActionBindings(): GameActionBindings {
	return createDefaultKoreInputBindings();
}

export class ActionManager {
	private config: GameActionBindings;

	public constructor(config?: Partial<GameActionBindings>) {
		const defaults = createDefaultActionBindings();
		this.config = {
			schemaVersion: config?.schemaVersion ?? defaults.schemaVersion,
			bindings: {
				[KoreInputAction.Aim]: { ...(config?.bindings?.[KoreInputAction.Aim] ?? defaults.bindings[KoreInputAction.Aim]) },
				[KoreInputAction.Charge]: { ...(config?.bindings?.[KoreInputAction.Charge] ?? defaults.bindings[KoreInputAction.Charge]) },
				[KoreInputAction.Push]: { ...(config?.bindings?.[KoreInputAction.Push] ?? defaults.bindings[KoreInputAction.Push]) },
				[KoreInputAction.ItemUse]: { ...(config?.bindings?.[KoreInputAction.ItemUse] ?? defaults.bindings[KoreInputAction.ItemUse]) },
			},
		};
	}

	public getConfig(): GameActionBindings {
		return JSON.parse(JSON.stringify(this.config));
	}

	public bind(action: GameAction, binding: Partial<ActionBindingDetail>): void {
		if (!this.config.bindings[action]) {
			throw new Error(`Unknown action: ${action}`);
		}
		if (binding.keys !== undefined) this.config.bindings[action].keys = [...binding.keys];
		if (binding.mouseButtons !== undefined) this.config.bindings[action].mouseButtons = [...binding.mouseButtons];
		if (binding.gamepadButtons !== undefined) this.config.bindings[action].gamepadButtons = [...binding.gamepadButtons];
	}

	public getActionForKey(key: string): GameAction | undefined {
		for (const [action, binding] of Object.entries(this.config.bindings) as [GameAction, ActionBindingDetail][]) {
			if (binding.keys.includes(key)) {
				return action;
			}
		}
		return undefined;
	}

	public getActionForMouseButton(button: number): GameAction | undefined {
		for (const [action, binding] of Object.entries(this.config.bindings) as [GameAction, ActionBindingDetail][]) {
			if (binding.mouseButtons?.includes(button)) {
				return action;
			}
		}
		return undefined;
	}
}
