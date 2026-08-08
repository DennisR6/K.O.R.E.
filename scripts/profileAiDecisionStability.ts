import { createAiBattleHandler } from "../src/scenes/LocalMatchSceneRouter.js";
import { AiBattleSystem } from "../src/ai/AiBattleSystem.js";
import { GameState } from "../src/engine/types.js";
import { RulePhase } from "../src/rules/types.js";
import { SeededRandom } from "../src/utils/random.js";
import { AI_BATTLE_LIMITS } from "../src/scenes/matchPipeline.js";
import { HardAi } from "../src/ai/hardAi.js";
import type { AiSettings } from "../src/ai/types.js";
import type { GameHandler } from "../src/engine/Handler.js";
import { GameHandlerBuilder } from "../src/engine/Handler.js";

const HORIZONS = [100, 200, 300, 400, 500, 600, 800, 1000, 1200] as const;
const MAX_HORIZON = HORIZONS[HORIZONS.length - 1];
type Candidate = { actorId: string; angle: number; power: number; aimedAtEnemy: boolean };
type HorizonResult = { score: number; candidate: Candidate; runnerUpScore: number };
type DecisionReport = {
	index: number;
	team: number;
	candidateCount: number;
	selected: Record<string, string>;
	scores: Record<string, { selected: number; runnerUp: number }>;
	tickCounts: number[];
	firstStableHorizon: number | null;
	productionSelection?: string;
};

function settingsFor(handler: GameHandler, team: number, seed: number): AiSettings {
	return { difficulty: "hard", seed: team === 0 ? seed * 2 : seed * 2 + 1, team, decisionLimits: AI_BATTLE_LIMITS };
}

function candidatesFor(handler: GameHandler, aiSettings: AiSettings): Candidate[] {
	const entities = handler.getEntityManager().getEntities();
	const actors = entities.filter(entity => !entity.isDead() && entity.getTeam().includes(aiSettings.team) && handler.isActorEligibleForAction(entity.getId()));
	const enemies = entities.filter(entity => !entity.isDead() && !entity.getTeam().includes(aiSettings.team));
	const random = new SeededRandom(aiSettings.seed);
	const angleOffset = random.nextInt(360);
	const forceSamples = [4, 7, 10].slice(0, aiSettings.decisionLimits?.maxForceSamples ?? 3);
	const maxAngles = aiSettings.decisionLimits?.maxAngleSamples ?? 12;
	const maxSimulations = aiSettings.decisionLimits?.maxSimulations ?? 36;
	const result: Candidate[] = [];
	for (const actor of actors) {
		if (result.length >= maxSimulations) break;
		const actorPosition = actor.getPos();
		const angles: { angle: number; aimedAtEnemy: boolean }[] = [];
		for (const enemy of enemies) {
			const enemyPosition = enemy.getPos();
			let angle = Math.atan2(enemyPosition.y - actorPosition.y, enemyPosition.x - actorPosition.x) * (180 / Math.PI);
			if (angle < 0) angle += 360;
			angles.push({ angle: Math.round(angle) % 360, aimedAtEnemy: true });
		}
		const angleStep = 360 / Math.max(1, maxAngles);
		for (let index = 0; index < maxAngles; index++) angles.push({ angle: Math.round((index * angleStep + angleOffset) % 360) % 360, aimedAtEnemy: false });
		for (const angle of angles) {
			if (result.length >= maxSimulations) break;
			for (const power of forceSamples) {
				if (result.length >= maxSimulations) break;
				result.push({ actorId: actor.getId(), angle: angle.angle, power, aimedAtEnemy: angle.aimedAtEnemy });
			}
		}
	}
	return result;
}

function simulateCandidate(handler: GameHandler, candidate: Candidate): { scores: Map<number, number>; ticks: number } {
	const settings = JSON.parse(JSON.stringify(handler.toSettings()));
	settings.systems = settings.systems.filter((system: { systemId: string }) => system.systemId !== "ai.battle" && system.systemId !== "ai.opponent");
	settings.systemOrder = settings.systemOrder.filter((id: string) => id !== "ai.battle" && id !== "ai.opponent");
	// Use the same runtime construction path as GameHandler.simulateTurn.
	const runtime = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	runtime.applyRawTurn(candidate);
	(runtime as any).resolvingTurn = true;
	const actor = runtime.getEntityManager().getEntityById(candidate.actorId);
	if (actor) (runtime as any).applyTemporalModifiers(actor);
	const scores = new Map<number, number>();
	let ticks = 0;
	for (let frame = 1; frame <= MAX_HORIZON; frame++) {
		if ((runtime as any).physicsStrategy.isStatic(runtime.getEntityManager())) break;
		runtime.tick();
		ticks++;
		if ((HORIZONS as readonly number[]).includes(frame)) scores.set(frame, score(runtime, candidate));
	}
	(runtime as any).resolvingTurn = false;
	for (const horizon of HORIZONS) if (!scores.has(horizon)) scores.set(horizon, score(runtime, candidate));
	return { scores, ticks };
}

function score(handler: GameHandler, candidate: Candidate): number {
	let value = 0;
	for (const entity of handler.getEntityManager().getEntities()) {
		if (entity.getTeam().includes(candidateActorTeam(handler, candidate.actorId))) {
			if (!entity.physicsEnabled() || !entity.drawingEnabled()) value -= 10000;
		} else if (!entity.physicsEnabled() || !entity.drawingEnabled()) value += 5000;
	}
	return value;
}

function candidateActorTeam(handler: GameHandler, actorId: string): number {
	return handler.getEntityManager().getEntityById(actorId)?.getTeam()[0] ?? 0;
}

function select(results: readonly HorizonResult[], aiSettings: AiSettings): HorizonResult {
	let bestScore = -Infinity;
	let best: Candidate[] = [];
	for (const result of results) {
		if (result.score > bestScore) { bestScore = result.score; best = []; }
		if (result.score === bestScore) best.push(result.candidate);
	}
	let tieGroup = best;
	if (bestScore === 0) {
		const aimed = tieGroup.filter(candidate => candidate.aimedAtEnemy);
		if (aimed.length > 0) tieGroup = aimed;
	}
	const random = new SeededRandom(aiSettings.seed);
	random.nextInt(360);
	const candidate = tieGroup[random.nextInt(tieGroup.length)]!;
	const runnerUpScore = results.map(result => result.score).filter(scoreValue => scoreValue < bestScore).sort((a, b) => b - a)[0] ?? bestScore;
	return { score: bestScore, candidate, runnerUpScore };
}

function key(candidate: Candidate): string { return `${candidate.actorId}:${candidate.angle}:${candidate.power}`; }

function stableHorizon(selected: readonly string[]): number | null {
	const reference = selected[selected.length - 1];
	for (let index = 0; index < selected.length; index++) if (selected.slice(index).every(value => value === reference)) return HORIZONS[index]!;
	return null;
}

const seed = Number(process.env.AI_STABILITY_SEED ?? 1);
const handler = createAiBattleHandler("ice-map-v1", seed);
const battleSystem = handler.getSystems().find(system => system instanceof AiBattleSystem) as AiBattleSystem;
const emitter = battleSystem.getEmitter()!;
const reports: DecisionReport[] = [];
const productionParity: boolean[] = [];
let decisionIndex = 0;
let speculativeTicksByHorizon = new Map<number, number>(HORIZONS.map(horizon => [horizon, 0]));

while (handler.getState() !== GameState.Game_over) {
	const rule = handler.getRuleState();
	if (rule.phase === RulePhase.Item) { emitter.skipPhase?.(); continue; }
	if (rule.phase !== RulePhase.Physics || handler.getState() !== GameState.Your_turn) { handler.tick(); continue; }
	const team = handler.getActiveTeam();
	const aiSettings = settingsFor(handler, team, seed);
	const productionDecision = new HardAi().computeTurn(handler, aiSettings);
	const candidates = candidatesFor(handler, aiSettings);
	const horizonScores = new Map<number, HorizonResult[]>();
	const tickCounts: number[] = [];
	for (const candidate of candidates) {
		const simulation = simulateCandidate(handler, candidate);
		tickCounts.push(simulation.ticks);
		for (const horizon of HORIZONS) {
			const list = horizonScores.get(horizon) ?? [];
			list.push({ score: simulation.scores.get(horizon)!, candidate, runnerUpScore: 0 });
			horizonScores.set(horizon, list);
			speculativeTicksByHorizon.set(horizon, speculativeTicksByHorizon.get(horizon)! + Math.min(simulation.ticks, horizon));
		}
	}
	const selected: Record<string, string> = {};
	const scores: Record<string, { selected: number; runnerUp: number }> = {};
	for (const horizon of HORIZONS) {
		const list = horizonScores.get(horizon)!;
		const selectedResult = select(list, aiSettings);
		selected[String(horizon)] = key(selectedResult.candidate);
		scores[String(horizon)] = { selected: selectedResult.score, runnerUp: selectedResult.runnerUpScore };
	}
	reports.push({ index: decisionIndex++, team, candidateCount: candidates.length, selected, scores, tickCounts, firstStableHorizon: stableHorizon(HORIZONS.map(horizon => selected[String(horizon)]!)) });
	const reference = reports[reports.length - 1]!.selected[String(MAX_HORIZON)]!;
	const accepted = candidates.find(candidate => key(candidate) === reference)!;
	const productionSelection = productionDecision?.shot ? key(productionDecision.shot as Candidate) : undefined;
	productionParity.push(productionSelection === reference);
	reports[reports.length - 1]!.productionSelection = productionSelection;
	emitter.sendShot(accepted.actorId, accepted.angle, accepted.power);
}

const agreement = Object.fromEntries(HORIZONS.map(horizon => [horizon, reports.filter(report => report.selected[String(horizon)] === report.selected[String(MAX_HORIZON)]).length]));
const stable = reports.map(report => report.firstStableHorizon).filter((value): value is number => value !== null).sort((a, b) => a - b);
const percentile = (values: readonly number[], fraction: number): number => values.length === 0 ? 0 : values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))]!;
console.log(JSON.stringify({ seed, map: "ice-map-v1", horizons: HORIZONS, decisions: reports.length, candidatesPerDecision: reports.map(report => report.candidateCount), productionParity, productionParityCount: productionParity.filter(Boolean).length, agreement, stableHorizon: { min: stable[0] ?? null, median: percentile(stable, 0.5), p95: percentile(stable, 0.95), max: stable[stable.length - 1] ?? null }, speculativeTicksByHorizon: Object.fromEntries(speculativeTicksByHorizon), reports }, null, 2));
