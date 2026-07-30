export const enum GameAction {
	Aim = "aim",
	Charge = "charge",
	Push = "push",
	ItemUse = "itemUse",
}

export interface ActionBindingDetail {
	keys: string[];
	mouseButtons?: number[];
	gamepadButtons?: number[];
}

export interface GameActionBindings {
	schemaVersion: number;
	bindings: Record<GameAction, ActionBindingDetail>;
}

export function createDefaultActionBindings(): GameActionBindings {
	return {
		schemaVersion: 1,
		bindings: {
			[GameAction.Aim]: { keys: ["ArrowLeft", "ArrowRight", "KeyA", "KeyD"], mouseButtons: [0] },
			[GameAction.Charge]: { keys: ["Space", "ArrowUp", "KeyW"] },
			[GameAction.Push]: { keys: ["Enter", "KeyP"] },
			[GameAction.ItemUse]: { keys: ["KeyI", "Digit1"] },
		},
	};
}

export class ActionManager {
	private config: GameActionBindings;

	public constructor(config?: Partial<GameActionBindings>) {
		const defaults = createDefaultActionBindings();
		this.config = {
			schemaVersion: config?.schemaVersion ?? defaults.schemaVersion,
			bindings: {
				[GameAction.Aim]: { ...(config?.bindings?.[GameAction.Aim] ?? defaults.bindings[GameAction.Aim]) },
				[GameAction.Charge]: { ...(config?.bindings?.[GameAction.Charge] ?? defaults.bindings[GameAction.Charge]) },
				[GameAction.Push]: { ...(config?.bindings?.[GameAction.Push] ?? defaults.bindings[GameAction.Push]) },
				[GameAction.ItemUse]: { ...(config?.bindings?.[GameAction.ItemUse] ?? defaults.bindings[GameAction.ItemUse]) },
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
