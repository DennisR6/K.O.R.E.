import type { GameHandler } from "../kore/runtime/Handler.js";
import type { IInputEmitter } from "../kore/runtime/types.js";
import type { ItemTarget } from "../item/target.js";
import type { AiSettings } from "./types.js";
// The pure shared input boundary: `server/gameRegistry` re-exports the same
// function, but the AI path must not pull server-only modules into the
// browser bundle.
import { isValidInput } from "../input/validate.js";
import { runtimeNow } from "../kore/runtime/runtimeLog.js";
import { RulePhase } from "../rules/types.js";

export interface AiDecision {
	shot?: { actorId: string; angle: number; power: number };
	itemUse?: { actorId: string; itemId: string; target: ItemTarget };
}

export interface IAiTurnProducer {
	computeTurn(handler: GameHandler, aiSettings: AiSettings): AiDecision | undefined;
}

export class AiTurnEmitter {
	constructor(private readonly producer: IAiTurnProducer) {}

	public executeTurn(handler: GameHandler, aiSettings: AiSettings, targetEmitter: IInputEmitter): boolean {
		const started = runtimeNow();
		handler.log("ai.decision.started", { team: aiSettings.team, difficulty: aiSettings.difficulty });
		const decision = this.producer.computeTurn(handler, aiSettings);
		if (!decision) {
			// A producer may have no tactical choice when the opponent has just
			// been eliminated but the completion system has not flushed yet. Keep
			// the authoritative turn alive with a legal neutral shot whenever a
			// controlled actor still exists; this is not a gameplay decision and
			// is recorded as a safety fallback for diagnostics.
			if (handler.getRuleState().phase === RulePhase.Physics) {
				const fallback = handler.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(aiSettings.team) && handler.isActorEligibleForAction(entity.getId()));
				if (fallback && isValidInput({ actorId: fallback.getId(), angle: 0, power: 4 })) {
					targetEmitter.sendShot(fallback.getId(), 0, 4);
					handler.log("ai.fallback.neutral-shot", { team: aiSettings.team, actorId: fallback.getId() });
					handler.log("ai.decision.completed", { team: aiSettings.team, difficulty: aiSettings.difficulty, durationMs: runtimeNow() - started, submitted: true, executionMode: "synchronous" });
					return true;
				}
			}
			handler.log("ai.decision.completed", { team: aiSettings.team, difficulty: aiSettings.difficulty, durationMs: runtimeNow() - started, submitted: false, executionMode: "synchronous" });
			return false;
		}

		let actionSubmitted = false;

		if (decision.itemUse) {
			const { actorId, itemId, target } = decision.itemUse;
			const actor = handler.getEntityManager().getEntityById(actorId);
			if (actor && !actor.isDead() && actor.getTeam().includes(aiSettings.team) && handler.isActorEligibleForAction(actorId)) {
				handler.log("input.accepted", { actionType: "item", actorId, team: aiSettings.team });
				targetEmitter.sendItemUse?.(actorId, itemId, target);
				actionSubmitted = true;
			}
		}

		if (decision.shot) {
			const { actorId, angle, power } = decision.shot;
			const actor = handler.getEntityManager().getEntityById(actorId);
			if (actor && !actor.isDead() && actor.getTeam().includes(aiSettings.team) && handler.isActorEligibleForAction(actorId) && isValidInput({ actorId, angle, power })) {
				handler.log("input.accepted", { actionType: "shot", actorId, angle, power, team: aiSettings.team });
				targetEmitter.sendShot(actorId, angle, power);
				actionSubmitted = true;
			}
		}

		handler.log("ai.decision.completed", { team: aiSettings.team, difficulty: aiSettings.difficulty, durationMs: runtimeNow() - started, submitted: actionSubmitted, executionMode: "synchronous" });
		return actionSubmitted;
	}
}
