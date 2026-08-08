import { AiTurnEmitter } from "./aiEmitter.js";
import type { AiSettings } from "./types.js";
import type { GameHandler } from "../engine/Handler.js";
import { GameState, type IInputEmitter } from "../engine/types.js";
import { RulePhase } from "../rules/types.js";
import type { IGameContext, ISerializableSystem, SystemSettings } from "../systems/types.js";
import { koreAi } from "../kore/ai.js";

/** Drives one AI-controlled team while leaving the other team available to UI input. */
export class AiOpponentSystem implements ISerializableSystem<SystemSettings> {
	public readonly systemId = "ai.opponent";
	private readonly emitter: AiTurnEmitter;

	public constructor(
		private readonly handler: GameHandler | undefined,
		private readonly targetEmitter: IInputEmitter | undefined,
		private readonly settings: AiSettings,
	) {
		this.emitter = koreAi.createTurnEmitter(settings);
	}

	public static fromSettings(state: Record<string, unknown>): AiOpponentSystem {
		const ai = state.ai as AiSettings | undefined;
		if (!ai || !Number.isFinite(ai.seed) || !Number.isSafeInteger(ai.team) || (ai.difficulty !== "easy" && ai.difficulty !== "medium" && ai.difficulty !== "hard")) throw new Error("Malformed AI opponent settings");
		return new AiOpponentSystem(undefined, undefined, structuredClone(ai));
	}

	public toSettings(): SystemSettings {
		return { systemId: this.systemId, schemaVersion: 1, state: { ai: structuredClone(this.settings) } };
	}

	public ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		if (!this.handler || !this.targetEmitter || (ctx.state !== GameState.Your_turn && ctx.state !== GameState.Opponents_turn) || this.handler.getActiveTeam() !== this.settings.team) return;
		const rule = this.handler.getRuleState();
		if (rule.phase === RulePhase.Item) {
			this.targetEmitter.skipPhase?.();
			return;
		}
		if (rule.phase !== RulePhase.Physics) return;
		if (this.emitter.executeTurn(this.handler, this.settings, this.targetEmitter)) return;
		const actor = this.handler.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(this.settings.team) && this.handler!.isActorEligibleForAction(entity.getId()));
		if (actor) this.targetEmitter.sendShot(actor.getId(), 0, 4);
	}
}
