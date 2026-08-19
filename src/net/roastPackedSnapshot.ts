import { binaryBackedTransform, createArenaStorage, decodePackedSnapshot, encodePackedSnapshot, encodePackedSnapshotWithDiagnostics, type BinaryStorage } from "@coffeemakerstudio/roast";
import { korePackedOptions, korePackedSettings, wireToPlayer, effectsFromWire, thresholdsFromWire, type KorePackedStage, type KorePlayerWire } from "./koreBinary.js";
import type { EngineSettings } from "../kore/runtime/types.js";
import type { PlayerSettings } from "../entity/types.js";
import type { EngineWorldSettings } from "@coffeemakerstudio/roast";

const TRANSFORM = "transform.state";
const MOVEMENT = "movement.state";
const PLAYER = "kore.player.state";

type RoastPackedSettings = EngineWorldSettings & { players?: never };

/** Experimental KORE adapter: fixed player position/velocity fields use Roast's packed schemas. */
export function koreSettingsToRoastPacked(settings: EngineSettings): RoastPackedSettings {
	const { players, ...metadata } = JSON.parse(JSON.stringify(settings)) as EngineSettings & { players: PlayerSettings[] };
	return {
		...(metadata as unknown as Omit<EngineWorldSettings, "entities">),
		entities: players.map(player => {
			const { position, velocity, rotation, angularVelocity, effects, numericThresholds, ...rest } = player;
			return {
				id: player.id,
				capabilities: [PLAYER, MOVEMENT, TRANSFORM, "kore.effects.state", "kore.thresholds.state"],
				[TRANSFORM]: { schemaVersion: 1, position, rotation },
				[MOVEMENT]: { schemaVersion: 1, velocity, angularVelocity, enabled: player.isPhysicsEnabled },
				// Keep the optional components in the player fallback so staged
				// payloads remain lossless until their dedicated schema is enabled.
				[PLAYER]: { ...rest, effects, numericThresholds: numericThresholds ?? [] },
				"kore.effects.state": effects,
				"kore.thresholds.state": numericThresholds ?? [],
			};
		}),
		structures: [],
		effects: [],
		counters: settings.counters ?? [],
	} as unknown as RoastPackedSettings;
}

/** Restores the KORE settings contract from a Roast packed adapter frame. */
export function roastPackedToKoreSettings(bytes: Uint8Array, stage: KorePackedStage = 3): EngineSettings {
	const decoded = decodePackedSnapshot(bytes, { registry: korePackedOptions().registry }).settings as EngineWorldSettings & { entities: Record<string, any>[] };
	const entities = decoded.entities as Record<string, any>[];
	const players = entities.map(entity => {
		const transform = entity[TRANSFORM];
		const movement = entity[MOVEMENT];
		const rest = entity[PLAYER] ?? {};
		const effects = stage >= 2 ? effectsFromWire(entity["kore.effects.state"] ?? []) : (rest as any).remainder ? JSON.parse((rest as any).remainder).effects ?? [] : [];
		const numericThresholds = stage >= 3 ? thresholdsFromWire(entity["kore.thresholds.state"] ?? []) : (rest as any).remainder ? JSON.parse((rest as any).remainder).numericThresholds ?? [] : [];
		return {
			...(rest as KorePlayerWire).remainder ? wireToPlayer(rest as KorePlayerWire, { position: transform.position, velocity: movement.velocity, rotation: transform.rotation, angularVelocity: movement.angularVelocity }, effects, numericThresholds) : rest,
			id: entity.id,
			position: transform.position,
			velocity: movement.velocity,
			rotation: transform.rotation,
			angularVelocity: movement.angularVelocity,
			isPhysicsEnabled: movement.enabled,
		} as PlayerSettings;
	});
	const { entities: _entities, ...metadata } = decoded;
	return { ...metadata, players } as unknown as EngineSettings;
}

export function encodeKorePackedSnapshot(settings: EngineSettings, storage?: BinaryStorage, stage: KorePackedStage = 3): Uint8Array {
	return encodePackedSnapshot(korePackedSettings(koreSettingsToRoastPacked(settings), stage), storage, korePackedOptions(stage));
}

export function decodeKorePackedSnapshot(bytes: Uint8Array, stage: KorePackedStage = 3): EngineSettings { return roastPackedToKoreSettings(bytes, stage); }
export function diagnoseKorePackedSnapshot(settings: EngineSettings, stage: KorePackedStage = 3) { return encodePackedSnapshotWithDiagnostics(korePackedSettings(koreSettingsToRoastPacked(settings), stage), korePackedOptions(stage)); }

/** Exercises the public Roast binary-backed Transform API with a KORE player transform. */
export function binaryBackedKoreTransform(settings: EngineSettings, playerId = settings.players[0]?.id) {
	const player = settings.players.find(candidate => candidate.id === playerId);
	if (!player) throw new Error(`KORE player not found: ${playerId}`);
	return binaryBackedTransform({ schemaVersion: 1, position: player.position, rotation: player.rotation });
}

export function encodeKorePackedSnapshotWithArena(settings: EngineSettings, arena: { alloc(bytes: Uint8Array): unknown; read(location: unknown): Uint8Array | null }): Uint8Array {
	return encodeKorePackedSnapshot(settings, createArenaStorage(arena));
}
