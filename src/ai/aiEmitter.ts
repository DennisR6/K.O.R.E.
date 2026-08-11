import type { GameHandler } from "../kore/runtime/Handler.js";
import type { IInputEmitter } from "../kore/runtime/types.js";
import type { ItemTarget } from "../item/target.js";
import type { AiSettings } from "./types.js";
// The pure shared input boundary: `server/gameRegistry` re-exports the same
// function, but the AI path must not pull server-only modules into the
// browser bundle.
import { isValidInput } from "../input/validate.js";
import { runtimeNow } from "../kore/runtime/runtimeLog.js";

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
