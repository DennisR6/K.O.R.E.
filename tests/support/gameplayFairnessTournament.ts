import { AiTurnEmitter } from "../../src/ai/aiEmitter.js";
import { HardAi } from "../../src/ai/hardAi.js";
import type { AiSettings } from "../../src/ai/types.js";
import { GameEmitter } from "../../src/emitter/EngineEmitter.js";
import { GameHandler, GameHandlerBuilder } from "../../src/engine/Handler.js";
import { GameState } from "../../src/engine/types.js";
import { MatchStatus } from "../../src/rules/types.js";
import { makeAiArena } from "./aiMatchFuzz.ts";

export type FairnessVariant = "original" | "swapped-sides" | "first-turn-swapped";
export interface FairnessMatch { seed: number; variant: FairnessVariant; firstTeam: number; winnerTeam: number | null; winnerSide: "left" | "right" | null; outcome: "winner" | "draw" | "ongoing"; turns: number; violations: string[]; }
export interface FairnessDistribution { matches: number; leftWins: number; rightWins: number; team0Wins: number; team1Wins: number; draws: number; ongoing: number; }
export interface FairnessTournament { matches: FairnessMatch[]; distributions: Record<FairnessVariant, FairnessDistribution>; warnings: string[]; }

const AI_LIMITS = { maxSimulations: 8, maxAngleSamples: 4, maxForceSamples: 2 };
const MAX_TURNS = 40;
const MAX_TICKS = 1200;

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function build(settings: ReturnType<typeof makeAiArena>): GameHandler { return new GameHandlerBuilder().defaultSystems().fromSettings(settings).build(); }

function settingsFor(seed: number, variant: FairnessVariant) {
	const settings = clone(makeAiArena(seed));
	if (variant === "swapped-sides") {
		const positions = settings.players.map(player => ({ ...player.position }));
		settings.players.forEach((player, index) => { player.position = positions[settings.players.length - index - 1]!; });
	}
	return settings;
}

function sideForTeam(team: number, variant: FairnessVariant): "left" | "right" {
	const leftTeam = variant === "swapped-sides" ? 1 : 0;
	return team === leftTeam ? "left" : "right";
}

function runMatch(seed: number, variant: FairnessVariant): FairnessMatch {
	const settings = settingsFor(seed, variant);
	const handler = build(settings);
	const firstTeam = variant === "first-turn-swapped" ? 1 : 0;
	if (firstTeam !== 0) handler.setActiveTeam(firstTeam);
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, seed);
	const violations: string[] = [];
	let turns = 0;
	while (handler.getState() !== GameState.Game_over && turns < MAX_TURNS) {
		const team = handler.getActiveTeam();
		const ai: AiSettings = { difficulty: "hard", seed: seed * 2 + team, team, decisionLimits: AI_LIMITS };
		if (!new AiTurnEmitter(new HardAi()).executeTurn(handler, ai, emitter)) {
			violations.push(`seed ${seed} ${variant}: AI produced no legal action on turn ${turns}`);
			break;
		}
		let ticks = 0;
		while (handler.getState() === GameState.Playing && ticks < MAX_TICKS) { handler.tick(); ticks++; }
		if (handler.getState() === GameState.Playing) violations.push(`seed ${seed} ${variant}: playback exceeded ${MAX_TICKS} frames`);
		if (handler.getState() === GameState.Playing) break;
		turns++;
	}
	const result = handler.getMatchResult();
	const outcome = handler.getState() !== GameState.Game_over ? "ongoing" : result?.status === MatchStatus.Draw ? "draw" : "winner";
	const winnerTeam = outcome === "winner" && result?.winnerTeam !== undefined ? result.winnerTeam : null;
	return { seed, variant, firstTeam, winnerTeam, winnerSide: winnerTeam === null ? null : sideForTeam(winnerTeam, variant), outcome, turns, violations };
}

function distribution(matches: FairnessMatch[]): FairnessDistribution {
	return {
		matches: matches.length,
		leftWins: matches.filter(match => match.winnerSide === "left").length,
		rightWins: matches.filter(match => match.winnerSide === "right").length,
		team0Wins: matches.filter(match => match.winnerTeam === 0).length,
		team1Wins: matches.filter(match => match.winnerTeam === 1).length,
		draws: matches.filter(match => match.outcome === "draw").length,
		ongoing: matches.filter(match => match.outcome === "ongoing").length,
	};
}

function warnings(distributions: Record<FairnessVariant, FairnessDistribution>): string[] {
	const result: string[] = [];
	for (const [variant, values] of Object.entries(distributions) as [FairnessVariant, FairnessDistribution][]) {
		if (Math.abs(values.leftWins - values.rightWins) > values.matches / 2) result.push(`${variant}: spawn-side win gap`);
		if (Math.abs(values.team0Wins - values.team1Wins) > values.matches / 2) result.push(`${variant}: team-index win gap`);
		if (values.ongoing > 0) result.push(`${variant}: ${values.ongoing} matches reached the safety limit`);
	}
	return result;
}

export function runFairnessTournament(seeds: number[] = Array.from({ length: 8 }, (_, index) => 3100 + index)): FairnessTournament {
	const variants: FairnessVariant[] = ["original", "swapped-sides", "first-turn-swapped"];
	const log = console.log;
	console.log = () => undefined;
	let matches: FairnessMatch[];
	try { matches = variants.flatMap(variant => seeds.map(seed => runMatch(seed, variant))); }
	finally { console.log = log; }
	const distributions = Object.fromEntries(variants.map(variant => [variant, distribution(matches.filter(match => match.variant === variant))])) as Record<FairnessVariant, FairnessDistribution>;
	return { matches, distributions, warnings: warnings(distributions) };
}
