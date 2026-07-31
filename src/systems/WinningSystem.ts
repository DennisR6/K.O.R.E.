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

/**
 * Marks the match complete when exactly one configured team remains alive.
 *
 * Detection during active playback becomes PENDING: the result is finalized
 * only in the `flush` phase, after the accepted turn reached its
 * authoritative final state (PlaybackSystem hard sync). This guarantees the
 * playback is never cancelled mid-turn and no partial completed-match
 * snapshot is exposed.
 */
export class WinningSystem implements ISystem {
	private winner: number | undefined
	private pendingWinner: { team: number; turn: number } | undefined

	public constructor(private readonly teamCount: number) { }
	public getWinner(): number | undefined { return this.winner }
	public ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		if (ctx.state === GameState.Game_over) return
		const winner = evaluateLastTeamStanding(ctx.entities.getEntities(), this.teamCount)
		if (winner === undefined) return
		if (ctx.state === GameState.Playing) {
			// A winner is determinable while the turn still plays out. Pend the
			// detection with the turn it occurred in; `flush` finalizes it once
			// the playback sync has applied the authoritative final state.
			this.pendingWinner = { team: winner, turn: ctx.currTurn }
			return
		}
		this.finalize(ctx, winner, ctx.currTurn)
	}

	/**
	 * Finalizes a pending win in the final mutation phase of a tick. Runs
	 * AFTER the PlaybackSystem flush, which transitions the state from
	 * `Playing` to `Playing_done` once the accepted turn reached its
	 * authoritative final state - so a pending win is never finalized
	 * mid-playback and no partial completed-match snapshot is exposed.
	 */
	public flush(ctx: IGameContext): void {
		if (this.pendingWinner === undefined) return
		if (ctx.state === GameState.Playing) return
		this.finalize(ctx, this.pendingWinner.team, this.pendingWinner.turn)
		this.pendingWinner = undefined
	}

	private finalize(ctx: IGameContext, winner: number, turnNumber: number): void {
		this.winner = winner
		ctx.state = GameState.Game_over
		const result: MatchResult = {
			winnerTeam: winner,
			reason: MatchEndReason.LastTeamStanding,
			turnNumber,
		}
		ctx.setMatchResult?.(result)
	}
}
