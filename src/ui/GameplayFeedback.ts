import type { GameHandler } from "../engine/Handler.js";
import { GameState, getEngineStateName } from "../engine/types.js";
import type { RenderContext, IDrawer } from "../engine/RenderContext.js";
import { MatchStatus, RulePhase, type MatchResult } from "../rules/types.js";
import type { UiSystem } from "../systems/UiSystem.js";

export interface GameplayFeedbackState {
	activeTeam: number;
	turnNumber: number;
	phase: RulePhase;
	selectedActorId: string | null;
	aimAngle: number | null;
	power: number;
	availableItems: string[];
	playbackLocked: boolean;
	result: MatchResult | undefined;
	rejection: string | undefined;
}

/** Read-only HUD state derived from the handler and the current input preview. */
export class GameplayFeedback implements IDrawer {
	private rejection: string | undefined;
	private lastMatchState: string | undefined;

	public constructor(private readonly handler: GameHandler, private readonly input: UiSystem) { }

	public getState(): GameplayFeedbackState {
		const ruleState = this.handler.getRuleState();
		const engineState = this.handler.getState();
		const selectedActorId = this.input.selectedActorId ?? this.getDraggedActorId();
		const actor = selectedActorId ? this.handler.getEntityManager().getEntityById(selectedActorId) : undefined;
		const items = actor?.getInventory().filter(item => item.remainingUses > 0).map(item => `${item.itemId} (${item.remainingUses})`) ?? [];
		const aimAngle = this.input.aimAngle ?? this.getDraggedAimAngle();
		const stateKey = `${ruleState.turnNumber}:${ruleState.activeTeam}:${ruleState.phase}:${engineState}`;
		if (this.lastMatchState && this.lastMatchState !== stateKey && engineState === GameState.Your_turn) this.rejection = undefined;
		this.lastMatchState = stateKey;
		return {
			activeTeam: ruleState.activeTeam,
			turnNumber: ruleState.turnNumber,
			phase: ruleState.phase,
			selectedActorId: selectedActorId ?? null,
			aimAngle,
			power: this.input.chargePower ?? this.getDraggedPower(),
			availableItems: items,
			playbackLocked: engineState !== GameState.Your_turn || this.handler.getMatchResult() !== undefined,
			result: this.handler.getMatchResult(),
			rejection: this.rejection,
		};
	}

	public setRejection(error: unknown): void {
		const message = error instanceof Error ? error.message : "Action rejected";
		this.rejection = message.replace(/[\r\n]+/g, " ").slice(0, 160) || "Action rejected";
	}

	public clearRejection(): void { this.rejection = undefined; }

	public draw(renderer: RenderContext): void {
		const state = this.getState();
		renderer.push();
		renderer.setFillColor("#0f172a");
		const lines = [
			`Active team: Team ${state.activeTeam + 1}`,
			`Selected actor: ${state.selectedActorId ?? "None"}`,
			`Phase: ${state.phase}`,
			`Aim: ${state.aimAngle === null ? "None" : `${state.aimAngle.toFixed(1)}°`}`,
			`Power: ${Math.round(state.power * 10) / 10}`,
			`Available items: ${state.availableItems.length ? state.availableItems.join(", ") : "None"}`,
			state.playbackLocked ? `Input: Locked (${getEngineStateName(this.handler.getState())})` : "Input: Ready",
		];
		let y = 28;
		for (const line of lines) {
			renderer.drawText(line, 20, y, 15);
			y += 19;
		}
		if (state.result) {
			const result = state.result.status === MatchStatus.Draw ? "Draw" : `Winner: Team ${(state.result.winnerTeam ?? 0) + 1}`;
			renderer.drawText(result, renderer.WORLD_SIZE_X / 2 - 70, renderer.WORLD_SIZE_Y / 2, 24);
		}
		if (state.rejection) renderer.drawText(`Action rejected: ${state.rejection}`, 20, renderer.WORLD_SIZE_Y - 20, 15);
		renderer.pop();
	}

	private getDraggedActorId(): string | null {
		if (!this.input.start) return null;
		return this.handler.getEntityManager().getEntityAt(this.input.start.x, this.input.start.y)?.getId() ?? null;
	}

	private getDraggedAimAngle(): number | null {
		if (!this.input.start) return null;
		const end = this.input.currentMouse;
		const dx = end.x - this.input.start.x;
		const dy = end.y - this.input.start.y;
		if (Math.hypot(dx, dy) < 1) return null;
		return ((Math.atan2(dy, dx) * 180 / Math.PI + 180) % 360 + 360) % 360;
	}

	private getDraggedPower(): number {
		if (!this.input.start) return 0;
		return Math.min(Math.hypot(this.input.currentMouse.x - this.input.start.x, this.input.currentMouse.y - this.input.start.y) / 10, 10);
	}
}
