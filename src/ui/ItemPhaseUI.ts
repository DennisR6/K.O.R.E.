import type { GameHandler } from "../engine/Handler.js";
import { validateItemTarget } from "../item/target.js";
import type { InventoryItem, ItemDocument } from "../item/types.js";
import type { RuleInterpreter } from "../rules/RuleInterpreter.js";
import { RulePhase } from "../rules/types.js";

/** UI helper for managing item phase interactions, available inventory, target validation, and skipping. */
export class ItemPhaseUI {
	public static getAvailableItems(handler: GameHandler, actorId: string): InventoryItem[] {
		const actor = handler.getEntityManager().getEntityById(actorId);
		if (!actor || actor.isDead()) return [];
		return actor.getInventory().filter(item => item.remainingUses > 0);
	}

	public static validateTarget(handler: GameHandler, actorId: string, itemId: string, target: unknown): { valid: boolean; error?: string } {
		const actor = handler.getEntityManager().getEntityById(actorId);
		if (!actor || actor.isDead()) return { valid: false, error: "Actor not found or inactive" };
		const settings = handler.getSettings();
		const items = (settings && "items" in settings ? settings.items : []) as ItemDocument[];
		const item = items.find(i => i.id === itemId);
		if (!item) return { valid: false, error: `Item '${itemId}' not found` };

		try {
			validateItemTarget(item, target, {
				actor,
				entities: handler.getEntityManager().getEntities(),
				worldSize: handler.getContext().worldSize,
			});
			return { valid: true };
		} catch (e: any) {
			return { valid: false, error: e?.message ?? "Invalid target" };
		}
	}

	public static useItem(handler: GameHandler, actorId: string, itemId: string, target: unknown = { type: "self" }): void {
		const ruleState = handler.getRuleState();
		if (ruleState.phase !== RulePhase.Item) {
			throw new Error("Items may only be used during the item phase");
		}
		handler.useItem(actorId, itemId, target);
	}

	public static skipItemPhase(handler: GameHandler, interpreter: RuleInterpreter): void {
		const ruleState = handler.getRuleState();
		if (ruleState.phase !== RulePhase.Item) {
			throw new Error("Cannot skip item phase when not in item phase");
		}
		const nextState = interpreter.advancePhase(ruleState);
		handler.setRuleState(nextState);
	}
}
