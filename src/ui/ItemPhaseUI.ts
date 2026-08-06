import type { GameHandler } from "../engine/Handler.js";
import { validateItemTarget } from "../item/target.js";
import type { InventoryItem, ItemDocument } from "../item/types.js";
import { RuleInterpreter } from "../rules/RuleInterpreter.js";
import { RulePhase } from "../rules/types.js";
import type { IInputEmitter } from "../engine/types.js";
import type { ItemTarget } from "../item/target.js";

/** UI helper for managing item phase interactions, available inventory, target validation, and skipping. */
export class ItemPhaseUI {
	public constructor(private readonly handler: GameHandler, private readonly emitter: IInputEmitter) { }

	public getItems(actorId: string): InventoryItem[] { return ItemPhaseUI.getAvailableItems(this.handler, actorId) }

	public getPhaseState(): { phase: RulePhase; activeTeam: number; turnNumber: number; itemUses: number; canUseItems: boolean; canSkip: boolean } {
		const state = this.handler.getRuleState()
		return { ...state, canUseItems: state.phase === RulePhase.Item, canSkip: state.phase !== RulePhase.Physics && state.phase !== RulePhase.Complete }
	}

	public use(actorId: string, itemId: string, target: ItemTarget = { type: "self" }): void {
		if (this.handler.getRuleState().phase !== RulePhase.Item) throw new Error("Items may only be used during the item phase")
		const validation = ItemPhaseUI.validateTarget(this.handler, actorId, itemId, target)
		if (!validation.valid) throw new Error(validation.error)
		if (!this.emitter.sendItemUse) throw new Error("This input emitter does not support items")
		this.emitter.sendItemUse(actorId, itemId, target)
	}

	public skip(): void {
		if (!this.emitter.skipPhase) throw new Error("This input emitter does not support phase changes")
		this.emitter.skipPhase()
	}

	public static getAvailableItems(handler: GameHandler, actorId: string): InventoryItem[] {
		const actor = handler.getEntityManager().getEntityById(actorId);
		if (!actor || actor.isDead()) return [];
		return actor.getInventory().filter(item => item.remainingUses > 0).map(item => ({ ...item }));
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
		const mode = handler.getSettings()?.gameMode;
		if (mode) handler.setRuleState(new RuleInterpreter(mode).useItem(ruleState));
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
