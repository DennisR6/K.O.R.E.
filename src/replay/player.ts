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
		for (const action of this.replay.actions) {
			if (action.type === "shoot") {
				if (this.handler.getRuleState().phase === RulePhase.Item) {
					// The same authoritative phase skip the live flow performs
					// before a shot (RuleInterpreter.advancePhase).
					this.handler.skipCurrentPhase();
				}
				if (this.handler.getRuleState().phase !== RulePhase.Physics) {
					throw new Error(
						`Replay shot cannot resolve in rule phase ${String(this.handler.getRuleState().phase)}`,
					)
				}
				this.emitter.sendShot(action.actorId, action.input!.angle, action.input!.power);
				// Drive the playback to completion exactly like the live loop;
				// the emitter completion callback then advances the rule state.
				let guard = 0;
				while (this.handler.getState() === GameState.Playing && guard < 10_000) {
					this.handler.tick();
					guard++;
				}
				if (guard >= 10_000) throw new Error("Replay playback did not settle within 10,000 ticks")
			} else {
				this.emitter.sendItemUse(action.actorId, action.itemId!, action.target as never);
			}
		}
		return this.handler.getEntityManager().serialize();
	}

	public getHandler(): GameHandler {
		return this.handler;
	}
}
