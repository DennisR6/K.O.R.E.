import { GameState } from "../engine/types.js";
import type { IEntity } from "../entity/Entity.js";
import { MatchEndReason, type MatchResult } from "../rules/types.js";
import type { IGameContext, ISystem } from "./types.js";

/** Returns the sole surviving configured team, if one remains. */
export function evaluateLastTeamStanding(entities: IEntity[], teamCount: number): number | undefined {
	if (!Number.isSafeInteger(teamCount) || teamCount < 1) throw new Error("Winning evaluation requires at least one team")
	const aliveTeams = new Set<number>()
	for (const entity of entities) {
		if (entity.isDead()) continue
		for (const team of entity.getTeam()) if (team >= 0 && team < teamCount) aliveTeams.add(team)
	}
	return aliveTeams.size === 1 ? [...aliveTeams][0] : undefined
}

/** Marks the match complete when exactly one configured team remains alive. */
export class WinningSystem implements ISystem {
	private winner: number | undefined

	public constructor(private readonly teamCount: number) { }
	public getWinner(): number | undefined { return this.winner }
	public ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		if (ctx.state === GameState.Game_over) return
		this.winner = evaluateLastTeamStanding(ctx.entities.getEntities(), this.teamCount)
		if (this.winner !== undefined) {
			ctx.state = GameState.Game_over
			const result: MatchResult = {
				winnerTeam: this.winner,
				reason: MatchEndReason.LastTeamStanding,
				turnNumber: ctx.currTurn,
			}
			ctx.setMatchResult?.(result)
		}
	}
}
