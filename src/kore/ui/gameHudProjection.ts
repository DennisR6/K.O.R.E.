import { GameState, getEngineStateName } from "../../engine/types.js";
import type { GameHandler } from "../../engine/Handler.js";
import { MatchStatus, RulePhase, type MatchResult } from "../../rules/types.js";
import type { UiSystem } from "../../systems/UiSystem.js";

export interface KoreHudItemProjection { itemId: string; remainingUses: number; enabled: boolean }
export interface KoreHudProjection {
	revision: number;
	turn: { number: number; activeTeam: number; phase: RulePhase; engineState: GameState; selectedActorId: string | null; aimAngle: number | null; power: number };
	inventory: KoreHudItemProjection[];
	match: { result?: MatchResult; inputLocked: boolean; waiting: boolean; paused: boolean };
	rejection?: string;
}

/** Pure, detached gameplay-to-HUD projection boundary. */
export function createKoreHudProjection(handler: GameHandler, input?: UiSystem, rejection?: string): KoreHudProjection {
	const rule = handler.getRuleState(); const state = handler.getState();
	const selectedActorId = input?.selectedActorId ?? (input?.start ? handler.getEntityManager().getEntityAt(input.start.x, input.start.y)?.getId() ?? null : null);
	const actor = selectedActorId ? handler.getEntityManager().getEntityById(selectedActorId) : handler.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(rule.activeTeam));
	const dx = input?.start ? input.currentMouse.x - input.start.x : 0; const dy = input?.start ? input.currentMouse.y - input.start.y : 0;
	const length = Math.hypot(dx, dy);
	const aimAngle = input?.aimAngle ?? (input?.start && length >= 1 ? ((Math.atan2(dy, dx) * 180 / Math.PI + 180) % 360 + 360) % 360 : null);
	const power = input?.chargePower ?? (input?.start ? Math.min(length / 10, 10) : 0);
	const result = handler.getMatchResult();
	return {
		revision: rule.turnNumber * 10_000 + rule.activeTeam * 100 + (result ? 1 : 0),
		turn: { number: rule.turnNumber, activeTeam: rule.activeTeam, phase: rule.phase, engineState: state, selectedActorId: selectedActorId ?? null, aimAngle, power },
		inventory: (actor?.getInventory() ?? []).filter(item => item.remainingUses > 0).map(item => ({ itemId: item.itemId, remainingUses: item.remainingUses, enabled: rule.phase === RulePhase.Item && state === GameState.Your_turn })),
		match: { ...(result ? { result } : {}), inputLocked: state !== GameState.Your_turn || result !== undefined, waiting: state === GameState.Waiting_for_server || state === GameState.Opponents_turn, paused: handler.isPaused() },
		...(rejection ? { rejection: rejection.replace(/[\r\n]+/g, " ").slice(0, 160) } : {}),
	};
}

export function hudResultText(result: MatchResult | undefined): string { if (!result) return ""; return result.status === MatchStatus.Draw ? "Draw" : `Team ${(result.winnerTeam ?? 0) + 1} wins`; }
export function hudStateText(state: GameState): string { return getEngineStateName(state); }
