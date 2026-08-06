import { GameState } from "../engine/types.js";
import type { IGameContext, ISerializableSystem, SystemSettings } from "./types.js";


export class GameStateManager implements ISerializableSystem<SystemSettings> {
	public readonly systemId = "core.game-state-manager";
	constructor() { }
	ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		switch (ctx.state) {
			case GameState.Starting: ctx.state = GameState.Waiting_for_Players; break

			case GameState.Waiting_for_Players: ctx.state = GameState.ChooseTeam; break

			case GameState.ChooseTeam: ctx.state = GameState.Waiting_for_Players; break

			case GameState.Your_turn: break
			case GameState.Opponents_turn: break

			case GameState.Turn_done: break

			case GameState.Round_done: break

			case GameState.Simulating: break
			case GameState.Simulating_done: break

			case GameState.Playing: break
			case GameState.Playing_done: ctx.state = GameState.Waiting_for_server; break

			case GameState.Waiting_for_server: ctx.state = GameState.ChooseTeam; break

			case GameState.Game_over: break
			case GameState.Goal_scored: ctx.state = GameState.Error; break
			case GameState.Error: break
		}
	}
	public toSettings(): SystemSettings { return { systemId: this.systemId, schemaVersion: 1, state: {} }; }

}
