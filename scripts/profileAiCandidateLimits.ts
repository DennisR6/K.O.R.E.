import { createAiBattleHandler } from "../src/scenes/LocalMatchSceneRouter.js";
import { HardAi } from "../src/ai/hardAi.js";
import type { AiSettings } from "../src/ai/types.js";
import { GameHandler, GameHandlerBuilder } from "../src/kore/runtime/Handler.js";
import { GameState } from "../src/kore/runtime/types.js";
import { GameEmitter } from "../src/emitter/EngineEmitter.js";
import { WinningSystem } from "../src/systems/WinningSystem.js";

const LIMITS = [5, 10, 15, 20, 25, 30] as const;
const MAX_DECISIONS = Number(process.env.AI_LIMIT_DECISIONS ?? 12);
const SEEDS = (process.env.AI_LIMIT_SEEDS ?? "1,2,3").split(",").map(Number);

type Counter = { simulations: number; speculativeTicks: number; elapsedMs: number };
type Result = { action: string | undefined; counter: Counter };

const originalSimulateTurn = GameHandler.prototype.simulateTurn;
let activeCounter: Counter | undefined;
GameHandler.prototype.simulateTurn = function (...args) {
	const start = performance.now();
	const result = originalSimulateTurn.apply(this, args);
	if (activeCounter) {
		activeCounter.simulations++;
		activeCounter.speculativeTicks += result.durationFrames;
		activeCounter.elapsedMs += performance.now() - start;
	}
	return result;
};

function actionKey(action: { actorId: string; angle: number; power: number } | undefined): string | undefined {
	return action ? `${action.actorId}:${action.angle}:${action.power}` : undefined;
}

function settingsFor(seed: number, team: number): AiSettings {
	return { difficulty: "hard", seed: team === 0 ? seed * 2 : seed * 2 + 1, team, decisionLimits: { maxSimulations: 30, maxAngleSamples: 10, maxForceSamples: 3 } };
}

function compute(handler: GameHandler, settings: AiSettings, maxSimulations: number): Result {
	const counter: Counter = { simulations: 0, speculativeTicks: 0, elapsedMs: 0 };
	activeCounter = counter;
	const decision = new HardAi().computeTurn(handler, { ...settings, decisionLimits: { ...settings.decisionLimits!, maxSimulations } });
	activeCounter = undefined;
	return { action: actionKey(decision?.shot), counter };
}

function percentile(values: readonly number[], fraction: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))]!;
}

const reports = LIMITS.map(limit => ({ limit, decisions: 0, parity: 0, simulations: 0, speculativeTicks: 0, elapsedMs: [] as number[] }));
let sampled = 0;

for (const seed of SEEDS) {
	const source = createAiBattleHandler("ice-map-v1", seed);
	const settings = source.toSettings();
	settings.systems = (settings.systems ?? []).filter(system => system.systemId !== "ai.battle" && system.systemId !== "ai.opponent");
	settings.systemOrder = (settings.systemOrder ?? []).filter(id => id !== "ai.battle" && id !== "ai.opponent");
	const handler = new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(settings).build();
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, seed);
	let guard = 0;
	while (handler.getState() !== GameState.Game_over && sampled < SEEDS.length * MAX_DECISIONS && guard < 400_000) {
		if (handler.getRuleState().phase === "item") { emitter.skipPhase(); continue; }
		if (handler.getState() !== GameState.Your_turn) { handler.tick(); continue; }
		const team = handler.getActiveTeam();
		const aiSettings = settingsFor(seed, team);
		const decisions = LIMITS.map(limit => compute(handler, aiSettings, limit));
		const reference = decisions[decisions.length - 1]!;
		for (let index = 0; index < LIMITS.length; index++) {
			const report = reports[index]!;
			const current = decisions[index]!;
			report.decisions++;
			if (current.action === reference.action) report.parity++;
			report.simulations += current.counter.simulations;
			report.speculativeTicks += current.counter.speculativeTicks;
			report.elapsedMs.push(current.counter.elapsedMs);
		}
		sampled++;
		const shot = reference.action?.split(":");
		if (!shot) break;
		emitter.sendShot(shot[0]!, Number(shot[1]), Number(shot[2]));
		while (handler.getState() === GameState.Playing) handler.tick();
		guard++;
	}
	handler.dispose();
}

console.log(JSON.stringify({
	seeds: SEEDS,
	decisionsSampled: sampled,
	referenceLimit: 30,
	results: reports.map(report => ({
		maxSimulations: report.limit,
		selectedActionParity: `${report.parity}/${report.decisions}`,
		parityRate: report.decisions === 0 ? 0 : report.parity / report.decisions,
		candidateSimulations: report.simulations,
		speculativeTicks: report.speculativeTicks,
		elapsedMs: { min: Math.min(...report.elapsedMs), median: percentile(report.elapsedMs, 0.5), p95: percentile(report.elapsedMs, 0.95), max: Math.max(...report.elapsedMs) },
	})),
}, null, 2));
