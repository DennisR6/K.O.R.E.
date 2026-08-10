import { AiTurnEmitter } from "../../src/ai/aiEmitter.js";
import { EasyAi } from "../../src/ai/easyAi.js";
import { HardAi } from "../../src/ai/hardAi.js";
import { MediumAi } from "../../src/ai/mediumAi.js";
import type { AiDifficulty, AiSettings } from "../../src/ai/types.js";
import { GameEmitter } from "../../src/emitter/EngineEmitter.js";
import { GameHandler, GameHandlerBuilder } from "../../src/engine/Handler.js";
import { GameState } from "../../src/engine/types.js";
import { loadMapDocument } from "../../src/contracts/documents.js";
import { GAMEPLAY_CONTENT_REGISTRY } from "../../src/content/gameplayContentRegistry.js";
import { createOfficialItemLoader } from "../../src/item/officialItems.js";
import { ReplayPlayer } from "../../src/replay/player.js";
import { RulePhase, type GameModeSettings, type ItemEconomySettings } from "../../src/rules/types.js";
import { createCanonicalPlayableMatchSettings } from "../../src/settings/canonicalPlayableMatch.js";
import { createCueClashMap } from "../../src/settings/cueClashMap.js";
import { createDefaultGameSettings, type GameSettings } from "../../src/settings/settings.js";
import { createFrostbiteArenaMap } from "../../src/settings/frostbiteArenaMap.js";
import { createMagmaCradleMap } from "../../src/settings/magmaCradleMap.js";
import { WinningSystem } from "../../src/systems/WinningSystem.js";

export type GameplayEconomy = "disabled" | "fixed-loadout" | "map-pickup" | "seeded-draw";
export type AiPair = `${AiDifficulty}-vs-${AiDifficulty}`;

export interface GameplayQualificationCase {
	mapId: string;
	modeId: string;
	figuresPerTeam: number;
	aiPair: AiPair;
	economy: GameplayEconomy;
	seed: number;
}

export interface GameplayQualificationResult {
	case: GameplayQualificationCase;
	registryStatus: "qualified" | "blocked-from-selection";
	started: boolean;
	actionAccepted: boolean;
	turns: number;
	outcome: "winner" | "draw" | "ongoing";
	deterministic: boolean;
	replayOk: boolean;
	restoreOk: boolean;
	violations: string[];
	softlock: SoftlockAnalysis;
}

export interface ProgressFingerprint {
	turnNumber: number;
	activeTeam: number;
	phase: string;
	entityStateHash: string;
	playbackFramesRemaining: number;
	matchStatus: string;
}

export interface SoftlockObservation {
	fingerprint: ProgressFingerprint;
	acceptedAction?: boolean;
	stateChanged?: boolean;
	aiActionAvailable?: boolean;
}

export interface SoftlockAnalysis {
	detected: boolean;
	reason?: string;
	repeatedFingerprintCount: number;
	fingerprintCount: number;
}

export const SOFTLOCK_LIMITS = {
	repeatedFingerprint: 4,
	noActionObservations: 4,
	noOpActions: 3,
	playbackStalls: 3,
	turnStalls: 4,
	phaseStalls: 4,
} as const;

const WORLD = { x: 800, y: 450 };
const SEEDS = [1503, 1504];
const AI_DIFFICULTIES: AiDifficulty[] = ["easy", "medium", "hard"];
const AI_PAIRS: AiPair[] = AI_DIFFICULTIES.flatMap(first => AI_DIFFICULTIES.map(second => `${first}-vs-${second}` as AiPair));
const ECONOMIES: GameplayEconomy[] = ["disabled", "fixed-loadout", "map-pickup", "seeded-draw"];
const AI_LIMITS = { maxSimulations: 1, maxAngleSamples: 1, maxForceSamples: 1 };

const MAP_DOCUMENTS = {
	"cue-clash": createCueClashMap(WORLD),
	"frostbite-arena": createFrostbiteArenaMap(WORLD),
	"magma-cradle": createMagmaCradleMap(WORLD),
} as const;
const OFFICIAL_ITEMS = createOfficialItemLoader().getAll();
const mapFactories = {
	"ice-map-v1": (template: GameSettings) => template,
	"cue-clash": (template: GameSettings) => loadMapDocument(MAP_DOCUMENTS["cue-clash"], template),
	"frostbite-arena": (template: GameSettings) => loadMapDocument(MAP_DOCUMENTS["frostbite-arena"], template),
	"magma-cradle": (template: GameSettings) => loadMapDocument(MAP_DOCUMENTS["magma-cradle"], template),
} as const;

const aiFactories = { easy: EasyAi, medium: MediumAi, hard: HardAi } as const;

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
	}
	return JSON.stringify(value);
}

export function progressFingerprint(handler: GameHandler): ProgressFingerprint {
	const snapshot = handler.toSettings();
	return {
		turnNumber: handler.getTurnNumber(),
		activeTeam: handler.getActiveTeam(),
		phase: handler.getRuleState().phase,
		entityStateHash: stableJson(snapshot.players),
		playbackFramesRemaining: handler.getPlaybackFramesRemaining(),
		matchStatus: handler.getMatchResult()?.status ?? "ongoing",
	};
}

function fingerprintKey(fingerprint: ProgressFingerprint): string { return stableJson(fingerprint); }

export function detectSoftlock(observations: SoftlockObservation[], limits = SOFTLOCK_LIMITS): SoftlockAnalysis {
	const counts = new Map<string, number>();
	let repeatedFingerprintCount = 0;
	let noActionCount = 0;
	let noOpActionCount = 0;
	let playbackStallCount = 0;
	let turnStallCount = 0;
	let phaseStallCount = 0;
	let previous: SoftlockObservation | undefined;
	for (const observation of observations) {
		const key = fingerprintKey(observation.fingerprint);
		const count = (counts.get(key) ?? 0) + 1;
		counts.set(key, count);
		repeatedFingerprintCount = Math.max(repeatedFingerprintCount, count);
		if (count > limits.repeatedFingerprint) return { detected: true, reason: "identical progress fingerprint repeated beyond limit", repeatedFingerprintCount, fingerprintCount: observations.length };
		noActionCount = observation.aiActionAvailable === false ? noActionCount + 1 : 0;
		if (noActionCount >= limits.noActionObservations) return { detected: true, reason: "all AI decisions returned no action beyond limit", repeatedFingerprintCount, fingerprintCount: observations.length };
		noOpActionCount = observation.acceptedAction && observation.stateChanged === false ? noOpActionCount + 1 : 0;
		if (noOpActionCount >= limits.noOpActions) return { detected: true, reason: "accepted actions did not change state beyond limit", repeatedFingerprintCount, fingerprintCount: observations.length };
		if (previous && observation.fingerprint.playbackFramesRemaining > 0 && observation.fingerprint.playbackFramesRemaining >= previous.fingerprint.playbackFramesRemaining) playbackStallCount++;
		else playbackStallCount = 0;
		if (playbackStallCount >= limits.playbackStalls) return { detected: true, reason: "playback countdown did not decrease beyond limit", repeatedFingerprintCount, fingerprintCount: observations.length };
		if (previous?.acceptedAction && observation.acceptedAction && observation.fingerprint.turnNumber === previous.fingerprint.turnNumber) turnStallCount++;
		else turnStallCount = 0;
		if (turnStallCount >= limits.turnStalls) return { detected: true, reason: "turn number did not advance beyond limit", repeatedFingerprintCount, fingerprintCount: observations.length };
		if (previous?.acceptedAction && observation.acceptedAction && observation.fingerprint.phase === previous.fingerprint.phase) phaseStallCount++;
		else phaseStallCount = 0;
		if (phaseStallCount >= limits.phaseStalls) return { detected: true, reason: "rule phase did not advance beyond limit", repeatedFingerprintCount, fingerprintCount: observations.length };
		previous = observation;
	}
	return { detected: false, repeatedFingerprintCount, fingerprintCount: observations.length };
}

function quiet<T>(callback: () => T): T {
	const log = console.log;
	console.log = () => undefined;
	try { return callback(); } finally { console.log = log; }
}

export function gameplayMatrixCases(): GameplayQualificationCase[] {
	const cases: GameplayQualificationCase[] = [];
	for (const map of GAMEPLAY_CONTENT_REGISTRY.maps) {
		for (const mode of GAMEPLAY_CONTENT_REGISTRY.modes) {
			for (const figuresPerTeam of mode.figuresPerTeam) {
				for (const aiPair of AI_PAIRS) for (const economy of ECONOMIES) for (const seed of SEEDS) {
					cases.push({ mapId: map.id, modeId: mode.id, figuresPerTeam, aiPair, economy, seed });
				}
			}
		}
	}
	return cases;
}

function makeEconomy(kind: GameplayEconomy, seed: number, itemId: string): ItemEconomySettings {
	if (kind === "fixed-loadout") return {
		fixedLoadouts: [0, 1].map(team => ({ team, items: [{ itemId, uses: 1 }] })),
		mapPickups: [],
	};
	if (kind === "map-pickup") return {
		fixedLoadouts: [],
		mapPickups: [{ itemId, spawnRegion: { x: 0, y: 0, w: 800, h: 450 }, activationType: "proximity", maxPickupsPerTurn: 1 }],
	};
	if (kind === "seeded-draw") return {
		fixedLoadouts: [],
		mapPickups: [],
		randomDraw: { seed, itemIds: [itemId], drawsPerTurn: 1 },
	};
	return { fixedLoadouts: [], mapPickups: [] };
}

function makeMode(id: string, economy: ItemEconomySettings): GameModeSettings {
	return id === "local-ice-duel-v1"
		? { id, phases: [RulePhase.Item, RulePhase.Physics], maxItemsPerTurn: 1, winCondition: "last-team-standing", itemEconomy: economy }
		: { id, phases: [RulePhase.Physics], maxItemsPerTurn: 0, winCondition: "last-team-standing", itemEconomy: economy };
}

function makeSettings(testCase: GameplayQualificationCase): GameSettings {
	const base = testCase.mapId === "ice-map-v1" && testCase.modeId === "local-ice-duel-v1" && testCase.figuresPerTeam === 1
		? createCanonicalPlayableMatchSettings()
		: createDefaultGameSettings(2, testCase.figuresPerTeam);
	const settings = clone(mapFactories[testCase.mapId as keyof typeof mapFactories](base));
	settings.id = `00000000-0000-4000-8000-${String(testCase.seed).padStart(12, "0")}`;
	settings.players.forEach((player, index) => { player.id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`; });
	settings.items = clone(OFFICIAL_ITEMS);
	settings.gameMode = makeMode(testCase.modeId, makeEconomy(testCase.economy, testCase.seed, "power-dash"));
	settings.ai = { difficulty: testCase.aiPair.split("-vs-")[1] as AiDifficulty, seed: testCase.seed, team: 1 };
	return settings;
}

function build(settings: GameSettings): GameHandler {
	return new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(settings).build();
}

function executeAction(handler: GameHandler, emitter: GameEmitter, testCase: GameplayQualificationCase): boolean {
	if (handler.getRuleState().phase === RulePhase.Item) emitter.skipPhase();
	const [first, second] = testCase.aiPair.split("-vs-") as [AiDifficulty, AiDifficulty];
	const difficulty = handler.getActiveTeam() === 0 ? first : second;
	const producer = new aiFactories[difficulty]();
	const ai: AiSettings = { difficulty, seed: testCase.seed + handler.getActiveTeam(), team: handler.getActiveTeam(), decisionLimits: AI_LIMITS };
	return new AiTurnEmitter(producer).executeTurn(handler, ai, emitter);
}

function settle(handler: GameHandler): void {
	let ticks = 0;
	while (handler.getState() === GameState.Playing && ticks < 1200) { handler.tick(); ticks++; }
	if (handler.getState() === GameState.Playing) throw new Error("playback exceeded the 1,200-frame qualification bound");
}

function outcome(handler: GameHandler): "winner" | "draw" | "ongoing" {
	if (handler.getState() !== GameState.Game_over) return "ongoing";
	return handler.getMatchResult()?.status === "draw" ? "draw" : "winner";
}

function runOnce(testCase: GameplayQualificationCase): { snapshot: ReturnType<GameHandler["toSettings"]>; replay: ReturnType<GameEmitter["recorder"]["getReplay"]>; actionAccepted: boolean; turns: number; outcome: "winner" | "draw" | "ongoing"; replayOk: boolean; restoreOk: boolean; violations: string[]; softlock: SoftlockAnalysis } {
	const violations: string[] = [];
	const settings = makeSettings(testCase);
	const handler = build(settings);
	const emitter = new GameEmitter(handler, settings.gameMode, 2, testCase.seed);
	const before = progressFingerprint(handler);
	const actionAccepted = quiet(() => executeAction(handler, emitter, testCase));
	if (actionAccepted) settle(handler);
	else violations.push("AI did not produce a legal first action");
	const after = progressFingerprint(handler);
	const softlock = detectSoftlock([
		{ fingerprint: before, acceptedAction: actionAccepted, stateChanged: before.entityStateHash !== after.entityStateHash, aiActionAvailable: actionAccepted },
		{ fingerprint: after, aiActionAvailable: actionAccepted },
	]);
	if (softlock.detected) violations.push(`softlock: ${softlock.reason}`);
	const snapshot = handler.toSettings();
	const restored = build(snapshot);
	const restoreOk = JSON.stringify(restored.toSettings()) === JSON.stringify(snapshot);
	if (!restoreOk) violations.push("engine snapshot did not restore identically");
	let replayOk = false;
	try {
		const replay = new ReplayPlayer(emitter.recorder.getReplay());
		quiet(() => replay.playAll());
		replayOk = JSON.stringify(replay.getHandler().toSettings()) === JSON.stringify(snapshot);
	} catch (error) { violations.push(`replay failed: ${error instanceof Error ? error.message : String(error)}`); }
	if (!replayOk) violations.push("replay did not reproduce the live snapshot");
	return { snapshot, replay: emitter.recorder.getReplay(), actionAccepted, turns: handler.getTurnNumber(), outcome: outcome(handler), replayOk, restoreOk, violations, softlock };
}

export function qualifyGameplayCase(testCase: GameplayQualificationCase): GameplayQualificationResult {
	const registryStatus = GAMEPLAY_CONTENT_REGISTRY.maps.find(map => map.id === testCase.mapId)?.status === "qualified" && testCase.modeId === "local-ice-duel-v1"
		? "qualified" : "blocked-from-selection";
	try {
		const first = runOnce(testCase);
		const second = runOnce(testCase);
		const deterministic = JSON.stringify(first.snapshot) === JSON.stringify(second.snapshot);
		const violations = [...first.violations];
		if (!deterministic) violations.push("duplicate seeded run diverged");
		return { case: testCase, registryStatus, started: true, actionAccepted: first.actionAccepted, turns: first.turns, outcome: first.outcome, deterministic, replayOk: first.replayOk, restoreOk: first.restoreOk, violations, softlock: first.softlock };
	} catch (error) {
		return { case: testCase, registryStatus, started: false, actionAccepted: false, turns: 0, outcome: "ongoing", deterministic: false, replayOk: false, restoreOk: false, violations: [error instanceof Error ? error.message : String(error)], softlock: { detected: false, repeatedFingerprintCount: 0, fingerprintCount: 0 } };
	}
}

export function qualifyGameplayMatrix(): GameplayQualificationResult[] {
	return gameplayMatrixCases().map(qualifyGameplayCase);
}
