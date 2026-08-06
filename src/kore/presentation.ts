/** Stable KORE semantic presentation event vocabulary. Generic presentation remains string-based. */
export enum KorePresentationEvent {
	ShotStarted = "kore.presentation.shot-started",
	Collision = "kore.presentation.collision",
	PlayerEliminated = "kore.presentation.player-eliminated",
	MatchFinished = "kore.presentation.match-finished",
	ItemUsed = "kore.presentation.item-used",
}

const VALUES = new Set<string>(Object.values(KorePresentationEvent));
export function isKorePresentationEvent(value: string): value is KorePresentationEvent { return VALUES.has(value); }
