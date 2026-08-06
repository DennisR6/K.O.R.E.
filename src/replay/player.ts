import { GameHandler, GameHandlerBuilder } from "../engine/Handler.js";
import { GameState } from "../engine/types.js";
import type { ReplayDocument } from "./types.js";
import { validateReplayDocument } from "./types.js";
import type { PlayerSettings } from "../entity/types.js";
import { WinningSystem } from "../systems/WinningSystem.js";
import { GameEmitter } from "../emitter/EngineEmitter.js";
import { currentTurnMode } from "../rules/defaultGameModes.js";
import { RulePhase } from "../rules/types.js";

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

	public constructor(replay: ReplayDocument) {
		validateReplayDocument(replay);
		this.replay = JSON.parse(JSON.stringify(replay));
		const teamCount = this.replay.initialSettings.playerCount ?? 2;
		this.handler = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(teamCount))
			.fromSettings(this.replay.initialSettings)
			.build();
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
		if (this.handler.getState() === GameState.Playing || this.actionIndex >= this.replay.actions.length) return false;
		const action = this.replay.actions[this.actionIndex++]!;
		if (action.type === "itemUse") {
			this.emitter.sendItemUse(action.actorId, action.itemId!, action.target as never);
			return true;
		}
		if (this.handler.getRuleState().phase === RulePhase.Item) {
			// The same authoritative phase skip the live flow performs before a shot.
			this.handler.skipCurrentPhase();
		}
		if (this.handler.getRuleState().phase !== RulePhase.Physics) {
			throw new Error(`Replay shot cannot resolve in rule phase ${String(this.handler.getRuleState().phase)}`);
		}
		this.emitter.sendShot(action.actorId, action.input!.angle, action.input!.power);
		return true;
	}

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

	public getHandler(): GameHandler {
		return this.handler;
	}

	/** Total engine ticks consumed while replaying the recorded actions. */
	public getTickCount(): number {
		return this.tickCount;
	}
}
