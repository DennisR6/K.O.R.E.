import { GameState } from "../runtime/types.js";
import type { GameHandler } from "../runtime/Handler.js";
import { MatchStatus, RulePhase, type MatchResult } from "../../rules/types.js";
import type { UiSystem } from "../../systems/UiSystem.js";
import { createEnglishLanguage, formatLanguage, LANGUAGE_KEYS, type LanguageCatalog } from "../../i18n/language.js";
import type { UiComponentSettings } from "@coffeemakerstudio/drip";
import type { ItemTargetType } from "../../item/types.js";
import type { IEntity } from "../../entity/Entity.js";

export interface KoreHudItemProjection { itemId: string; name?: string; description?: string; targetType?: ItemTargetType; remainingUses: number; enabled: boolean; component?: UiComponentSettings; showLabel: boolean }
export interface KoreHudWorldPoint { x: number; y: number }
export interface KoreHudWorldGuidance {
	activeMarkers: Array<KoreHudWorldPoint & { radius: number }>;
	aimPreview?: { from: KoreHudWorldPoint; to: KoreHudWorldPoint; left: KoreHudWorldPoint; right: KoreHudWorldPoint };
}
export interface KoreHudProjection {
	revision: number;
	turn: { number: number; activeTeam: number; phase: RulePhase; engineState: GameState; selectedActorId: string | null; aimAngle: number | null; power: number };
	inventory: KoreHudItemProjection[];
	match: { result?: MatchResult; inputLocked: boolean; waiting: boolean; paused: boolean };
	aiThinking: boolean;
	tutorial?: boolean;
	guidance: KoreHudWorldGuidance;
	rejection?: string;
}

/** Pure, detached gameplay-to-HUD projection boundary. */
export function createKoreHudProjection(handler: GameHandler, input?: UiSystem, rejection?: string): KoreHudProjection {
	const rule = handler.getRuleState(); const state = handler.getState();
	const selectedActorId = input?.selectedActorId ?? (input?.start ? handler.getEntityManager().getEntityAt(input.start.x, input.start.y)?.getId() ?? null : null);
	const activeActors = handler.getEntityManager().getEntities().filter(entity => !entity.isDead() && entity.isActorEligible() && entity.getTeam().includes(rule.activeTeam));
	const dx = input?.start ? input.currentMouse.x - input.start.x : 0; const dy = input?.start ? input.currentMouse.y - input.start.y : 0;
	const length = Math.hypot(dx, dy);
	const aimAngle = input?.aimAngle ?? (input?.start && length >= 1 ? ((Math.atan2(dy, dx) * 180 / Math.PI + 180) % 360 + 360) % 360 : null);
	const power = input?.chargePower ?? (input?.start ? Math.min(length / 10, 10) : 0);
	const result = handler.getMatchResult();
	const aiThinking = (state === GameState.Your_turn || state === GameState.Opponents_turn) && handler.getSystems().some(system => typeof (system as { isAiThinking?: unknown }).isAiThinking === "function" && (system as unknown as { isAiThinking: () => boolean }).isAiThinking());
	const activeMarkers = (state === GameState.Your_turn || state === GameState.Opponents_turn)
		? handler.getEntityManager().getEntities().filter(entity => !entity.isDead() && entity.getTeam().includes(rule.activeTeam)).map(entity => ({ ...entity.getPos(), radius: entity.getBounds().x }))
		: [];
	const aimPreview = createAimPreview(handler, input);
	return {
		revision: rule.turnNumber * 10_000 + rule.activeTeam * 100 + (result ? 1 : 0),
		turn: { number: rule.turnNumber, activeTeam: rule.activeTeam, phase: rule.phase, engineState: state, selectedActorId: selectedActorId ?? null, aimAngle, power },
		inventory: projectTeamInventory(handler, activeActors, rule.phase === RulePhase.Item && state === GameState.Your_turn),
		match: { ...(result ? { result } : {}), inputLocked: state !== GameState.Your_turn || result !== undefined, waiting: state === GameState.Waiting_for_server || state === GameState.Opponents_turn, paused: handler.isPaused() },
		aiThinking,
		...(rule.turnNumber === 0 && rule.phase === RulePhase.Physics && state === GameState.Your_turn && !result ? { tutorial: true } : {}),
		guidance: { activeMarkers, ...(aimPreview ? { aimPreview } : {}) },
		...(rejection ? { rejection: rejection.replace(/[\r\n]+/g, " ").slice(0, 160) } : {}),
	};
}

function projectTeamInventory(handler: GameHandler, actors: IEntity[], enabled: boolean): KoreHudItemProjection[] {
	// A fixed loadout is copied to every figure for authoritative targeting, but
	// it represents one team allowance. Display one entry per item and the
	// highest remaining value instead of multiplying it by the figure count.
	const totals = new Map<string, number>();
	for (const actor of actors) for (const item of actor.getInventory()) {
		if (item.remainingUses > 0) totals.set(item.itemId, Math.max(totals.get(item.itemId) ?? 0, item.remainingUses));
	}
	return [...totals].map(([itemId, remainingUses]) => {
		const document = handler.getSettings()?.items?.find(candidate => candidate.id === itemId);
		return { itemId, ...(document?.name ? { name: document.name } : {}), ...(document?.description ? { description: document.description } : {}), ...(document?.targetType ? { targetType: document.targetType } : {}), remainingUses, enabled, ...(document?.ui?.component ? { component: structuredClone(document.ui.component) } : {}), showLabel: document?.ui?.showLabel ?? true };
	});
}

/** Converts the active pointer drag into immutable world-space arrow geometry. */
function createAimPreview(handler: GameHandler, input: UiSystem | undefined): KoreHudWorldGuidance["aimPreview"] {
	if (handler.getState() !== GameState.Your_turn || !input?.start || input.end) return undefined;
	const actor = handler.getEntityManager().getEntityAt(input.start.x, input.start.y);
	if (!actor || actor.isDead() || !actor.getTeam().includes(handler.getActiveTeam())) return undefined;
	const dx = input.start.x - input.currentMouse.x; const dy = input.start.y - input.currentMouse.y;
	const length = Math.hypot(dx, dy);
	if (length < 1) return undefined;
	const direction = { x: dx / length, y: dy / length };
	const from = actor.getPos(); const arrowLength = Math.min(100, Math.max(35, length));
	const to = { x: from.x + direction.x * arrowLength, y: from.y + direction.y * arrowLength };
	const left = rotate(direction, (Math.PI * 3) / 4); const right = rotate(direction, -(Math.PI * 3) / 4);
	const headLength = 12;
	return { from, to, left: { x: to.x + left.x * headLength, y: to.y + left.y * headLength }, right: { x: to.x + right.x * headLength, y: to.y + right.y * headLength } };
}

function rotate(vector: KoreHudWorldPoint, angle: number): KoreHudWorldPoint {
	return { x: vector.x * Math.cos(angle) - vector.y * Math.sin(angle), y: vector.x * Math.sin(angle) + vector.y * Math.cos(angle) };
}

export function hudResultText(result: MatchResult | undefined, language: LanguageCatalog = createEnglishLanguage()): string {
	if (!result) return "";
	return result.status === MatchStatus.Draw ? formatLanguage(language, LANGUAGE_KEYS.HudDraw, {}) : formatLanguage(language, LANGUAGE_KEYS.HudTeamWins, { team: (result.winnerTeam ?? 0) + 1 });
}

export function hudStateText(state: GameState, language: LanguageCatalog = createEnglishLanguage()): string {
	const key = state === GameState.Starting ? LANGUAGE_KEYS.HudStateStarting
		: state === GameState.Waiting_for_Players ? LANGUAGE_KEYS.HudStateWaitingPlayers
		: state === GameState.ChooseTeam ? LANGUAGE_KEYS.HudStateChooseTeam
		: state === GameState.Your_turn ? LANGUAGE_KEYS.HudStateYourTurn
		: state === GameState.Opponents_turn ? LANGUAGE_KEYS.HudStateOpponentTurn
		: state === GameState.Turn_done ? LANGUAGE_KEYS.HudStateTurnDone
		: state === GameState.Round_done ? LANGUAGE_KEYS.HudStateRoundDone
		: state === GameState.Simulating ? LANGUAGE_KEYS.HudStateSimulating
		: state === GameState.Simulating_done ? LANGUAGE_KEYS.HudStateSimulatingDone
		: state === GameState.Playing ? LANGUAGE_KEYS.HudStatePlaying
		: state === GameState.Playing_done ? LANGUAGE_KEYS.HudStatePlayingDone
		: state === GameState.Waiting_for_server ? LANGUAGE_KEYS.HudStateWaiting
		: state === GameState.Game_over ? LANGUAGE_KEYS.HudStateGameOver
		: state === GameState.Goal_scored ? LANGUAGE_KEYS.HudStateGoalScored
		: state === GameState.Error ? LANGUAGE_KEYS.HudStateError
		: LANGUAGE_KEYS.HudStateUnknown;
	return formatLanguage(language, key, {});
}
