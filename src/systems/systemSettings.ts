import { defaultPhysics } from "../physics/defaultPhysics.js";
import { AiBattleSystem } from "../ai/AiBattleSystem.js";
import { AiOpponentSystem } from "../ai/AiOpponentSystem.js";
import { BoundarySystem } from "./BoundarySystem.js";
import { EmitterSystem } from "./Emitter.js";
import { EffectSystem } from "./EffectSystem.js";
import { GameStateManager } from "./GameStateManager.js";
import { MatchStateIndicator } from "./MatchStateIndicator.js";
import { PlaybackSystem } from "./PlayBackSystem.js";
import { PhysicsSystem } from "./PhysicsSystem.js";
import { MovementSystem } from "./MovementSystem.js";
import { RoundPlayerSystem } from "./RoundSystem.js";
import { Simulator } from "./Simulator.js";
import { WinningSystem } from "./WinningSystem.js";
import { UiSystem } from "./UiSystem.js";
import { EnvironmentalSystem } from "./EnvironmentalSystem.js";
import { CounterSystem } from "./CounterSystem.js";
import { TransformSystem } from "./TransformSystem.js";
import { ParticipationSystem } from "./ParticipationSystem.js";
import { validateEnvironmentalMechanics, type EnvironmentalMechanic, type EnvironmentalState } from "../environment/environmental.js";
import type { ISerializableSystem, SystemSettings } from "./types.js";

/** Data-only, allowlisted snapshot boundary for engine-owned systems. */
export function validateSystemSettings(value: unknown): asserts value is SystemSettings {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed system settings")
	const settings = value as Record<string, unknown>
	if (typeof settings.systemId !== "string" || !/^[a-z0-9.-]{1,80}$/.test(settings.systemId)) throw new Error("Malformed system ID")
	if (settings.schemaVersion !== 1 || !settings.state || typeof settings.state !== "object" || Array.isArray(settings.state)) throw new Error("Unsupported or malformed system settings")
	const check = (entry: unknown): void => {
		if (entry === null || typeof entry === "boolean" || typeof entry === "string") return
		if (typeof entry === "number") { if (!Number.isFinite(entry)) throw new Error("System settings must be finite JSON data"); return }
		if (typeof entry === "function" || typeof entry === "symbol" || typeof entry === "bigint" || typeof entry === "undefined") throw new Error("System settings cannot contain executable values")
		if (Array.isArray(entry)) { entry.forEach(check); return }
		if (typeof entry === "object") Object.values(entry as Record<string, unknown>).forEach(check)
	}
	check(settings.state)
}

export function validateSystemSettingsList(settings: unknown, order: unknown): asserts settings is SystemSettings[] {
	if (!Array.isArray(settings) || !Array.isArray(order) || !order.every(id => typeof id === "string")) throw new Error("Malformed system snapshot")
	const ids = new Set<string>()
	for (const entry of settings) { validateSystemSettings(entry); if (ids.has(entry.systemId)) throw new Error("Duplicate system ID"); ids.add(entry.systemId) }
	if (order.length !== settings.length || new Set(order).size !== order.length || order.some(id => !ids.has(id))) throw new Error("Invalid system order")
}

/** Restores only engine-owned systems. UI and transport adapters are intentionally not snapshot-restored. */
export function createSystemFromSettings(settings: SystemSettings, restored: ReadonlyMap<string, ISerializableSystem> = new Map()): ISerializableSystem {
	validateSystemSettings(settings)
	const state = settings.state as Record<string, unknown>
		switch (settings.systemId) {
		case "core.movement": if (Object.keys(state).length) throw new Error("Malformed movement settings"); return new MovementSystem()
		case "core.playback": {
			const system = new PlaybackSystem()
			if (!Number.isSafeInteger(state.remainingFrames) || typeof state.syncPending !== "boolean" || typeof state.completionPending !== "boolean" || !(state.finalState === null || Array.isArray(state.finalState))) throw new Error("Malformed playback settings")
			Object.assign(system as object, { remainingFrames: state.remainingFrames, syncPending: state.syncPending, completionPending: state.completionPending, finalState: state.finalState === null ? undefined : structuredClone(state.finalState) })
			return system
		}
		case "core.physics":
			if (!Number.isFinite(state.fps) || !Array.isArray(state.contacts) || !state.contacts.every(contact => typeof contact === "string")) throw new Error("Malformed physics settings")
			return new PhysicsSystem(new defaultPhysics(), state.fps as number)
		case "core.boundary": if (Object.keys(state).length) throw new Error("Malformed boundary settings"); return new BoundarySystem()
		case "core.game-state-manager": if (Object.keys(state).length) throw new Error("Malformed game state manager settings"); return new GameStateManager()
		case "core.winning": {
			if (typeof state.teamCount !== "number" || !Number.isSafeInteger(state.teamCount) || state.teamCount < 1 || !(state.pending === null || (typeof state.pending === "object" && state.pending !== null))) throw new Error("Malformed winning settings")
			const system = new WinningSystem(state.teamCount as number)
			Object.assign(system as object, { pending: state.pending === null ? undefined : structuredClone(state.pending) })
			return system
		}
		case "ui.pointer-input": {
			for (const key of ["start", "end", "currentMouse", "aimAngle", "chargePower", "selectedActorId"]) if (!(key in state)) throw new Error("Malformed UI settings")
			const system = new UiSystem()
			Object.assign(system as object, structuredClone(state))
			return system
		}
		case "core.emitter": if (Object.keys(state).length) throw new Error("Malformed emitter settings"); return new EmitterSystem()
		case "core.effects": if (typeof state.newRound !== "boolean") throw new Error("Malformed effects settings"); return new EffectSystem(state.newRound)
		case "core.round-player": {
			if (!Array.isArray(state.teams) || !state.teams.every(team => typeof team === "string")) throw new Error("Malformed round settings")
			return new RoundPlayerSystem(state.teams as never[])
		}
		case "core.simulator": {
			if (Object.keys(state).length) throw new Error("Malformed simulator settings")
			const physics = restored.get("core.physics")
			if (!(physics instanceof PhysicsSystem)) throw new Error("Simulator requires serialized physics")
			return new Simulator(physics)
		}
		case "ui.match-state-indicator": {
			if (typeof state.rulePhase !== "string" || !(state.selectedItemId === null || typeof state.selectedItemId === "string")) throw new Error("Malformed match indicator settings")
			const system = new MatchStateIndicator()
			Object.assign(system as object, { rulePhase: state.rulePhase, selectedItemId: state.selectedItemId })
			return system
		}
		case "ai.battle": return AiBattleSystem.fromSettings(state)
		case "ai.opponent": return AiOpponentSystem.fromSettings(state)
		case "core.environmental": {
			if (!Array.isArray(state.mechanics) || !Array.isArray(state.structureIndexes) || !state.structureIndexes.every(index => Number.isSafeInteger(index) && index >= 0)) throw new Error("Malformed environmental settings")
			validateEnvironmentalMechanics(state.mechanics)
			const lifecycle = { tick: state.tick, active: state.active, triggerUntil: state.triggerUntil, cooldownUntil: state.cooldownUntil, cyclePhase: state.cyclePhase }
			if (!Number.isSafeInteger(lifecycle.tick) || !Array.isArray(lifecycle.active) || !Array.isArray(lifecycle.triggerUntil) || !Array.isArray(lifecycle.cooldownUntil) || !Array.isArray(lifecycle.cyclePhase)) throw new Error("Malformed environmental lifecycle state")
			return new EnvironmentalSystem(state.mechanics as EnvironmentalMechanic[], lifecycle as EnvironmentalState, state.structureIndexes as number[])
		}
		case "core.counter": if (Object.keys(state).length) throw new Error("Malformed counter settings"); return new CounterSystem()
		case "core.transform": if (Object.keys(state).length) throw new Error("Malformed transform settings"); return new TransformSystem()
		case "core.participation": if (Object.keys(state).length) throw new Error("Malformed participation settings"); return new ParticipationSystem()
		default: throw new Error(`Unknown system ID '${settings.systemId}'`)
	}
}
