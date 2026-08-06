import type { ActionManager } from "./actions.js";
import type { UiSystem } from "../systems/UiSystem.js";
import { KoreInputCommand } from "../kore/sdk/input.js";

export class TouchInputHandler {
	private uiSystem: UiSystem;
	private activeTouchId: number | null = null;
	private isHolding: boolean = false;
	private holdStartTime: number = 0;

	public constructor(_actionManager: ActionManager, uiSystem: UiSystem) {
		this.uiSystem = uiSystem;
	}

	public handleTouchStart(touchEvent: { changedTouches: Array<{ identifier: number; clientX: number; clientY: number }> }, canvasRect?: { left: number; top: number }): void {
		if (this.activeTouchId !== null) return;
		const touch = touchEvent.changedTouches[0];
		if (!touch) return;

		this.activeTouchId = touch.identifier;
		const x = canvasRect ? touch.clientX - canvasRect.left : touch.clientX;
		const y = canvasRect ? touch.clientY - canvasRect.top : touch.clientY;

		this.isHolding = true;
		this.holdStartTime = Date.now();

		this.uiSystem.dispatchInput({ command: KoreInputCommand.PointerDown, payload: { x, y } });
	}

	public handleTouchMove(touchEvent: { changedTouches: Array<{ identifier: number; clientX: number; clientY: number }> }, canvasRect?: { left: number; top: number }): void {
		if (this.activeTouchId === null) return;
		for (let i = 0; i < touchEvent.changedTouches.length; i++) {
			const touch = touchEvent.changedTouches[i];
			if (touch && touch.identifier === this.activeTouchId) {
				const x = canvasRect ? touch.clientX - canvasRect.left : touch.clientX;
				const y = canvasRect ? touch.clientY - canvasRect.top : touch.clientY;
				this.uiSystem.dispatchInput({ command: KoreInputCommand.PointerMove, payload: { x, y } });
				break;
			}
		}
	}

	public handleTouchEnd(touchEvent: { changedTouches: Array<{ identifier: number; clientX: number; clientY: number }> }, canvasRect?: { left: number; top: number }): void {
		if (this.activeTouchId === null) return;
		for (let i = 0; i < touchEvent.changedTouches.length; i++) {
			const touch = touchEvent.changedTouches[i];
			if (touch && touch.identifier === this.activeTouchId) {
				const x = canvasRect ? touch.clientX - canvasRect.left : touch.clientX;
				const y = canvasRect ? touch.clientY - canvasRect.top : touch.clientY;
				this.uiSystem.dispatchInput({ command: KoreInputCommand.PointerUp, payload: { x, y } });

				this.activeTouchId = null;
				this.isHolding = false;
				break;
			}
		}
	}

	public handleTouchCancel(touchEvent: { changedTouches: Array<{ identifier: number; clientX: number; clientY: number }> }): void {
		if (this.activeTouchId === null) return;
		for (let i = 0; i < touchEvent.changedTouches.length; i++) {
			const touch = touchEvent.changedTouches[i];
			if (touch && touch.identifier === this.activeTouchId) {
				this.activeTouchId = null;
				this.isHolding = false;
				break;
			}
		}
	}

	public getHoldDuration(): number {
		if (!this.isHolding) return 0;
		return Date.now() - this.holdStartTime;
	}

	public isTouchActive(): boolean {
		return this.isHolding;
	}
}
