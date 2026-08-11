import { createAiBattleHandler } from "../src/scenes/LocalMatchSceneRouter.js";
import { GameHandler } from "../src/kore/runtime/Handler.js";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.js";
import { HardAi } from "../src/ai/hardAi.js";
import { HARD_AI_SPECULATIVE_MAX_TICKS } from "../src/ai/hardAi.js";
import { GameState } from "../src/kore/runtime/types.js";
import { PhysicsSystem } from "../src/systems/PhysicsSystem.js";
import { defaultPhysics } from "../src/physics/defaultPhysics.js";

type Profile = {
	seed: number;
	setupMs: number;
	totalMs: number;
	teardownMs: number;
	outerTicks: number;
	allTicks: number;
	decisions: number;
	decisionMs: number;
	fromSettingsMs: number;
	buildMs: number;
	jsonCloneMs: number;
	simulations: number;
	simMs: number;
	simTicks: number;
	physicsTicks: number;
	physicsMs: number;
	collisionChecks: number;
	collisionHits: number;
	collisionMs: number;
	collisionResponseCalls: number;
	collisionResponseMs: number;
	turns: number;
	finalState: string;
	candidateTicks: number[];
	candidateMs: number[];
	candidateCloneMs: number[];
	candidateRestoreMs: number[];
	acceptedTicks: number[];
	acceptedMs: number[];
	budgetHitTerminalMaxSpeed: number[];
};

const profiles = new Map<GameHandler, Profile>();
let activeRoot: GameHandler | undefined;
let activeSimulation = false;
let activeDecision = false;
let allTicks = 0;
let currentPhysicsProfile: Profile | undefined;

const originalTick = GameHandler.prototype.tick;
GameHandler.prototype.tick = function (...args) {
	allTicks++;
	const profile = activeRoot ? profiles.get(activeRoot) : undefined;
	if (profile) profile.allTicks++;
	return originalTick.apply(this, args);
};

const originalSimulate = GameHandler.prototype.simulateTurn;
GameHandler.prototype.simulateTurn = function (...args) {
	const root = activeRoot;
	const profile = root ? profiles.get(root) : undefined;
	const before = allTicks;
	const beforeJson = profile?.jsonCloneMs ?? 0;
	const beforeRestore = profile?.fromSettingsMs ?? 0;
	const previous = activeSimulation;
	activeSimulation = true;
	const start = performance.now();
	let result: any;
	try {
		result = originalSimulate.apply(this, args);
		return result;
	} finally {
		activeSimulation = previous;
		if (profile) {
			const elapsed = performance.now() - start;
			const ticks = allTicks - before;
			profile.simulations++;
			profile.simMs += elapsed;
			profile.simTicks += ticks;
			if (activeDecision) {
				profile.candidateTicks.push(ticks);
				profile.candidateMs.push(elapsed);
				profile.candidateCloneMs.push(profile.jsonCloneMs - beforeJson);
				profile.candidateRestoreMs.push(profile.fromSettingsMs - beforeRestore);
				if (ticks === 1200 && Array.isArray(result?.finalState)) {
					profile.budgetHitTerminalMaxSpeed.push(Math.max(...result.finalState.map((entity: { velocity: { x: number; y: number } }) => Math.hypot(entity.velocity.x, entity.velocity.y))));
				}
			} else {
				profile.acceptedTicks.push(ticks);
				profile.acceptedMs.push(elapsed);
			}
		}
	}
};

const originalDecision = HardAi.prototype.computeTurn;
HardAi.prototype.computeTurn = function (...args) {
	const profile = activeRoot ? profiles.get(activeRoot) : undefined;
	const start = performance.now();
	const previousDecision = activeDecision;
	activeDecision = true;
	try {
		return originalDecision.apply(this, args);
	} finally {
		activeDecision = previousDecision;
		if (profile) {
			profile.decisions++;
			profile.decisionMs += performance.now() - start;
		}
	}
};

const originalFromSettings = GameHandlerBuilder.prototype.fromSettings;
GameHandlerBuilder.prototype.fromSettings = function (...args) {
	const profile = activeRoot ? profiles.get(activeRoot) : undefined;
	const start = performance.now();
	try {
		return originalFromSettings.apply(this, args);
	} finally {
		if (profile) profile.fromSettingsMs += performance.now() - start;
	}
};
const originalBuild = GameHandlerBuilder.prototype.build;
GameHandlerBuilder.prototype.build = function (...args) {
	const profile = activeRoot ? profiles.get(activeRoot) : undefined;
	const start = performance.now();
	try {
		return originalBuild.apply(this, args);
	} finally {
		if (profile) profile.buildMs += performance.now() - start;
	}
};

const originalStringify = JSON.stringify;
const originalParse = JSON.parse;
JSON.stringify = function (...args) {
	const profile = activeRoot && activeSimulation ? profiles.get(activeRoot) : undefined;
	const start = profile ? performance.now() : 0;
	const result = Reflect.apply(originalStringify, JSON, args as any);
	if (profile) profile.jsonCloneMs += performance.now() - start;
	return result;
} as typeof JSON.stringify;
JSON.parse = function (...args) {
	const profile = activeRoot && activeSimulation ? profiles.get(activeRoot) : undefined;
	const start = profile ? performance.now() : 0;
	const result = Reflect.apply(originalParse, JSON, args as any);
	if (profile) profile.jsonCloneMs += performance.now() - start;
	return result;
} as typeof JSON.parse;

const originalPhysicsTick = PhysicsSystem.prototype.ticker;
PhysicsSystem.prototype.ticker = function (...args) {
	const profile = activeRoot ? profiles.get(activeRoot) : undefined;
	const previous = currentPhysicsProfile;
	currentPhysicsProfile = profile;
	const start = performance.now();
	try {
		return originalPhysicsTick.apply(this, args);
	} finally {
		if (profile) {
			profile.physicsTicks++;
			profile.physicsMs += performance.now() - start;
		}
		currentPhysicsProfile = previous;
	}
};

const physics = defaultPhysics.prototype;
const originalCheckCollision = physics.checkCollision;
physics.checkCollision = function (...args) {
	const profile = currentPhysicsProfile;
	const start = performance.now();
	const result = originalCheckCollision.apply(this, args);
	if (profile) {
		profile.collisionChecks++;
		if (result) profile.collisionHits++;
		profile.collisionMs += performance.now() - start;
	}
	return result;
};
const originalHandleCollision = physics.handleCollision;
physics.handleCollision = function (...args) {
	const profile = currentPhysicsProfile;
	const start = performance.now();
	try {
		return originalHandleCollision.apply(this, args);
	} finally {
		if (profile) {
			profile.collisionResponseCalls++;
			profile.collisionResponseMs += performance.now() - start;
		}
	}
};

const seeds = (process.env.AI_PROFILE_SEEDS ?? "1").split(",").map(value => Number(value));
const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);
const percentile = (values: readonly number[], fraction: number): number => {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))]!;
};
for (const seed of seeds) {
	const setupStart = performance.now();
	const handler = createAiBattleHandler("ice-map-v1", seed);
	const profile: Profile = {
		seed, setupMs: performance.now() - setupStart, totalMs: 0, teardownMs: 0,
		outerTicks: 0, allTicks: 0, decisions: 0, decisionMs: 0, fromSettingsMs: 0,
		buildMs: 0, jsonCloneMs: 0, simulations: 0,
		simMs: 0, simTicks: 0, physicsTicks: 0, physicsMs: 0, collisionChecks: 0,
		collisionHits: 0, collisionMs: 0, collisionResponseCalls: 0,
		collisionResponseMs: 0, turns: 0, finalState: "unknown", candidateTicks: [], candidateMs: [],
		candidateCloneMs: [], candidateRestoreMs: [], acceptedTicks: [], acceptedMs: [], budgetHitTerminalMaxSpeed: [],
	};
	profiles.set(handler, profile);
	activeRoot = handler;
	const start = performance.now();
	while (handler.getState() !== GameState.Game_over) {
		handler.tick();
		profile.outerTicks++;
	}
	profile.totalMs = performance.now() - start;
	profile.turns = handler.getTurnNumber();
	profile.finalState = handler.getState();
	const teardownStart = performance.now();
	handler.dispose();
	profile.teardownMs = performance.now() - teardownStart;
	activeRoot = undefined;
	const { candidateTicks, candidateMs, candidateCloneMs, candidateRestoreMs, acceptedTicks, acceptedMs, budgetHitTerminalMaxSpeed, ...summary } = profile;
	console.log(JSON.stringify({
		...summary,
		candidateCount: candidateTicks.length,
		candidateMaxBudgetHits: candidateTicks.filter(ticks => ticks === HARD_AI_SPECULATIVE_MAX_TICKS).length,
		candidateTickTotal: sum(candidateTicks),
		candidateTickMin: Math.min(...candidateTicks),
		candidateTickMedian: percentile(candidateTicks, 0.5),
		candidateTickP95: percentile(candidateTicks, 0.95),
		candidateTickMax: Math.max(...candidateTicks),
		candidateTimeTotalMs: sum(candidateMs),
		candidateCloneTotalMs: sum(candidateCloneMs),
		candidateRestoreTotalMs: sum(candidateRestoreMs),
		acceptedTickTotal: sum(acceptedTicks),
		acceptedTimeTotalMs: sum(acceptedMs),
		budgetHitTerminalMaxSpeedCount: budgetHitTerminalMaxSpeed.length,
		budgetHitTerminalMaxSpeedMin: Math.min(...budgetHitTerminalMaxSpeed),
		budgetHitTerminalMaxSpeedMedian: percentile(budgetHitTerminalMaxSpeed, 0.5),
		budgetHitTerminalMaxSpeedMax: Math.max(...budgetHitTerminalMaxSpeed),
		avgSimulationMs: profile.simMs / Math.max(1, profile.simulations),
		avgSimulationTicks: profile.simTicks / Math.max(1, profile.simulations),
		avgPhysicsTickMs: profile.physicsMs / Math.max(1, profile.physicsTicks),
		candidateMaxSimulationBudgetTicks: HARD_AI_SPECULATIVE_MAX_TICKS,
		authoritativeMaxSimulationBudgetTicks: 1200,
	}));
}
