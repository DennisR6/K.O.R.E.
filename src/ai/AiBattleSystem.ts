import { AiTurnEmitter } from "./aiEmitter.js";
import type { AiSettings } from "./types.js";
import type { GameHandler } from "../engine/Handler.js";
import { GameState, type IMouse, type IInputEmitter } from "../engine/types.js";
import { RulePhase } from "../rules/types.js";
import type { IGameContext, ISerializableSystem, SystemSettings } from "../systems/types.js";
import { koreAi } from "../kore/ai.js";
import type { HardAiWorkerHost } from "./worker/host.js";
import { isValidInput } from "../input/validate.js";

/**
 * Autonomous KI-vs-KI battle driver.
 *
 * Acts as an `ISystem` that plays both teams automatically through the shared
 * `AiTurnEmitter` boundary (the same producer/filter path the fuzz harness and
 * the versus-AI mode use). It implements `IMouse` as a pure pass-through so it
 * can serve as the scene's mouse handler without accepting any input: a battle
 * is a spectator match.
 *
 * Turn flow: the canonical mode starts each turn in the item phase, but the
 * stock AI produces shot-only decisions, so the driver skips the item phase
 * and submits the AI shot once the physics phase is active. The local
 * `GameEmitter` then simulates, plays back, and advances the rule state.
 */
export class AiBattleSystem implements ISerializableSystem<SystemSettings>, IMouse {
	/** Explicit protocol identity; the runtime handler/emitter references stay adapters. */
	public readonly systemId = "ai.battle";
	private readonly emitter0: AiTurnEmitter;
	private readonly emitter1: AiTurnEmitter;
	private readonly settings0: AiSettings;
	private readonly settings1: AiSettings;

	public constructor(
		private readonly handler: GameHandler | undefined,
		private readonly targetEmitter: IInputEmitter | undefined,
		aiTeam0: AiSettings,
		aiTeam1: AiSettings,
		private readonly workerHost?: HardAiWorkerHost,
	) {
		this.emitter0 = koreAi.createTurnEmitter(aiTeam0);
		this.emitter1 = koreAi.createTurnEmitter(aiTeam1);
		this.settings0 = aiTeam0;
		this.settings1 = aiTeam1;
	}

	public static fromSettings(state: Record<string, unknown>): AiBattleSystem {
		const team0 = state.team0 as AiSettings | undefined;
		const team1 = state.team1 as AiSettings | undefined;
		if (!team0 || !team1 || !Number.isFinite(team0.seed) || !Number.isFinite(team1.seed) || !Number.isSafeInteger(team0.team) || !Number.isSafeInteger(team1.team)) throw new Error("Malformed AI battle settings");
		return new AiBattleSystem(undefined, undefined, structuredClone(team0), structuredClone(team1));
	}

	public toSettings(): SystemSettings {
		return {
			systemId: this.systemId,
			schemaVersion: 1,
			state: { team0: { ...this.settings0 }, team1: { ...this.settings1 } },
		};
	}

	public ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		if (!this.handler || !this.targetEmitter) return;
		if (ctx.state !== GameState.Your_turn) return;
		const team = this.handler.getActiveTeam();
		const rule = this.handler.getRuleState();
		if (rule.phase === RulePhase.Item) {
			// The stock AI never chooses items; skip the item phase for it.
			if (!this.targetEmitter.skipPhase) throw new Error("KI vs KI requires an emitter with phase skipping");
			this.targetEmitter.skipPhase();
			return;
		}
		if (rule.phase !== RulePhase.Physics) return;
		if (this.workerHost?.isAvailable()) {
			const prepared = this.workerHost.consumePreparedAction();
			if (prepared && isValidInput(prepared) && this.handler.isActorEligibleForAction(prepared.actorId) && this.handler.getEntityManager().getEntityById(prepared.actorId)?.getTeam().includes(team)) {
				this.targetEmitter.sendShot(prepared.actorId, prepared.angle, prepared.power);
				return;
			}
			if (this.workerHost.isThinking()) return;
		}
		const emitter = team === 0 ? this.emitter0 : this.emitter1;
		const aiSettings = team === 0 ? this.settings0 : this.settings1;
		const fallbackReason = this.workerHost?.getFallbackReason() ?? "worker-unavailable";
		const fallbackStart = this.workerHost?.beginSynchronousFallback(fallbackReason, team);
		const submitted = emitter.executeTurn(this.handler, aiSettings, this.targetEmitter);
		if (this.workerHost && fallbackStart !== undefined) this.workerHost.completeSynchronousFallback(fallbackReason, team, fallbackStart);
		if (!submitted) {
			// Defensive fallback: the hard AI always submits while its team has
			// living actors and enemies exist; a neutral straight shot keeps a
			// battle moving if a future producer returns no decision.
			console.warn(`KI vs KI: team ${team} produced no action in the physics phase; submitting a neutral shot`);
			const actor = this.handler.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(team) && this.handler!.isActorEligibleForAction(entity.getId()));
			if (actor) this.targetEmitter.sendShot(actor.getId(), 0, 4);
		}
	}

	/** Exposes the authoritative shot emitter for recorder/analysis introspection. */
	public getEmitter(): IInputEmitter | undefined { return this.targetEmitter; }
	public isAiThinking(): boolean { return this.workerHost?.isThinking() ?? false; }

	// Passive mouse contract: a battle never accepts pointer input, but the
	// result overlay wraps this handler as its gameplay pass-through.
	public handleMousePressed(): void { }
	public handleMouseReleased(): void { }
	public handleMouseWheel(_event: WheelEvent): void { }
	public updateMouse(_x: number, _y: number): void { }
	public reset(): void { }
}
