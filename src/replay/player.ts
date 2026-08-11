import type { GameHandler } from "../kore/runtime/Handler.js";
import { GameState, type EngineSettings } from "../kore/runtime/types.js";
import type { ReplayDocument } from "./types.js";
import { validateReplayDocument, validateReplayOrigin } from "./types.js";
import type { PlayerSettings } from "../entity/types.js";
import { WinningSystem } from "../systems/WinningSystem.js";
import { GameEmitter } from "../emitter/EngineEmitter.js";
import { currentTurnMode } from "../rules/defaultGameModes.js";
import { RulePhase } from "../rules/types.js";
import { kore } from "../kore/sdk/index.js";

/**
 * Plays back a validated replay document through the SAME authoritative
 * domain transitions as the original action path: the `GameEmitter` is the
 * single place where shots advance the rule phase, start the next turn, and
 * update active team, turn number, and item counters. There is no parallel
 * replay-only rules implementation - a replay therefore restores and
 * advances turn number, rule phase, item economy, and active-team state
 * exactly as the live match did.
 */
export class ReplayPlayer {
	private handler: GameHandler;
	private emitter: GameEmitter;
	private replay: ReplayDocument;
	private tickCount = 0;
	private actionIndex = 0;
	private playing = true;

	public constructor(replay: ReplayDocument) {
		validateReplayDocument(replay);
		// The first recorded action must be able to resolve from the restored
		// origin; a live-state fallback with already-dead actors can never play.
		validateReplayOrigin(replay);
		this.replay = JSON.parse(JSON.stringify(replay));
		const teamCount = this.replay.initialSettings.playerCount ?? 2;
		this.handler = kore.restoreHandler(this.replay.initialSettings as EngineSettings);
		if (!(this.replay.initialSettings as EngineSettings).systems?.some(system => system.systemId === "core.winning")) this.handler.addSystem(new WinningSystem(teamCount));
		this.emitter = new GameEmitter(
			this.handler,
			this.replay.initialSettings.gameMode ?? currentTurnMode,
			teamCount,
			this.replay.seed,
		);
	}

	public playAll(): PlayerSettings[] {
		while (this.advance()) this.settlePlayback();
		return this.handler.getEntityManager().serialize();
	}

	/** Starts one recorded action. The caller ticks the handler to display its movement. */
	public advance(): boolean {
		if (!this.playing) return false;
		return this.startNextAction();
	}

	/** Restores the pristine origin and settles the replay at an action boundary. */
	public seek(actionIndex: number): void {
		if (!Number.isSafeInteger(actionIndex) || actionIndex < 0 || actionIndex > this.replay.actions.length) throw new Error("Replay seek index must be a valid action boundary");
		this.handler = kore.restoreHandler(this.replay.initialSettings as EngineSettings);
		if (!(this.replay.initialSettings as EngineSettings).systems?.some(system => system.systemId === "core.winning")) this.handler.addSystem(new WinningSystem(this.replay.initialSettings.playerCount ?? 2));
		this.emitter = new GameEmitter(this.handler, this.replay.initialSettings.gameMode ?? currentTurnMode, this.replay.initialSettings.playerCount ?? 2, this.replay.seed);
		this.actionIndex = 0;
		this.tickCount = 0;
		while (this.actionIndex < actionIndex) {
			if (!this.startNextAction()) throw new Error("Replay seek could not resolve the requested action");
			this.settlePlayback();
		}
	}

	public setPlaying(playing: boolean): void { this.playing = playing; }
	public isPlaying(): boolean { return this.playing; }
	public getActionIndex(): number { return this.actionIndex; }

	public isComplete(): boolean { return this.actionIndex >= this.replay.actions.length && this.handler.getState() !== GameState.Playing; }

	private settlePlayback(): void {
		let guard = 0;
		while (this.handler.getState() === GameState.Playing && guard < 10_000) {
			this.handler.tick();
			guard++;
			this.tickCount++;
		}
		if (guard >= 10_000) throw new Error("Replay playback did not settle within 10,000 ticks");
	}

	private startNextAction(): boolean {
		if (this.handler.getState() === GameState.Playing || this.actionIndex >= this.replay.actions.length) return false;
		const action = this.replay.actions[this.actionIndex++]!;
		if (action.type === "counter") {
			this.handler.dispatchEngineEffect(action.effect);
			return true;
		}
		if (action.type === "itemUse") {
			this.emitter.sendItemUse(action.actorId, action.itemId!, action.target as never);
			return true;
		}
		if (this.handler.getRuleState().phase === RulePhase.Item) this.handler.skipCurrentPhase();
		if (this.handler.getRuleState().phase !== RulePhase.Physics) throw new Error(`Replay shot cannot resolve in rule phase ${String(this.handler.getRuleState().phase)}`);
		this.emitter.sendShot(action.actorId, action.input!.angle, action.input!.power);
		return true;
	}

	public getHandler(): GameHandler {
		return this.handler;
	}

	/** Total engine ticks consumed while replaying the recorded actions. */
	public getTickCount(): number {
		return this.tickCount;
	}
	/** Number of recorded actions available for visible playback. */
	public getActionCount(): number { return this.replay.actions.length; }
}
