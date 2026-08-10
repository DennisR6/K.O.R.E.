import { ActionManager, GameAction } from "./actions.js";

export interface ControllerOptions {
	gamepadIndex?: number;
	deadzone?: number;
	getGamepads?: () => (Gamepad | null)[];
}

export class ControllerInput {
	private actionManager: ActionManager;
	private gamepadIndex: number;
	private deadzone: number;
	private getGamepads: () => (Gamepad | null)[];

	public constructor(actionManager: ActionManager, options: ControllerOptions = {}) {
		this.actionManager = actionManager;
		this.gamepadIndex = options.gamepadIndex ?? 0;
		this.deadzone = options.deadzone ?? 0.15;
		this.getGamepads = options.getGamepads ?? (() => (typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : []));
	}

	public getActiveGamepad(): Gamepad | null {
		try {
			const gamepads = this.getGamepads();
			return gamepads[this.gamepadIndex] ?? null;
		} catch {
			// Browser permissions and unsupported contexts may reject gamepad access;
			// controller input must never interrupt the render/gameplay loop.
			return null;
		}
	}

	public isActionPressed(action: GameAction): boolean {
		const pad = this.getActiveGamepad();
		if (!pad) return false;
		const binding = this.actionManager.getConfig().bindings[action];
		if (!binding || !binding.gamepadButtons) return false;

		for (const btnIndex of binding.gamepadButtons) {
			const btn = pad.buttons[btnIndex];
			if (btn && (btn.pressed || btn.value > 0.5)) {
				return true;
			}
		}
		return false;
	}

	public getAxis(axisIndex: number): number {
		const pad = this.getActiveGamepad();
		if (!pad || !pad.axes || pad.axes[axisIndex] === undefined) return 0;
		const val = pad.axes[axisIndex]!;
		if (Math.abs(val) < this.deadzone) return 0;
		return val;
	}

	public getAimVector(): { x: number; y: number } {
		return {
			x: this.getAxis(0),
			y: this.getAxis(1),
		};
	}

	public getChargePressure(): number {
		const pad = this.getActiveGamepad();
		if (!pad) return 0;
		// Check right trigger (typically axis 5 or button 7)
		if (pad.buttons[7] && pad.buttons[7].value > 0) {
			return pad.buttons[7].value;
		}
		const axisVal = pad.axes[3] !== undefined ? (pad.axes[3] + 1) / 2 : 0;
		return Math.max(0, Math.min(1, axisVal));
	}
}
