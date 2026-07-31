import { GameState } from "../engine/types.js";
import type { IEntity } from "../entity/Entity.js";
import { MatchEndReason, MatchStatus, type MatchResult } from "../rules/types.js";
import type { IGameContext, ISystem } from "./types.js";

/**
 * Discriminated outcome of a last-team-standing evaluation. `Ongoing` covers
 * every non-terminal state (zero living figures counted so far or several
 * teams still alive); `Winner` and `Draw` are the only terminal outcomes.
 */
export type LastTeamStandingEvaluation =
	| { status: MatchStatus.Ongoing }
	| { status: MatchStatus.Winner; winnerTeam: number }
	| { status: MatchStatus.Draw }

/**
 * Evaluates the living teams among the given entities. Exactly one living
 * configured team yields `Winner`; zero living teams yield `Draw`; anything
 * else is `Ongoing`. A draw never invents a team ID.
 */
export function evaluateLastTeamStanding(entities: IEntity[], teamCount: number): LastTeamStandingEvaluation {
	if (!Number.isSafeInteger(teamCount) || teamCount < 1) throw new Error("Winning evaluation requires at least one team")
	const aliveTeams = new Set<number>()
	for (const entity of entities) {
		if (entity.isDead()) continue
		for (const team of entity.getTeam()) if (team >= 0 && team < teamCount) aliveTeams.add(team)
	}
	if (aliveTeams.size === 0) return { status: MatchStatus.Draw }
	if (aliveTeams.size === 1) return { status: MatchStatus.Winner, winnerTeam: [...aliveTeams][0] }
	return { status: MatchStatus.Ongoing }
}

/**
 * Marks the match complete when the configured teams reach a terminal
 * last-team-standing outcome (exactly one team alive, or none alive).
 *
 * Detection during active playback becomes PENDING: the result is finalized
 * only in the `flush` phase, after the accepted turn reached its
 * authoritative final state (PlaybackSystem hard sync). This guarantees the
 * playback is never cancelled mid-turn and no partial completed-match
 * snapshot is exposed. The latest evaluation before the sync wins, so a
 * team eliminated later in the same turn can turn a pending win into a draw.
 */
export class WinningSystem implements ISystem {
	private pending: { evaluation: LastTeamStandingEvaluation; turn: number } | undefined

	public constructor(private readonly teamCount: number) { }
	public ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		if (ctx.state === GameState.Game_over) return
		const evaluation = evaluateLastTeamStanding(ctx.entities.getEntities(), this.teamCount)
		if (evaluation.status === MatchStatus.Ongoing) return
		if (ctx.state === GameState.Playing) {
			// A terminal outcome is determinable while the turn still plays
			// out. Pend the detection with the turn it occurred in; `flush`
			// finalizes it once the playback sync has applied the
			// authoritative final state.
			this.pending = { evaluation, turn: ctx.currTurn }
			return
		}
		this.finalize(ctx, evaluation, ctx.currTurn)
	}

	/**
	 * Finalizes a pending outcome in the final mutation phase of a tick. Runs
	 * AFTER the PlaybackSystem flush, which transitions the state from
	 * `Playing` to `Playing_done` once the accepted turn reached its
	 * authoritative final state - so a pending outcome is never finalized
	 * mid-playback and no partial completed-match snapshot is exposed.
	 */
	public flush(ctx: IGameContext): void {
		if (this.pending === undefined) return
		if (ctx.state === GameState.Playing) return
		this.finalize(ctx, this.pending.evaluation, this.pending.turn)
		this.pending = undefined
	}

	private finalize(ctx: IGameContext, evaluation: LastTeamStandingEvaluation, turnNumber: number): void {
		const result: MatchResult = evaluation.status === MatchStatus.Winner
			? {
				status: MatchStatus.Winner,
				winnerTeam: evaluation.winnerTeam,
				reason: MatchEndReason.LastTeamStanding,
				turnNumber,
			}
			: {
				status: MatchStatus.Draw,
				winnerTeam: null,
				reason: MatchEndReason.Draw,
				turnNumber,
			}
		// The winner is never stored here: the handler's `MatchResult` is the
		// single authoritative outcome state, shared by the live handler,
		// snapshot restoration, and replay playback.
		ctx.state = GameState.Game_over
		ctx.setMatchResult?.(result)
	}
}
