import { GameHandler, GameHandlerBuilder } from "../engine/Handler.js";
import type { ReplayDocument } from "./types.js";
import { validateReplayDocument } from "./types.js";
import type { PlayerSettings } from "../entity/types.js";
import { WinningSystem } from "../systems/WinningSystem.js";

export class ReplayPlayer {
	private handler: GameHandler;
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
	}

	public playAll(): PlayerSettings[] {
		for (const action of this.replay.actions) {
			if (action.type === "shoot" && action.input) {
				try {
					this.handler.resolveTurn({
						actorId: action.actorId,
						angle: action.input.angle,
						power: action.input.power,
					});
				} catch {
					// Ignore invalid action during replay playback
				}
			} else if (action.type === "itemUse" && action.itemId) {
				try {
					this.handler.useItem(action.actorId, action.itemId, action.target);
				} catch {
					// Ignore invalid item use
				}
			}
		}
		return this.handler.getEntityManager().serialize();
	}

	public getHandler(): GameHandler {
		return this.handler;
	}
}
