import { isPhysicsParticipant, SHAPE, type IPhysics, type PhysicsStrategy, type Vector2D } from "@coffeemakerstudio/bean";
import { EntityManager } from "../../entity/EntityManager.js";
import { PlaybackSystem } from "../../systems/PlayBackSystem.js";
import type { IDrawer, ITicker, RenderContext } from "./RenderContext.js";
import { GameState } from "./types.js";
import type { EngineSettings, IInput, IMouse, ISettingsSerialize, ItemDrawState, TurnPacket } from "./types.js"
import type { IGameContext, ISerializableSystem, ISystem } from "../../systems/types.js";
import { createSystemFromSettings, validateSystemSettingsList } from "../../systems/systemSettings.js";
import { defaultPhysics } from "../../physics/defaultPhysics.js";
import { DEFAULT_DRIFT, GameSettings, type FrictionSettings, validateDrift, validateFigureCounts } from "../../settings/settings.js"
import type { IStructure } from "../../structures/types.js";
import type { IEntity } from "../../entity/Entity.js";
import type { IBackground } from "../../ui/types.js";
import { createRuntimePlayer } from "../../entity/runtimeFactory.js";

import { FullStructure } from "../../structures/fullStructure.js";
import type { UUID } from "crypto";
import { EffectTrigger, ItemEffectType, type Effect, type EffectSettings, type FullEffectSettings, type ItemEffectSettings } from "../../effects/types.js";
import { createRoundStartEvent, createScheduleDueEvent, createTickEvent, dispatchTriggerActivation, dispatchTriggeredEffects } from "../../effects/triggerDispatcher.js";
import { createRuntimeEffect } from "../../effects/runtimeFactory.js";
import { migrateGameSettingsEffects } from "../../migrations/effects.js";
import { canonicalizeCounterStates, type CounterState } from "@coffeemakerstudio/roast";

import { GameStateManager } from "../../systems/GameStateManager.js";
import { getBackgoundSystem } from "../../ui/Background.js";
import { PhysicsSystem } from "../../systems/PhysicsSystem.js";
import { MovementSystem } from "../../systems/MovementSystem.js";
import { BoundarySystem } from "../../systems/BoundarySystem.js";
import { MatchStatus, RulePhase, validateItemEconomySettings, type RuleState } from "../../rules/types.js";
import { RuleInterpreter } from "../../rules/RuleInterpreter.js";
import { currentTurnMode } from "../../rules/defaultGameModes.js";
import type { MatchResult } from "../../rules/types.js";
import { addDrawnInventoryItem, consumeInventoryItem, createFixedLoadoutInventory } from "../../item/inventory.js";
import { MapPickupSystem } from "../../item/MapPickupSystem.js";
import { EnvironmentalSystem } from "../../systems/EnvironmentalSystem.js";
import { dispatchPredefinedEffect, dispatchPredefinedComposition } from "../../systems/predefinedEffectDispatcher.js";
import { createTemporalModifier, type TemporalModifierSettings } from "@coffeemakerstudio/roast";
import { createActionModifier } from "@coffeemakerstudio/roast";
import { createCollisionFilter, createCollisionFilterLifetime } from "@coffeemakerstudio/roast";
import { createActorEligibilityConstraint, createActorEligibilityConstraintLifetime } from "@coffeemakerstudio/roast";
import { advanceStructureLifecycle, createStructureLifecycle, type StructureLifecycleSettings, type StructureLifecycleTemplate, validateStructureLifecycle } from "@coffeemakerstudio/roast";
import { advanceDeferredEffect, createDeferredEffect, type DeferredEffectSettings, validateDeferredEffect } from "@coffeemakerstudio/roast";
import { dispatchCollisionCommands } from "../../systems/collisionCommandHost.js";
import type { EngineEffectComposition } from "@coffeemakerstudio/roast";
import { TransformSystem } from "../../systems/TransformSystem.js";
import { ParticipationSystem } from "../../systems/ParticipationSystem.js";
import { NumericSystem } from "../../systems/NumericSystem.js";
import { validateItemDocument, type ItemDocument, type ItemPickup, type ItemPickupState } from "../../item/types.js";
import { SeededRandom } from "../../utils/random.js";
import { resolveEffectTarget, validateItemTarget, type ItemTarget } from "../../item/target.js";
import { createStructureResolvedTarget, type ResolvedEffectTarget } from "../../item/resolvedTarget.js";
import { itemOrder, validateItemCombination } from "../../item/interactions.js";
import { createRuntimeItemEffect, isActionModifierTemplate, isActorEligibilityConstraintTemplate, isCollisionFilterTemplate, isDeferredEffectTemplate, isStructureLifecycleTemplate, isTemporalModifierTemplate, type RuntimeItemEffect } from "../sdk/itemRuntime.js";
import { MOVEMENT_APPLY_FORCE_TO_ENTITY_EFFECT_ID } from "@coffeemakerstudio/roast";
import { EffectSpawnTrigger } from "../../effects/spawnTrigger.js";
import { TRANSFORM_SWAP_POSITION_EFFECT_ID } from "@coffeemakerstudio/roast";
import { PARTICIPATION_SET_DRAWING_EFFECT_ID, PARTICIPATION_SET_PHYSICS_EFFECT_ID } from "@coffeemakerstudio/roast";
import { deriveMysteryBoxSeed, grantMysteryBoxReward, hashString, MYSTERY_BOX_ITEM_ID, resolveMysteryBoxReward, type MysteryBoxRewardOptions } from "../../item/officialItems.js";
import { TriggerDefinitionCatalog, type TriggerDefinition } from "../../item/triggerDefinitions.js";
import type { AiSettings } from "../../ai/types.js";
import type { IAiTurnProducer } from "../../ai/aiEmitter.js";
import { EasyAi } from "../../ai/easyAi.js";
import { MediumAi } from "../../ai/mediumAi.js";
import { HardAi } from "../../ai/hardAi.js";
import { AuthoritativeGameplayRenderer, type AuthoritativeGameplaySnapshot } from "../../ui/AuthoritativeGameplayRenderer.js";
import type { LanguageCatalog } from "../../i18n/language.js";
import { GameplayFeedbackTrace, KoreGameplayFeedbackType, type KoreGameplayFeedbackEvent } from "../gameplayFeedback.js";
import type { JsonValue } from "@coffeemakerstudio/roast";
import { isRuntimeLogCategory, LoggerType, runtimeNow, type RuntimeLogEntry } from "./runtimeLog.js";

type EntityForceFieldItemEffect = { type: typeof MOVEMENT_APPLY_FORCE_TO_ENTITY_EFFECT_ID; typeValue: Record<string, unknown> };
type EntitySwapPositionItemEffect = { type: typeof TRANSFORM_SWAP_POSITION_EFFECT_ID; typeValue: Record<string, unknown> };
type LoweredItemEffect = RuntimeItemEffect | EntityForceFieldItemEffect | EntitySwapPositionItemEffect;

/**
 * Erstellt eine spielbereite Instanz des GameHandlers (Standard-Setup).
 * 
 * Diese Factory ist der Einstiegspunkt für Tests oder einfache Spiel-Instanzen.
 * Sie konfiguriert alle Abhängigkeiten wie Physik und Entity-Management vor.
 * 
 * @param overrides - Erlaubt es, gezielt Teile der Engine (z.B. den Context) zu ersetzen.
 * @returns Ein einsatzbereiter GameHandler.
 * 
 * @example
 * // So startest du die Engine in deinem Test oder File:
 * const handler = createTestHandler();
 * 
 * // Jetzt kannst du den Loop starten
 * handler.tick(16.6); // Simuliert einen Frame mit ~60 FPS
 */
// export type Override = Partial<HandlerDependencies>;
// export const createTestHandler = (overrides: Override = {}) => {
// 	const physicsStrategy = new defaultPhysics()
// 	const em = new EntityManager([])
// 	const defaultDependencies: HandlerDependencies = {
// 		context: createDefaultContext(),
// 		entityManager: em,
// 		physicsStrategy,
// 		inputEmitter: { sendShot: () => { } },
// 		systems: [new PhysicsSystem(physicsStrategy), new PlaybackSystem()],
// 		dt: 1,
// 	};
//
// 	const handler = new GameHandler(
// 		createDefaultContext({ entities: em, state: GameState.STARTING, ...overrides.context }),
// 		overrides.entityManager ?? defaultDependencies.entityManager,
// 		overrides.physicsStrategy ?? defaultDependencies.physicsStrategy,
// 		overrides.inputEmitter ?? defaultDependencies.inputEmitter,
// 		overrides.systems ?? defaultDependencies.systems,
// 		overrides.dt ?? defaultDependencies.dt,
// 	);
// 	return handler
// };

/**
 * Der zentrale Hub der Game Engine.
 * 
 * Diese Klasse koordiniert den Spielzustand, das Rendering, die Physik 
 * und das Input-Handling. Sie fungiert als "Orchestrator", der alle 
 * Sub-Systeme (Physics, Entities, Systems) zusammenführt.
 * 
 * @implements {ITicker} Erlaubt der Engine, den Game-Loop zu triggern.
 * @implements {IMouse} Verarbeitet Maus-Interaktionen über das gesamte Spielfeld.
 */
export class GameHandler implements ITicker, IMouse, ISettingsSerialize<GameSettings> {
	public static readonly LONG_TURN_WARNING_TICKS = 600;
	/** Console-friendly category source: `game.handler.LoggerType.Performance`. */
	public readonly LoggerType = LoggerType;
	private teamSize: number = 0
	private id: UUID
	private turns: TurnPacket[] = []
	private settings: GameSettings | EngineSettings | undefined
	private initialSettings: GameSettings | undefined
	private context: IGameContext;
	private systems: ISystem[] = [];
	private entityManager: EntityManager;
	private physicsStrategy: PhysicsStrategy
	private preTickers: ITicker[] = []
	private postTickers: ITicker[] = []
	private preDrawers: IDrawer[] = []
	private postDrawers: IDrawer[] = []
	private dt: number = 1;
	private mouseHandler: IMouse | undefined;
	private readonly logs: RuntimeLogEntry[] = []
	private playbackStartedAt: number | undefined;
	private turnStartedAt: number | undefined;
	private team: number[] = []
	private effectAlways: Effect[] = []
	private effectRound: Effect[] = []
	private effectCollision: Effect[] = []
	private triggerDefinitions = new TriggerDefinitionCatalog()
	private items: ItemDocument[] = []
	private itemDrawRandom: SeededRandom | undefined
	private mapPickupSystem = new MapPickupSystem()
	private readonly gameplayRenderer = new AuthoritativeGameplayRenderer(this)
	private ruleState: RuleState = { phase: RulePhase.Physics, activeTeam: 0, turnNumber: 0, itemUses: 0 }
	private matchResult: MatchResult | undefined
	private disposed = false
	/** Transient local host pause; it is intentionally not an authoritative snapshot field. */
	private paused = false
	/** True while `resolveTurn` is resolving the accepted turn's final state. */
	private resolvingTurn = false
	private structureLifecycles: StructureLifecycleSettings[] = []
	private deferredEffects: DeferredEffectSettings[] = []
	private readonly feedback = new GameplayFeedbackTrace();
	/**
		 * Erzeugt eine neue Instanz der Engine.
		 * 
		 * @param context - Der "globale Wissensspeicher" (Status, Entities, Strukturen).
		 * @param entityManager - Die Verwaltungseinheit für alle Spielobjekte.
		 * @param physics - Die mathematischen Regeln für Bewegung und Kollision.
		 * @param emitter - Das Sprachrohr für Inputs (z.B. Schuss-Befehle an den Server).
		 * @param systems - Eine Liste von Modulen, die pro Tick laufen (z.B. Physik, Animation).
		 */
	constructor() {
		this.id = crypto.randomUUID()
		const em = new EntityManager([])
		this.context = {
			state: GameState.Starting,
			dt: 1,
			entities: em,
			structures: [],
			worldSize: { x: 0, y: 0 },
			mouse: { turn: null },
			physics: new defaultPhysics(),
			currTurn: 0,
			activeTeam: 0,
			myTeamNumber: 0,
			counters: [],
			drift: DEFAULT_DRIFT,
			finishMatch: (result) => this.finishMatch(result),
			log: (type, data) => this.log(type, data),
		}
		this.entityManager = em;
		this.physicsStrategy = new defaultPhysics();
	}
	public setLanguage(language: LanguageCatalog): void { this.gameplayRenderer.setLanguage(language); }

	/**
	 * Tauscht die Physik-Regeln im laufenden Betrieb aus.
	 * Nützlich, wenn man z.B. von "Eis" (wenig Reibung) auf "Rasen" (viel Reibung) wechselt.
	 */
	public setPhysics(strategy: PhysicsStrategy) {
		this.physicsStrategy = strategy;
		this.context.physics = strategy;
		this.systems.forEach(system => {
			if (system instanceof PhysicsSystem) system.strategy = strategy
		})
	}


	// /**
	// 	 * Die "Glaskugel" der Engine: Berechnet einen kompletten Zug im Voraus.
	// 	 * 
	// 	 * Erstellt eine Kopie der aktuellen Welt und lässt die Physik so lange laufen, 
	// 	 * bis alles wieder stillsteht. Der eigentliche Spielzustand bleibt unberührt.
	// 	 * 
	// 	 * @param actorId - Wer führt den Zug aus?
	// 	 * @param angle - In welche Richtung wird geschossen?
	// 	 * @param power - Wie stark ist der Stoß?
	// 	 * @returns Ein "Ticket" (TurnPacket), das genau beschreibt, was passieren wird.
	// 	 */
	public simulateTurn(actorId: string, angle: number, power: number, options: { maxTicks?: number } = {}): TurnPacket {
		if (this.context.state === GameState.Game_over) throw new Error("A completed match cannot simulate further turns")
		const started = runtimeNow();
		this.log("turn.simulation.started", { actorId, angle, power });
		const maxTicks = options.maxTicks ?? 1200
		if (!Number.isSafeInteger(maxTicks) || maxTicks < 1) throw new Error("Simulation maxTicks must be a positive safe integer")
		const settings = JSON.parse(JSON.stringify(this.toSettings()))
		// Autonomous drivers are input adapters, not physics participants.  A
		// simulated shot must not let an AI submit nested turns in its clone.
		if (settings.systems && settings.systemOrder) {
			settings.systems = settings.systems.filter((system: { systemId: string }) => system.systemId !== "ai.battle" && system.systemId !== "ai.opponent")
			settings.systemOrder = settings.systemOrder.filter((id: string) => id !== "ai.battle" && id !== "ai.opponent")
		}
		const g = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build()
		const packet = g.resolveTurnWithDiagnostics({ actorId, angle, power }, maxTicks, (type, data) => this.log(`turn.simulation.${type}`, data));
		this.log("turn.simulation.completed", { actorId, ticks: packet.durationFrames, durationMs: runtimeNow() - started });
		this.log("turnPacket.created", { actorId, frameCount: packet.durationFrames, playerCount: packet.finalState.length });
		return packet
	}

	/** Resolves and commits one turn on this handler. Use this on the authoritative server. */
	public resolveTurn({ actorId, angle, power }: IInput): TurnPacket {
		return this.resolveTurnWithTickBudget({ actorId, angle, power }, 1200)
	}

	/** Shared resolution implementation; callers use the authoritative default or a narrow speculative budget. */
	private resolveTurnWithTickBudget({ actorId, angle, power }: IInput, maxTicks: number): TurnPacket {
		return this.resolveTurnWithDiagnostics({ actorId, angle, power }, maxTicks, undefined);
	}

	private resolveTurnWithDiagnostics({ actorId, angle, power }: IInput, maxTicks: number, diagnosticSink: ((type: "long-running" | "max-ticks", data: unknown) => void) | undefined): TurnPacket {
		if (this.context.state === GameState.Game_over) throw new Error("A completed match cannot resolve further turns")
		const actor = this.validateActorForAction(actorId);
		this.log("input.received", { actionType: "shot", actorId, angle, power });
		this.log("input.accepted", { actionType: "shot", actorId, angle, power, team: actor.getTeam() });
		this.turnStartedAt = runtimeNow();
		this.log("turn.started", { actorId, actionType: "shot", angle, power });
		this.feedback.record(KoreGameplayFeedbackType.Shot, this.getTurnNumber(), { actorId, data: { angle, power } });
		const before = new Map(this.entityManager.toSettings().map(player => [player.id, player]));
		this.applyAcceptedForce(actor, { angle, power });
		this.applyTemporalModifiers(actor);
		// The resolution loop is part of the accepted turn: the completion gate
		// must not freeze it even if a gameplay system completes the match
		// mid-loop (the deciding tick already stored the result).
		this.resolvingTurn = true;
		let frames = 0;
		let lastMeaningfulMotionTick = 0;
		let lastPositionChangeTick = 0;
		let lastVelocityChangeTick = 0;
		let lastRotationChangeTick = 0;
		let previousKinematics = maxTicks >= GameHandler.LONG_TURN_WARNING_TICKS ? new Map(this.entityManager.getEntities().map(entity => [String(entity.getId()), { position: entity.getPos(), velocity: entity.getVel(), rotation: (entity as unknown as { getRotation: () => number }).getRotation() }])) : undefined;
		const emitLongRunningWarning = (data: unknown) => diagnosticSink ? diagnosticSink("long-running", data) : this.log("turn.simulation.long-running", data);
		const emitMaxDiagnostic = (data: unknown) => diagnosticSink ? diagnosticSink("max-ticks", data) : this.log("turn.simulation.max-ticks", data);
		let longRunningWarningLogged = false;
		const inspectBodies = () => {
			const bodies = this.entityManager.getEntities().filter(isPhysicsParticipant).map(entity => {
				const velocity = entity.getVel();
				const getAngularVelocity = (entity as unknown as { getAngularVelocity?: () => number }).getAngularVelocity;
				return { entityId: String(entity.getId()), velocity, velocityMagnitude: Math.hypot(velocity.x, velocity.y), angularVelocity: getAngularVelocity?.call(entity) ?? 0, physicsEnabled: entity.physicsEnabled(), isDead: entity.isDead(), drawingEnabled: entity.drawingEnabled() };
			});
			const blockers = bodies.filter(body => Math.abs(body.velocity.x) >= 0.1 || Math.abs(body.velocity.y) >= 0.1).sort((first, second) => second.velocityMagnitude - first.velocityMagnitude).slice(0, 4);
			return { activePhysicalEntities: bodies.length, movingPhysicalEntities: blockers.length, maxVelocityMagnitude: bodies.reduce((max, body) => Math.max(max, body.velocityMagnitude), 0), maxAngularVelocityMagnitude: bodies.reduce((max, body) => Math.max(max, Math.abs(body.angularVelocity)), 0), blockers };
		};
		try {
			for (; !this.physicsStrategy.isStatic(this.entityManager) && frames < maxTicks; frames++) {
				this.tick();
				if (previousKinematics) {
					let moved = false;
					for (const entity of this.entityManager.getEntities()) {
						if (!isPhysicsParticipant(entity)) continue;
						const id = String(entity.getId());
						const previous = previousKinematics.get(id);
						const position = entity.getPos();
						const velocity = entity.getVel();
						const rotation = (entity as unknown as { getRotation: () => number }).getRotation();
						if (previous && Math.hypot(position.x - previous.position.x, position.y - previous.position.y) > 1e-6) { moved = true; lastPositionChangeTick = frames + 1; }
						if (previous && Math.hypot(velocity.x - previous.velocity.x, velocity.y - previous.velocity.y) > 1e-6) { moved = true; lastVelocityChangeTick = frames + 1; }
						if (previous && Math.abs(rotation - previous.rotation) > 1e-6) { moved = true; lastRotationChangeTick = frames + 1; }
						previousKinematics.set(id, { position, velocity, rotation });
					}
					if (moved) lastMeaningfulMotionTick = frames + 1;
					if (!longRunningWarningLogged && frames + 1 >= GameHandler.LONG_TURN_WARNING_TICKS) {
						longRunningWarningLogged = true;
						emitLongRunningWarning({ ticks: frames + 1, maxTicks, lastMeaningfulMotionTick, ...inspectBodies() });
					}
				}
			}
		} finally {
			this.resolvingTurn = false;
		}
		if (frames >= maxTicks && !this.physicsStrategy.isStatic(this.entityManager)) {
			emitMaxDiagnostic({ ticks: frames, maxTicks, lastPositionChangeTick, lastVelocityChangeTick, lastRotationChangeTick, lastMeaningfulMotionTick, ...inspectBodies() });
		}
		const finalState = this.entityManager.serialize();
		for (const player of this.entityManager.toSettings()) {
			const previous = before.get(player.id);
			if (!previous) continue;
			if (player.hp < previous.hp) this.feedback.record(KoreGameplayFeedbackType.Damage, this.getTurnNumber(), { targetIds: [player.id], data: { amount: previous.hp - player.hp } });
			if ((!player.isPhysicsEnabled || !player.isDrawingEnabled) && previous.isPhysicsEnabled && previous.isDrawingEnabled) this.feedback.record(KoreGameplayFeedbackType.Elimination, this.getTurnNumber(), { targetIds: [player.id] });
		}
		this.feedback.record(KoreGameplayFeedbackType.Turn, this.getTurnNumber(), { actorId, data: { durationFrames: frames } });
		const packet: TurnPacket = {
			actorId,
			input: { angle, power },
			durationFrames: frames,
			finalState,
		};
		this.log("turn.simulation.completed", { actorId, ticks: frames, durationMs: runtimeNow() - (this.turnStartedAt ?? runtimeNow()) });
		this.log("turnPacket.created", { actorId, frameCount: frames, playerCount: finalState.length });
		return packet;
	}

	/** Shared authoritative actor eligibility boundary for all action transports. */
	public validateActorForAction(actorId: string): IEntity {
		const actor = this.entityManager.getEntityById(actorId);
		if (!actor) throw new Error(`Actor ${actorId} not found`);
		if (actor.isDead()) throw new Error(`Actor ${actorId} is not active`);
		if (!actor.isActorEligible()) throw new Error(`Actor ${actorId} is locked from selection`);
		return actor;
	}

	public isActorEligibleForAction(actorId: string): boolean {
		try { this.validateActorForAction(actorId); return true; }
		catch { return false; }
	}

	/**
		 * Führt den zuvor berechneten Zug visuell für den Spieler aus.
		 * 
		 * Nutzt das TurnPacket aus `simulateTurn`, um die Animation zu starten. 
		 * Hier sieht der Spieler erst die Bewegung auf dem Bildschirm.
		 * 
		 * @param packet - Das Datenpaket aus der Simulation.
		 */
	/** Starts client-side visual playback for an already authoritative turn. */
	public playTurn(packet: TurnPacket, onComplete?: () => void): void {
		if (this.context.state === GameState.Game_over) throw new Error("A completed match cannot play further turns")
		this.turns.push(packet)
		this.playbackStartedAt = runtimeNow();
		this.log("turnPacket.playbackStarted", { actorId: packet.actorId, frameCount: packet.durationFrames, playerCount: packet.finalState.length });
		this.log("turn.playback.started", { actorId: packet.actorId, frames: packet.durationFrames });
		this.setState(GameState.Playing)

		const turnStartState = this.entityManager.serialize();
		const actor = this.entityManager.getEntityById(packet.actorId);
		if (!actor) throw new Error("actor not found!")
		this.applyAcceptedForce(actor, packet.input);
		this.applyTemporalModifiers(actor);

		const playback = this.systems.find(s => s instanceof PlaybackSystem) as PlaybackSystem;
		if (!playback) throw new Error("playbacksystem not found!")
		playback.start(packet.durationFrames, packet.finalState, () => {
			const drift = playback.getLastPositionDrift();
			if (drift.some(entry => entry.distance > 0)) this.log("turnPacket.pre-sync-drift", { actorId: packet.actorId, drift });
			const durationMs = runtimeNow() - (this.playbackStartedAt ?? runtimeNow());
			const team = this.entityManager.getEntityById(packet.actorId)?.getTeam()[0];
			this.log("turn.playback.completed", { actorId: packet.actorId, team, frames: packet.durationFrames, durationMs, playerVisibleDurationMs: durationMs });
			this.log("turnPacket.playbackCompleted", { actorId: packet.actorId, frameCount: packet.durationFrames, durationMs });
			const turnDurationMs = this.turnStartedAt === undefined ? durationMs : runtimeNow() - this.turnStartedAt;
			this.log("turn.completed", { actorId: packet.actorId, team, frames: packet.durationFrames, durationMs: turnDurationMs, turnDurationMs });
			this.playbackStartedAt = undefined;
			this.turnStartedAt = undefined;
			// A terminal match state set by gameplay systems during the final
			// tick (e.g. WinningSystem) must survive the playback completion.
			if (this.context.state !== GameState.Game_over) {
				this.setState(GameState.Playing_done)
			}
			onComplete?.()
		}, turnStartState);
	}


	public applyRawTurn({ actorId, angle, power }: IInput) {
		if (this.context.state === GameState.Game_over) throw new Error("A completed match cannot accept raw turns")
		const actor = this.entityManager.getEntityById(actorId);
		if (!actor) { console.log("Player not Found"); return }
		this.applyAcceptedForce(actor, { angle, power });
		this.applyTemporalModifiers(actor);
	}

	/** Applies and consumes entity-owned action modifiers at the accepted action boundary. */
	private applyAcceptedForce(entity: IEntity, input: { angle: number; power: number }): void {
		const effective = entity.applyPendingActionModifiers(input);
		this.physicsStrategy.applyImpulse(entity, effective.angle, effective.power);
		entity.consumePendingActionModifiers();
	}

	/** Applies active generic temporal commands once to an accepted movement action. */
	private applyTemporalModifiers(entity: IEntity): void {
		for (const modifier of entity.getTemporalModifiers()) {
			if (modifier.target.entityId !== String(entity.getId())) continue;
			dispatchPredefinedEffect({ ctx: this.context, systems: this.systems, effect: modifier.effect });
		}
	}

	/**
		 * Der Core-Loop der Engine (Logic-Tick).
		 * 
		 * Die Ausführung folgt einem strikten Layer-System:
		 * 1. **Pre-Tickers**: System-nahe Logik (z.B. Pause-Menü, Overlays), die VOR dem Spiel gerendert/berechnet wird.
		 * 2. **Systems**: Die eigentliche Spiel-Logik (ECS). Hier werden Entities verarbeitet.
		 * 3. **Post-Tickers**: Hintergrund-Layer oder Effekte, die NACH der Hauptlogik kommen.
		 * 
		 * @param dt - Delta Time (Zeit seit dem letzten Frame).
		 */
	public tick(dt: number = this.dt) {
		if (this.disposed) return
		if (this.paused) return
		// Completed matches are frozen: the accepted final turn has been
		// synchronized and its result stored. No later tick may mutate
		// entities, effects, structures, systems, inventories, or outcome
		// state; `rematch()` is the only sanctioned way to resume gameplay.
		// The one exception is an in-flight `resolveTurn`: its loop is the
		// resolution of the accepted turn itself and must still run to its
		// authoritative final state even when the deciding tick completes
		// the match mid-loop.
		if (this.context.state === GameState.Game_over && !this.resolvingTurn) return
		this.preTickers.forEach(t => t.tick(dt, this.physicsStrategy.getFriction()));
		this.advanceDeferredEffectsTick();
		for (const e of this.entityManager.getEntities()) {
			if (this.effectAlways.length === 0) continue;
			dispatchTriggeredEffects({ effects: this.effectAlways, event: createTickEvent(String(this.id), dt), apply: effect => effect.apply(e) });
		}
		const drift = this.settings?.drift ?? DEFAULT_DRIFT
		this.context.drift = drift
		this.systems.forEach(s => s.preTick?.(this.context, dt, this.physicsStrategy.getFriction()))
		for (const e of this.entityManager.getEntities()) { e.tick(dt, this.physicsStrategy.getFriction(), drift, this.physicsStrategy.getStopThreshold()) }
		this.systems.forEach(s => s.ticker(this.context, dt, this.physicsStrategy.getFriction()))
		this.mapPickupSystem.ticker(this.context, dt, this.physicsStrategy.getFriction())
		this.context.structures.forEach(str => str.tick(dt, this.physicsStrategy.getFriction()))
		this.postTickers.forEach(t => t.tick(dt, this.physicsStrategy.getFriction()));
		// Finale Mutations-Phase: Playback-Syncs (und andere Flush-Hooks) laufen
		// als allerletzter Schritt, damit kein Gameplay-System, keine Struktur
		// und kein Post-Ticker den autoritativen `finalState` verändern kann.
		this.systems.forEach(s => s.flush?.(this.context))
		// Abschluss-Callback erst NACH allen Flush-Hooks: finalisierende Systeme
		// (z.B. WinningSystem) schließen den Turn-Endzustand zuerst ab, bevor
		// die Turn-Weiterleitung entscheidet, ob der Zug noch fortgesetzt wird.
		const playback = this.systems.find(s => s instanceof PlaybackSystem) as PlaybackSystem | undefined;
		playback?.drainCompletion();
	}

	/**
		 * Zeichnet die eigentliche Spielwelt (Pucks, Hindernisse, etc.).
		 * 
		 * Alles hier wird relativ zu den Welt-Koordinaten gezeichnet.
		 * 1. Pre-Drawers (Hintergrund, Effekte unter den Objekten)
		 * 2. Entities (Die Spieler-Pucks selbst)
		 * 3. Post-Drawers (Effekte über den Objekten)
		 * 
		 * @param renderer - Der Context, der das Zeichnen übernimmt (z.B. p5.js oder Canvas).
		 */
	public drawWorld(renderer: RenderContext): void {
		if (this.disposed) return
		renderer.clear()
		this.preDrawers.forEach(d => d.draw(renderer))
		this.gameplayRenderer.draw(renderer)
		this.postDrawers.forEach(d => d.draw(renderer))

	}

	/**
		 * Zeichnet das Benutzer-Interface (UI), das über der Welt liegt.
		 * 
		 * Wichtig: Elemente hier skalieren oft nicht mit der Weltkamera mit.
		 * Beinhaltet:
		 * - Den aktuellen Spielstatus (GameState)
		 * - Die Schuss-Vorschau (Trajektorie), wenn der Spieler zielt.
		 */
	public drawUI(renderer: RenderContext) {
		renderer.setFillColor("black")
		if (this.context.state === GameState.Game_over) {
			const result = this.getMatchResult()
			const message = result?.status === MatchStatus.Draw ? "Match draw" : `Team ${result?.winnerTeam ?? "?"} wins`
			renderer.drawText(message, renderer.WORLD_SIZE_X / 2 - 80, renderer.WORLD_SIZE_Y / 2, 24)
			return
		}
		// renderer.drawText(getEngineStateName(this.context.state), renderer.WORLD_SIZE_X / 2, renderer.WORLD_SIZE_Y / 2, 32)
		if (this.context.state != GameState.Your_turn && this.context.state != GameState.Opponents_turn) return
	}

	/**
	 * Registriert den Klick auf ein Objekt.
	 * Prüft, ob an der Mausposition eine Entity (z.B. ein Puck) liegt, 
	 * die man "ziehen" kann.
	 */
	public handleMousePressed() {
		if (this.disposed) return
		if (this.ruleState.phase !== RulePhase.Physics && !this.mouseHandler?.acceptsUiInputWhileLocked) return
		if (this.context.state !== GameState.Starting && this.context.state !== GameState.Your_turn && this.context.state !== GameState.Game_over && !this.mouseHandler?.acceptsUiInputWhileLocked) return
		this.mouseHandler?.handleMousePressed()
	}
	/** Aktualisiert die aktuelle Mausposition für Berechnungen (z.B. die Vorschau-Linie). */
	public updateMouse(x: number, y: number) {
		if (this.disposed) return
		this.mouseHandler?.updateMouse(x, y)
	}

	/**
		 * Schließt die Eingabe ab und feuert den Schuss ab.
		 * Wandelt die Zieh-Bewegung in ein Input-Paket um und sendet es an den Server/Emitter.
		 */
	public handleMouseReleased() {
		if (this.disposed) return
		if (this.ruleState.phase !== RulePhase.Physics && !this.mouseHandler?.acceptsUiInputWhileLocked) return
		if (this.context.state !== GameState.Your_turn) return
		this.mouseHandler?.handleMouseReleased()
	}

	public handleMouseCancelled(): void {
		if (this.disposed) return;
		(this.mouseHandler as (IMouse & { handleMouseCancelled?: () => void }) | undefined)?.handleMouseCancelled?.();
	}

	public handleMouseWheel(event: WheelEvent): void {
		if (this.disposed) return
		this.mouseHandler?.handleMouseWheel(event);
	}
	public handleKeyPressed(event: KeyboardEvent): void {
		if (this.disposed) return
		const handler = this.mouseHandler as (IMouse & { handleKeyPressed?: (event: KeyboardEvent) => void }) | undefined
		handler?.handleKeyPressed?.(event)
	}

	// --- LOGIK & UPDATES (Ticker) ---
	// Diese Module laufen in jedem Frame ab, um Daten zu berechnen.

	/** Registriert ein Modul, das VOR der Haupt-Physik berechnet wird. */
	public addPreTicker(ticker: ITicker) { this.preTickers.push(ticker); }

	/** Registriert ein Modul, das NACH der Haupt-Physik berechnet wird. */
	public addPostTicker(ticker: ITicker) { this.postTickers.push(ticker); }
	public rmPreTicker(ticker: ITicker) { this.preTickers = this.preTickers.filter(t => t !== ticker); }
	public rmPostTicker(ticker: ITicker) { this.postTickers = this.postTickers.filter(t => t !== ticker); }

	// --- GRAFIK (Drawer) ---
	// Diese Module zeichnen Dinge auf den Bildschirm.

	public addPreDrawer(drawer: IDrawer) { this.preDrawers.push(drawer); }
	public addPostDrawer(drawer: IDrawer) { this.postDrawers.push(drawer); }
	public rmPreDrawer(drawer: IDrawer) { this.preDrawers = this.preDrawers.filter(d => d !== drawer); }
	public rmPostDrawer(drawer: IDrawer) { this.postDrawers = this.postDrawers.filter(d => d !== drawer); }

	// --- KOMBI-METHODEN ---

	/** 
	 * Registriert ein Objekt für beides: Logik-Update und Zeichnen.
	 * Ideal für interaktive Objekte oder Effekte.
	 */

	public addPreTickAndDraw(item: IDrawer & ITicker) {
		this.addPreTicker(item)
		this.addPreDrawer(item)
	}

	public addPostTickAndDraw(item: IDrawer & ITicker) {
		this.addPostTicker(item)
		this.addPostDrawer(item)
	}

	public rmPreTickAndDraw(item: IDrawer & ITicker) {
		this.rmPreTicker(item)
		this.rmPreDrawer(item)
	}

	public rmPostTickAndDraw(item: IDrawer & ITicker) {
		this.rmPostTicker(item)
		this.rmPostDrawer(item)
	}

	// ENGINE KONTROLLE

	public getContext(): IGameContext { return { ...this.context }; }
	public getCounters(): CounterState[] { return this.context.counters.map(counter => ({ ...counter })); }
	public getCounter(counterId: string): CounterState {
		const counter = this.context.counters.find(candidate => candidate.id === counterId);
		if (!counter) throw new Error(`Unknown counter target '${counterId}'`);
		return { ...counter };
	}
	public dispatchEngineEffect(effect: unknown): void { dispatchPredefinedEffect({ ctx: this.context, systems: this.systems, effect }); }
	public addSystem(system: ISystem) { this.systems.push(system) }
	/** Snapshot-only inspection; callers must not mutate the returned systems. */
	public getSystems(): readonly ISystem[] { return this.systems }
	/** Builder-only replacement used when restoring the serialized system graph. */
	public replaceSystems(systems: ISystem[]): void { this.systems = systems }
	public getEntityManager(): EntityManager { return this.entityManager }

	public setState(state: GameState): void {
		// console.info(`${getEngineStateName(this.getState())} -> ${getEngineStateName(state)}`)
		this.context.state = state
	}

	public getState(): GameState { return this.context.state }
	public getPlaybackFramesRemaining(): number {
		const playback = this.systems.find(system => system instanceof PlaybackSystem) as PlaybackSystem | undefined;
		return playback?.getRemainingFrames() ?? 0;
	}
	public getLastPositionDrift(): ReturnType<PlaybackSystem["getLastPositionDrift"]> {
		const playback = this.systems.find(system => system instanceof PlaybackSystem) as PlaybackSystem | undefined;
		return playback?.getLastPositionDrift() ?? [];
	}
	public getPhysics(): PhysicsStrategy { return this.physicsStrategy }
	public attachFeedbackToPhysics(system: PhysicsSystem): void {
		system.onCollision = (a, b) => {
			const ids = [a, b].filter((value): value is IEntity & IPhysics<SHAPE> => typeof (value as IEntity).getId === "function").map(value => value.getId())
			this.recordFeedback(KoreGameplayFeedbackType.Collision, { ...(ids[0] ? { actorId: ids[0] } : {}), ...(ids.length > 1 ? { targetIds: ids.slice(1) } : {}) })
			const structure = [a, b].find(value => typeof (value as IStructure).getCollisionCommands === "function") as IStructure | undefined;
			const entity = [a, b].find(value => typeof (value as IEntity).getId === "function" && typeof (value as IEntity).getTeam === "function") as IEntity | undefined;
			if (ids.length === 1) {
				const vector = structure ? collisionVelocityVector(structure.getCollisionCommands()) : undefined;
				this.recordFeedback(KoreGameplayFeedbackType.Hazard, { actorId: ids[0], data: { structure: true, ...(vector ? { vectorX: vector.x, vectorY: vector.y, force: Math.hypot(vector.x, vector.y) } : {}) } });
			}
			if (structure && entity) dispatchCollisionCommands({ ctx: this.context, systems: this.systems, commands: structure.getCollisionCommands(), target: entity });
		}
	}
	public setWorldSize(worldSize: Vector2D): void { this.context.worldSize = { ...worldSize } }
	public setTurnNumber(turnNumber: number): void {
		if (this.context.currTurn !== turnNumber) this.entityManager.getEntities().forEach(entity => {
			entity.resetItemUses();
			entity.advanceTemporalModifiersTurn();
			entity.advancePendingActionModifierLifetimes();
			entity.advanceCollisionFilterLifetimes();
			entity.advanceActorEligibilityConstraintLifetimes();
			for (const scheduled of entity.advanceItemEffectsTurn()) this.executeDueSpawnTrigger(entity, scheduled);
		})
		if (this.context.currTurn !== turnNumber) this.advanceStructureLifecyclesTurn();
		this.context.currTurn = turnNumber
		this.ruleState.turnNumber = turnNumber
	}
	public getTurnNumber(): number { return this.context.currTurn }
	public setActiveTeam(team: number): void {
		if (!Number.isInteger(team) || team < 0) throw new Error("Active team must be a non-negative integer")
		if (this.context.activeTeam !== team) this.feedback.record(KoreGameplayFeedbackType.Turn, this.getTurnNumber(), { data: { activeTeam: team } });
		this.context.activeTeam = team
		this.ruleState.activeTeam = team
	}
	public getRuleState(): RuleState { return { ...this.ruleState } }
	public setRuleState(ruleState: RuleState): void {
		this.ruleState = { ...ruleState }
		this.context.activeTeam = ruleState.activeTeam
		this.context.currTurn = ruleState.turnNumber
	}
	/** Advances to the next rule phase in the current game mode. */
	public skipCurrentPhase(): RuleState {
		const mode = this.settings?.gameMode ?? currentTurnMode
		const interpreter = new RuleInterpreter(mode)
		const nextState = interpreter.advancePhase(this.ruleState)
		this.setRuleState(nextState)
		return this.getRuleState()
	}
	/** Starts a turn and grants its configured deterministic item draws. */
	public startTurn(ruleState: RuleState): void {
		this.setTurnNumber(ruleState.turnNumber)
		this.setActiveTeam(ruleState.activeTeam)
		this.setRuleState(ruleState)
		const event = createRoundStartEvent(String(this.id), ruleState.turnNumber, ruleState.activeTeam, ruleState.phase)
		for (const entity of this.entityManager.getEntities()) {
			entity.onRound(event)
			if (this.effectRound.length > 0) dispatchTriggeredEffects({ effects: this.effectRound, event, apply: effect => effect.apply(entity) })
		}
		this.drawItemsForActiveTeam()
	}
	public getMatchResult(): MatchResult | undefined { return this.matchResult && { ...this.matchResult } }
	public setMatchResult(result: MatchResult | undefined): void { this.matchResult = result && { ...result } }
	/**
	 * Atomically completes the match: stores the result and transitions to
	 * `Game_over` in one operation so the invariant
	 * `Game_over => MatchResult` is always upheld.
	 */
	public finishMatch(result: MatchResult): void {
		this.matchResult = { ...result }
		this.context.state = GameState.Game_over
		this.feedback.record(KoreGameplayFeedbackType.Result, this.getTurnNumber(), { data: result as unknown as JsonValue });
	}
	public getAiSettings(): AiSettings | undefined {
		return this.settings?.ai ? JSON.parse(JSON.stringify(this.settings.ai)) : undefined;
	}
	public createAiProducer(): IAiTurnProducer | undefined {
		const ai = this.getAiSettings();
		if (!ai) return undefined;
		switch (ai.difficulty) {
			case "easy": return new EasyAi();
			case "medium": return new MediumAi();
			case "hard": return new HardAi();
		}
	}
	/** Restores the configured local match without replacing installed UI systems. */
	public rematch(): this {
		if (this.disposed) throw new Error("A disposed match cannot be rematched")
		if (!this.initialSettings) throw new Error("A rematch requires initial game settings")
		const settings = JSON.parse(JSON.stringify(this.initialSettings)) as GameSettings
		this.entityManager.applySettings(settings.players)
		this.structureLifecycles = []
		this.deferredEffects = []
		this.initializeFixedLoadouts()
		this.context.structures = settings.mapBoundarys.map(boundary => new FullStructure(boundary))
		this.restoreStructureLifecycles((settings as EngineSettings).structureLifecycles)
		this.setPhysics(new defaultPhysics(settings.friction))
		this.setWorldSize(settings.screenResolution)
		this.setMyTeam(settings.myTeam)
		this.setTeamSize(settings.allTeamSize)
		this.setItems(settings.items)
		this.loadEffects(settings.effects)
		this.loadTriggerDefinitions(settings.triggerDefinitions ?? [])
		this.initializeItemDraws()
		this.resetMapItemPickups()
		const initialPhase = settings.gameMode?.phases?.[0] ?? RulePhase.Physics
		this.startTurn({ phase: initialPhase, activeTeam: 0, turnNumber: 0, itemUses: 0 })
		this.paused = false
		this.setMatchResult(undefined)
		this.saveSettings(settings)
		this.mouseHandler?.reset?.()
		this.setState(GameState.Your_turn)
		return this
	}
	/** Releases scene-owned callbacks and makes this handler inert. */
	public dispose(): void {
		if (this.disposed) return
		this.disposed = true
		this.mouseHandler?.reset?.()
		this.mouseHandler = undefined
		this.systems = []
		this.preTickers = []
		this.postTickers = []
		this.preDrawers = []
		this.postDrawers = []
	}
	public isDisposed(): boolean { return this.disposed }
	/** Freezes local host ticking without changing serializable authoritative match state. */
	public setPaused(paused: boolean): void { this.paused = paused }
	public isPaused(): boolean { return this.paused }
	public getActiveTeam(): number { return this.context.activeTeam }
	/** Starts the ephemeral wall-clock span for a local accepted turn. */
	public beginTurnTiming(): void { this.turnStartedAt = runtimeNow(); }
	public start(state?: GameState): this {
		this.context.state = state ?? GameState.Your_turn;
		for (const entity of this.entityManager.getEntities()) entity.setNumericEffectDispatcher(effect => this.dispatchEngineEffect(effect));
		return this;
	}
	public addStructure(structure: IStructure | IStructure & IPhysics<SHAPE>) {
		this.context.structures.push(structure)
		// if ("getShape" in structure) this.physicsStrategy.addToQueue(PhysicsLevel.Map, structure)
	}
	public setMouseHandler(mouseHandler: IMouse): void { this.mouseHandler = mouseHandler }
	public getMouseHandler() { return this.mouseHandler }

	public setTickRate(tickRate: number) { this.dt = tickRate } public getCurrentMousePosition(): Vector2D { return { x: 0, y: 0 } }
	public getTickRate(): number { return this.dt }
	/** Restores physics lifecycle state after the complete world has been rebuilt. */
	public restorePhysicsState(state: EngineSettings["physicsState"]): void {
		for (const system of this.systems) {
			if (system instanceof PhysicsSystem) system.restoreSnapshotState(state, this.context)
		}
	}
	public getPhysicsState(): NonNullable<EngineSettings["physicsState"]> | undefined {
		const system = this.systems.find(candidate => candidate instanceof PhysicsSystem) as PhysicsSystem | undefined
		return system?.toSnapshotState()
	}
	public setCurrentMousePosition(_pos: Vector2D): void { }
	public saveSettings(settings: GameSettings | EngineSettings) { this.settings = settings }
	public setInitialSettings(settings: GameSettings): void { this.initialSettings = JSON.parse(JSON.stringify(settings)) as GameSettings }
	public getSettings(): GameSettings | EngineSettings | undefined { return this.settings }
	public exportGame(): { logs: TurnPacket[], settings: Partial<GameSettings> | any } { return { logs: this.turns, settings: JSON.stringify(this.settings) } }
	/** Appends a cheap structured observation. `data` is intentionally not cloned. */
	public log<T>(type: string, data: T): RuntimeLogEntry<T> {
		if (!type || typeof type !== "string") throw new Error("Runtime log type must be a non-empty string");
		const entry: RuntimeLogEntry<T> = { type, timestampMs: runtimeNow(), turnNumber: this.getTurnNumber(), data };
		this.logs.push(entry as RuntimeLogEntry);
		return entry;
	}
	/** Returns detached runtime observations, optionally filtered by category. */
	public getLogs(types?: LoggerType | readonly LoggerType[]): readonly RuntimeLogEntry[] {
		if (types === undefined) return this.logs.slice();
		const categories = new Set(Array.isArray(types) ? types : [types]);
		return this.logs.filter(log => [...categories].some(category => isRuntimeLogCategory(log.type, category)));
	}
	public recordFeedback(type: KoreGameplayFeedbackType, details: Omit<KoreGameplayFeedbackEvent, "schemaVersion" | "sequence" | "turnNumber" | "type"> = {}): KoreGameplayFeedbackEvent { return this.feedback.record(type, this.getTurnNumber(), details); }
	public getFeedbackTrace(fromSequence = 0): KoreGameplayFeedbackEvent[] { return this.feedback.list(fromSequence); }

	public serialize(): string { return JSON.stringify(this) }
	public deserialize(_: string): GameHandler {
		return new GameHandlerBuilder().defaultSystems().fromSettings(GameSettings).build()
	}
	public getGameId(): UUID {
		return this.id
	}
	public toSettings(): EngineSettings {
		const effects: FullEffectSettings[] = []
		this.effectAlways.forEach(eff => effects.push({ trigger: EffectTrigger.Always, triggerValue: [], ...eff.toSettings() }))
		this.effectRound.forEach(eff => effects.push({ trigger: EffectTrigger.Round, triggerValue: [], ...eff.toSettings() }))
		this.effectCollision.forEach(eff => effects.push({ trigger: EffectTrigger.Collision, triggerValue: [], ...eff.toSettings() }))

		const settings: EngineSettings = {
			schemaVersion: this.settings?.schemaVersion ?? 1,
			state: this.getState(),
			background: this.settings?.background ?? { color: "white", type: "color" },
			friction: this.getPhysics().toSettings(),
			drift: this.settings?.drift ?? DEFAULT_DRIFT,
			id: this.getGameId(),
			mapBoundarys: this.context.structures.map(str => str.toSettings()),
			screenResolution: this.settings?.screenResolution ?? { ...this.context.worldSize },
			worldSize: { ...this.context.worldSize },
			myTeam: [...this.team],
			allTeams: this.settings?.allTeams ? [...this.settings.allTeams] : [],
			effects,
			items: this.items.map(item => ({ ...item })),
			players: this.entityManager.toSettings(),
			counters: canonicalizeCounterStates(this.context.counters),
			minPlayers: this.settings?.minPlayers ?? 0,
			maxPlayers: this.settings?.maxPlayers ?? 0,
			allTeamSize: this.teamSize,
			playerCount: this.settings?.playerCount ?? 1,
			figuresPerPlayer: this.settings?.figuresPerPlayer ?? Math.max(1, this.entityManager.getEntities().length),
			...(this.settings?.mapReference ? { mapReference: { ...this.settings.mapReference } } : {}),
			...(this.settings?.gameMode ? { gameMode: JSON.parse(JSON.stringify(this.settings.gameMode)) } : {}),
			...(this.settings?.ai ? { ai: JSON.parse(JSON.stringify(this.settings.ai)) } : {}),
			...(this.triggerDefinitions.describe().length ? { triggerDefinitions: this.triggerDefinitions.toSettings() } : {}),
			turnNumber: this.getContext().currTurn,
			activeTeam: this.getActiveTeam(),
			ruleState: { ...this.ruleState, activeTeam: this.getActiveTeam(), turnNumber: this.getTurnNumber() },
			matchResult: this.getMatchResult(),
			physicsState: this.getPhysicsState(),
			systems: (() => {
				const serialized = this.systems.map(system => {
				if (!("systemId" in system) || !("toSettings" in system)) throw new Error("All registered systems must implement ISettingsSerialize")
				return (system as ISerializableSystem).toSettings()
				})
				if (new Set(serialized.map(system => system.systemId)).size !== serialized.length) throw new Error("Duplicate system IDs are not serializable")
				return serialized.sort((a, b) => a.systemId.localeCompare(b.systemId))
			})(),
			systemOrder: this.systems.map(system => {
				if (!("systemId" in system)) throw new Error("All registered systems require a stable systemId")
				return (system as ISerializableSystem).systemId
			}),
			tickRate: this.getTickRate(),
			...(this.itemDrawRandom ? { itemDrawState: { randomState: this.itemDrawRandom.getState() } } : {}),
			...(this.mapPickupSystem.toState() ? { itemPickupState: this.mapPickupSystem.toState() } : {}),
			...(this.structureLifecycles.length ? { structureLifecycles: structuredClone(this.structureLifecycles) } : {}),
			...(this.deferredEffects.length ? { deferredEffects: structuredClone(this.deferredEffects) } : {}),
		}
		// The export stays a pure snapshot: only a detached copy is retained,
		// so caller mutations of the returned settings can never leak into
		// the stored settings or change later exports.
		this.saveSettings(JSON.parse(JSON.stringify(settings)))
		return settings
	}
	public getTeam(): number[] { return this.team }
	public setId(id: UUID) { this.id = id }
	public getId(): string { return this.id }
	public setMyTeam(team: number[]) {
		this.team = team
		this.context.myTeamNumber = team[0] ?? 0
	}
	public addEffectEveryTick(effect: Effect): void { this.effectAlways.push(effect) }
	public addEffectEveryRound(effect: Effect): void { this.effectRound.push(effect) }
	public addEffectEveryCollision(effect: Effect): void { this.effectCollision.push(effect) }
	public loadTriggerDefinitions(definitions: readonly TriggerDefinition[]): void {
		const catalog = new TriggerDefinitionCatalog();
		definitions.forEach(definition => catalog.register(definition));
		this.triggerDefinitions = catalog;
	}
	public setTeamSize(size: number): void { this.teamSize = size }
	public setItems(items: ItemDocument[]): void {
		items.forEach(validateItemDocument)
		this.items = structuredClone(items)
	}
	public configureMapItemPickups(pickups: ItemPickup[]): void {
		this.mapPickupSystem.configure(pickups, this.items, this.context.worldSize)
		this.mapPickupSystem.setCollector((entity, item) => item.id === MYSTERY_BOX_ITEM_ID ? this.unwrapMysteryBoxPickup(entity) : this.collectItemPickup(entity, item))
	}
	private collectItemPickup(entity: IEntity, item: ItemDocument): void {
		const inventory = entity.getInventory();
		addDrawnInventoryItem(inventory, item);
		entity.setInventory(inventory);
		// Pickup feedback is presentation-only, but recording it here makes the
		// inventory change observable in the same authoritative tick as collection.
		this.feedback.record(KoreGameplayFeedbackType.Item, this.getTurnNumber(), { actorId: String(entity.getId()), data: { itemId: item.id, source: "map-pickup" } });
	}
	private unwrapMysteryBoxPickup(actor: IEntity): void {
		const options = this.mysteryBoxRewardOptions(actor.getId())
		const rewardId = resolveMysteryBoxReward(options)
		const reward = this.items.find(candidate => candidate.id === rewardId)
		const inventory = actor.getInventory()
		grantMysteryBoxReward(inventory, this.items, { ...options, specificItemId: rewardId })
		actor.setInventory(inventory)
		this.feedback.record(KoreGameplayFeedbackType.Item, this.getTurnNumber(), { actorId: String(actor.getId()), data: { itemId: MYSTERY_BOX_ITEM_ID, rewardItemId: rewardId, rewardName: reward?.name ?? rewardId, source: "map-pickup" } })
	}
	/** Produces the complete detached state consumed by the gameplay renderer. */
	public getAuthoritativeRenderState(): AuthoritativeGameplaySnapshot {
		return {
			gameState: this.getState(),
			ruleState: this.getRuleState(),
			matchResult: this.getMatchResult(),
			structures: this.context.structures.map(structure => structure.toSettings()),
			players: this.entityManager.toSettings(),
			items: structuredClone(this.items),
			pickups: this.mapPickupSystem.getPickups(),
			pickupState: this.mapPickupSystem.toState(),
		}
	}
	public restoreMapItemPickups(state: ItemPickupState | undefined): void { this.mapPickupSystem.restore(state) }
	public resetMapItemPickups(): void { this.mapPickupSystem.reset() }
	private advanceStructureLifecyclesTurn(): void {
		const next: StructureLifecycleSettings[] = [];
		for (const lifecycle of this.structureLifecycles) {
			const advanced = advanceStructureLifecycle(lifecycle);
			if (advanced) next.push(advanced);
			else {
				const structure = this.context.structures.find(candidate => candidate.getId() === lifecycle.structureId);
				if (!structure) throw new Error(`Unknown structure lifecycle target '${lifecycle.structureId}'`);
				this.setStructureParticipation(structure.getId(), false);
			}
		}
		this.structureLifecycles = next;
	}
	public restoreStructureLifecycles(lifecycles: readonly StructureLifecycleSettings[] | undefined): void {
		this.structureLifecycles = [];
		for (const lifecycle of lifecycles ?? []) {
			validateStructureLifecycle(lifecycle);
			if (!this.context.structures.some(structure => structure.getId() === lifecycle.structureId)) throw new Error(`Unknown structure lifecycle target '${lifecycle.structureId}'`);
			this.structureLifecycles.push(structuredClone(lifecycle));
		}
	}
	public restoreDeferredEffects(effects: readonly DeferredEffectSettings[] | undefined): void {
		this.deferredEffects = [];
		for (const effect of effects ?? []) {
			validateDeferredEffect(effect);
			this.deferredEffects.push(structuredClone(effect));
		}
	}
	private removeStructureLifecycles(sourceIds: ReadonlySet<string>, targetId: string): void {
		for (const lifecycle of this.structureLifecycles) {
			if (!lifecycle.sourceId || !sourceIds.has(lifecycle.sourceId) || lifecycle.targetId !== targetId) continue;
			const structure = this.context.structures.find(candidate => candidate.getId() === lifecycle.structureId);
			if (structure) this.setStructureParticipation(structure.getId(), false);
		}
		this.structureLifecycles = this.structureLifecycles.filter(lifecycle => !lifecycle.sourceId || !sourceIds.has(lifecycle.sourceId) || lifecycle.targetId !== targetId);
	}
	private setStructureParticipation(structureId: string, enabled: boolean): void {
		for (const type of [PARTICIPATION_SET_PHYSICS_EFFECT_ID, PARTICIPATION_SET_DRAWING_EFFECT_ID]) {
			dispatchPredefinedEffect({ ctx: this.context, systems: this.systems, effect: { schemaVersion: 1, type, target: { type: "structure", structureId }, typeValue: { enabled } } });
		}
	}
	private removeDeferredEffects(sourceIds: ReadonlySet<string>, ownerId: string): void {
		this.deferredEffects = this.deferredEffects.filter(effect => !effect.sourceId || !sourceIds.has(effect.sourceId) || effect.ownerId !== ownerId);
	}
	/**
	 * Consumes a declared item and validates its target through the gameplay
	 * authority. A used mystery box additionally resolves and grants exactly
	 * one deterministic reward; every validation runs before any mutation.
	 */
	public useItem(actorId: string, itemId: string, target: unknown = { type: "self" }): void {
		const actor = this.validateActorForAction(actorId)
		const item = this.items.find(candidate => candidate.id === itemId)
		if (!item) throw new Error(`Item '${itemId}' is not declared for this game`)
		validateItemTarget(item, target, { actor, entities: this.entityManager.getEntities(), worldSize: this.context.worldSize })
		const resolvedItemTarget = item.effects.some(effect => effect.type === ItemEffectType.DeferredEffect || effect.type === ItemEffectType.SpawnTrigger) ? resolveEffectTarget(target, { actor }) : undefined
		if (item.id === MYSTERY_BOX_ITEM_ID) {
			const rewardId = this.resolveMysteryBoxUse(actor, item)
			const reward = this.items.find(candidate => candidate.id === rewardId)
			this.feedback.record(KoreGameplayFeedbackType.Item, this.getTurnNumber(), { actorId, data: { itemId, rewardItemId: rewardId, rewardName: reward?.name ?? rewardId } });
			return
		}
		const targetEntity = target.type === "entity" ? this.entityManager.getEntityById(target.entityId) : actor
		if (!targetEntity) throw new Error("Item target entity not found")
		const runtimeEffects: LoweredItemEffect[] = item.effects.map(effect => effect.type === MOVEMENT_APPLY_FORCE_TO_ENTITY_EFFECT_ID
			? { type: MOVEMENT_APPLY_FORCE_TO_ENTITY_EFFECT_ID, typeValue: structuredClone(effect.value ?? {}) }
			: effect.type === TRANSFORM_SWAP_POSITION_EFFECT_ID
				? { type: TRANSFORM_SWAP_POSITION_EFFECT_ID, typeValue: structuredClone(effect.value ?? {}) }
				: createRuntimeItemEffect({ type: effect.type as never, typeValue: structuredClone(effect.value ?? {}) } as ItemEffectSettings))
		for (const effect of runtimeEffects) {
			if (effect instanceof EffectSpawnTrigger) {
				this.triggerDefinitions.require(effect.triggerId);
				if (effect.structureId !== undefined) {
					if (!this.context.structures.some(structure => structure.getId() === effect.structureId)) throw new Error(`Unknown structure target '${effect.structureId}'`);
					if (resolvedItemTarget?.type !== "position") throw new Error("Structure spawnTrigger requires a position target");
				} else if (resolvedItemTarget?.type !== "entity") throw new Error("spawnTrigger requires an entity or self target");
			}
		}
		const inventory = actor.getInventory()
		// Validate and reserve the use before applying effects. The live inventory
		// is committed only after all effect constructors and target checks pass.
		consumeInventoryItem(inventory, item)
		const installedEffects = [
			...targetEntity.getItemEffects(),
			...targetEntity.getTemporalModifiers().map(modifier => ({ itemId: modifier.sourceId, order: modifier.sourceOrder })),
			...targetEntity.getPendingActionModifiers().map(modifier => ({ itemId: modifier.sourceId, order: modifier.sourceOrder })),
			...targetEntity.getCollisionFilters().map(filter => ({ itemId: filter.sourceId, order: filter.sourceOrder })),
			...targetEntity.getActorEligibilityConstraints().map(constraint => ({ itemId: constraint.sourceId, order: constraint.sourceOrder })),
			...this.structureLifecycles.filter(lifecycle => lifecycle.targetId === String(targetEntity.getId()) && lifecycle.sourceId).map(lifecycle => ({ itemId: lifecycle.sourceId, order: lifecycle.sourceOrder })),
			...this.deferredEffects.filter(effect => effect.ownerId === String(targetEntity.getId()) && effect.sourceId).map(effect => ({ itemId: effect.sourceId, order: effect.sourceOrder })),
		];
		const combination = validateItemCombination(item, installedEffects, new Map(this.items.map(candidate => [candidate.id, candidate])))
		targetEntity.removeItemEffects(combination.removeItemIds)
		targetEntity.removeTemporalModifiers(combination.removeItemIds)
		targetEntity.removePendingActionModifiers(combination.removeItemIds)
		targetEntity.removeCollisionFilters(combination.removeItemIds)
		targetEntity.removeActorEligibilityConstraints(combination.removeItemIds)
		this.removeStructureLifecycles(combination.removeItemIds, String(targetEntity.getId()))
		this.removeDeferredEffects(combination.removeItemIds, String(targetEntity.getId()))
		this.applyItemEffects(actor, target, runtimeEffects, item, resolvedItemTarget)
		actor.setInventory(inventory)
		this.feedback.record(KoreGameplayFeedbackType.Item, this.getTurnNumber(), { actorId, targetIds: target.type === "entity" ? [target.entityId!] : [actorId], data: { itemId } });
		if (item.effects.some(effect => effect.type === "shield")) this.feedback.record(KoreGameplayFeedbackType.Shield, this.getTurnNumber(), { actorId, data: { itemId } });
	}

	private applyItemEffects(actor: IEntity, target: ItemTarget, effects: LoweredItemEffect[], item: ItemDocument, resolvedItemTarget?: ResolvedEffectTarget): void {
		const targetEntity = target.type === "entity" ? this.entityManager.getEntityById(target.entityId!) : actor
		if (target.type === "entity" && !targetEntity) throw new Error("Item target entity not found")
		for (const effect of effects) {
			if (isEntityForceFieldItemEffect(effect)) {
				if (target.type !== "entity" || !targetEntity) throw new Error("Entity force effects require an entity target");
				this.dispatchEngineEffect({
					schemaVersion: 1,
					type: MOVEMENT_APPLY_FORCE_TO_ENTITY_EFFECT_ID,
					target: { type: "entity", entityId: String(targetEntity.getId()) },
					typeValue: { ...structuredClone(effect.typeValue), origin: actor.getPos() },
				});
			}
			else if (isEntitySwapPositionItemEffect(effect)) {
				if (target.type !== "entity" || !targetEntity) throw new Error("Swap position effects require an entity target");
				this.dispatchEngineEffect({ schemaVersion: 1, type: TRANSFORM_SWAP_POSITION_EFFECT_ID, target: { type: "entity", entityId: String(actor.getId()) }, typeValue: { otherEntityId: String(targetEntity.getId()) } });
			}
			else if (isDeferredEffectTemplate(effect)) {
				if (!resolvedItemTarget) throw new Error("Deferred Effects require a resolved target");
				if (resolvedItemTarget.type !== "position") throw new Error("Deferred force fields require a position target");
				const target = { type: "position" as const, position: { ...resolvedItemTarget.position } };
				this.deferredEffects.push(createDeferredEffect({
					id: `${actor.getId()}:${item.id}:${this.getTurnNumber()}`,
					durationUnit: effect.durationUnit,
					duration: effect.duration,
					effect: { ...structuredClone(effect.effect), target },
					sourceId: item.id,
					sourceOrder: itemOrder(item),
					ownerId: String(actor.getId()),
				}));
			}
			else if (effect instanceof EffectSpawnTrigger) {
				if (!resolvedItemTarget) throw new Error("spawnTrigger requires a resolved target");
				const triggerSettings = effect.toSettings();
				const resolvedTarget = effect.structureId === undefined ? resolvedItemTarget : createStructureResolvedTarget(effect.structureId);
				const scheduled = { ...triggerSettings, typeValue: { ...triggerSettings.typeValue, resolvedTarget, ...(resolvedItemTarget.type === "position" ? { resolvedPosition: { ...resolvedItemTarget.position } } : {}) } };
				actor.addItemEffect(scheduled, { itemId: item.id, order: itemOrder(item) });
			}
			else if (isStructureLifecycleTemplate(effect)) {
				if (target.type !== "position") throw new Error("Structure lifecycles require a position target");
				this.installStructureLifecycle(actor, item, effect, target.position);
			} else if (isCollisionFilterTemplate(effect)) {
				if (!targetEntity) throw new Error("Collision filters require an entity target");
				const filterId = `${targetEntity.getId()}:${actor.getId()}:${item.id}:${this.getTurnNumber()}`;
				targetEntity.addCollisionFilter(
					createCollisionFilter({ id: filterId, excludedCategories: [...effect.excludedCategories], sourceId: item.id, sourceOrder: itemOrder(item) }),
					createCollisionFilterLifetime({ id: `${filterId}:lifetime`, filterId, durationUnit: effect.durationUnit, duration: effect.duration, sourceId: item.id, sourceOrder: itemOrder(item) }),
				);
			} else if (isActorEligibilityConstraintTemplate(effect)) {
				if (!targetEntity) throw new Error("Actor eligibility constraints require an entity target");
				const constraintId = `${targetEntity.getId()}:${actor.getId()}:${item.id}:${this.getTurnNumber()}`;
				targetEntity.addActorEligibilityConstraint(
					createActorEligibilityConstraint({ id: constraintId, mode: effect.mode, sourceId: item.id, sourceOrder: itemOrder(item) }),
					createActorEligibilityConstraintLifetime({ id: `${constraintId}:lifetime`, constraintId, durationUnit: effect.durationUnit, duration: effect.duration, sourceId: item.id, sourceOrder: itemOrder(item) }),
				);
			} else if (isActionModifierTemplate(effect)) {
				if (!targetEntity) throw new Error("Action modifiers require an entity target");
				const actionModifier = effect.action === "force"
					? createActionModifier({
						id: `${targetEntity.getId()}:${actor.getId()}:${item.id}:${this.getTurnNumber()}`,
						action: "force",
						operation: "scale",
						factor: effect.factor,
						...(item.duration.type === "turns" ? { durationUnit: "turns" as const, duration: item.duration.value, remaining: item.duration.value } : {}),
						...(item.duration.type !== "turns" ? { remainingUses: 1 } : {}),
						sourceId: item.id,
						sourceOrder: itemOrder(item),
					})
					: createActionModifier({
						id: `${targetEntity.getId()}:${actor.getId()}:${item.id}:${this.getTurnNumber()}`,
						action: "aim",
						operation: "random-offset",
						maxVarianceDegrees: effect.maxVarianceDegrees,
						randomState: effect.randomState,
						...(item.duration.type === "turns" ? { durationUnit: "turns" as const, duration: item.duration.value, remaining: item.duration.value } : {}),
						...(item.duration.type !== "turns" ? { remainingUses: 1 } : {}),
						sourceId: item.id,
						sourceOrder: itemOrder(item),
					});
				targetEntity.addPendingActionModifier(actionModifier);
			} else if (isTemporalModifierTemplate(effect)) {
				if (!targetEntity) throw new Error("Temporal modifiers require an entity target");
				const targetId = String(targetEntity.getId());
				const modifier: TemporalModifierSettings = createTemporalModifier({
					id: `${targetId}:${actor.getId()}:${item.id}:${this.getTurnNumber()}`,
					target: { type: "entity", entityId: targetId },
					effect: { ...structuredClone(effect.effect), target: { type: "entity", entityId: targetId } },
					durationUnit: effect.durationUnit,
					duration: effect.duration,
					sourceId: item.id,
					sourceOrder: itemOrder(item),
				});
				targetEntity.addTemporalModifier(modifier);
			} else {
				(targetEntity ?? actor).addItemEffect(effect.toSettings() as never, { itemId: item.id, order: itemOrder(item) })
			}
		}
	}
	private installStructureLifecycle(actor: IEntity, item: ItemDocument, template: StructureLifecycleTemplate, position: Vector2D): void {
		const structureId = `${actor.getId()}:${item.id}:${this.getTurnNumber()}`;
		if (this.context.structures.some(structure => structure.getId() === structureId)) throw new Error(`Structure lifecycle ID '${structureId}' already exists`);
		this.context.structures.push(new FullStructure({
			id: structureId,
			type: SHAPE.RECTANGLE,
			x: position.x,
			y: position.y,
			w: template.structure.w,
			h: template.structure.h,
			...(template.structure.color === undefined ? {} : { color: template.structure.color }),
			role: template.structure.role ?? "solid",
			physicsEnabled: true,
			drawingEnabled: true,
			effects: [],
		}));
		this.structureLifecycles.push(createStructureLifecycle({
			id: `${structureId}:lifecycle`,
			structureId,
			durationUnit: template.durationUnit,
			duration: template.duration,
			sourceId: item.id,
			sourceOrder: itemOrder(item),
			targetId: String(actor.getId()),
		}));
	}

	private advanceDeferredEffectsTick(): void {
		const due: DeferredEffectSettings[] = [];
		const next: DeferredEffectSettings[] = [];
		for (const deferred of this.deferredEffects) {
			const advanced = advanceDeferredEffect(deferred);
			if (advanced) next.push(advanced);
			else due.push(deferred);
		}
		this.deferredEffects = next;
		for (const [index, deferred] of due.entries()) {
			const event = createScheduleDueEvent(deferred.ownerId ?? deferred.id, index, deferred.id, "tick", 0);
			dispatchTriggerActivation({ effectId: "engine.deferredEffect", event, apply: () => dispatchPredefinedEffect({ ctx: this.context, systems: this.systems, effect: deferred.effect }) });
		}
	}

	private executeDueSpawnTrigger(owner: IEntity, scheduled: ItemEffectSettings): void {
		if (scheduled.type !== ItemEffectType.SpawnTrigger) return;
		const value = scheduled.typeValue;
		const target = value.resolvedTarget as ResolvedEffectTarget | undefined;
		const definition = this.triggerDefinitions.get(String(value.triggerId));
		if (!definition) return;
		const event = createScheduleDueEvent(String(owner.getId()), 0, `${String(owner.getId())}:${String(value.triggerId)}`, "turn", this.getTurnNumber());
		if ("effects" in definition.effect) {
			const composition = definition.effect as EngineEffectComposition;
			dispatchTriggerActivation({ effectId: `trigger.${definition.id}`, event, apply: () => dispatchPredefinedComposition({ ctx: this.context, systems: this.systems, composition, positionOverride: value.resolvedPosition as { x: number; y: number } | undefined }) });
			return;
		}
		if (target?.type === "structure") {
			const structure = this.context.structures.find(candidate => candidate.getId() === target.structureId);
			if (!structure) throw new Error(`Unknown structure target '${target.structureId}'`);
			const position = value.resolvedPosition as { x: number; y: number } | undefined;
			dispatchTriggerActivation({ effectId: `trigger.${definition.id}`, event, apply: () => createRuntimeEffect(definition.effect as EffectSettings).apply(structure as unknown as IPhysics<SHAPE>, position) });
			return;
		}
		if (!target || target.type !== "entity") return;
		const entity = this.entityManager.getEntityById(target.entityId);
		if (!entity || entity.isDead()) return;
		dispatchTriggerActivation({ effectId: `trigger.${definition.id}`, event, apply: () => createRuntimeEffect(definition.effect as EffectSettings).apply(entity) });
	}

	private mysteryBoxRewardOptions(actorId: string): MysteryBoxRewardOptions {
		const economy = this.settings?.gameMode?.itemEconomy
		const baseSeed = economy?.randomDraw?.seed ?? hashString(this.id)
		return {
			candidatePool: economy?.mysteryBox?.candidatePool,
			seed: deriveMysteryBoxSeed({ actorId, turnNumber: this.ruleState.turnNumber, activeTeam: this.ruleState.activeTeam, baseSeed }),
			allowMysteryBoxReward: economy?.mysteryBox?.allowMysteryBoxReward,
			knownItemIds: this.items.map(candidate => candidate.id),
		}
	}

	/** Removes exactly one mystery box and adds exactly one reward use, atomically. */
	private resolveMysteryBoxUse(actor: IEntity, item: ItemDocument): string {
		const options = this.mysteryBoxRewardOptions(actor.getId())
		// Resolve and validate the reward before mutating anything so a rejected
		// pool or unknown reward never consumes the mystery box.
		const rewardId = resolveMysteryBoxReward(options)
		const inventory = actor.getInventory()
		consumeInventoryItem(inventory, item)
		grantMysteryBoxReward(inventory, this.items, { ...options, specificItemId: rewardId })
		actor.setInventory(inventory)
		return rewardId
	}
	public loadEffects(effects: FullEffectSettings[]): void {
		this.effectAlways = []
		this.effectRound = []
		this.effectCollision = []
		for (const effect of effects) {
			switch (effect.trigger) {
				case EffectTrigger.Always: this.effectAlways.push(createRuntimeEffect(effect)); break
				case EffectTrigger.Round: this.effectRound.push(createRuntimeEffect(effect)); break
				case EffectTrigger.Collision: this.effectCollision.push(createRuntimeEffect(effect)); break
			}
		}
	}
	public initializeFixedLoadouts(): void {
		const loadouts = this.settings?.gameMode?.itemEconomy.fixedLoadouts ?? []
		for (const loadout of loadouts) {
			const inventory = createFixedLoadoutInventory(loadout, this.items)
			for (const entity of this.entityManager.getEntities()) {
				if (entity.getTeam().includes(loadout.team)) entity.setInventory(inventory)
			}
		}
	}
	/** Initializes the configured draw sequence for a new match or rematch. */
	public initializeItemDraws(): void {
		const draw = this.settings?.gameMode?.itemEconomy.randomDraw
		this.itemDrawRandom = draw ? new SeededRandom(draw.seed) : undefined
		if (draw) this.validateItemDrawPool(draw.itemIds)
	}
	/** Restores a persisted draw sequence without granting an additional turn draw. */
	public restoreItemDraws(state: ItemDrawState | undefined): void {
		const draw = this.settings?.gameMode?.itemEconomy.randomDraw
		if (!draw) {
			if (state) throw new Error("Item draw state requires a configured random draw")
			this.itemDrawRandom = undefined
			return
		}
		this.validateItemDrawPool(draw.itemIds)
		if (!state) throw new Error("Configured item draws require a serialized draw state")
		this.itemDrawRandom = SeededRandom.fromState(state.randomState)
	}
	private drawItemsForActiveTeam(): void {
		const draw = this.settings?.gameMode?.itemEconomy.randomDraw
		if (!draw || !this.itemDrawRandom) return
		const drawnItems = Array.from({ length: draw.drawsPerTurn }, () => {
			const itemId = draw.itemIds[this.itemDrawRandom!.nextInt(draw.itemIds.length)]
			const item = this.items.find(candidate => candidate.id === itemId)
			if (!item) throw new Error(`Seeded item draw references unknown item '${itemId}'`)
			return item
		})
		for (const entity of this.entityManager.getEntities()) {
			if (!entity.getTeam().includes(this.getActiveTeam())) continue
			const inventory = entity.getInventory()
			for (const item of drawnItems) addDrawnInventoryItem(inventory, item)
			entity.setInventory(inventory)
		}
	}
	private validateItemDrawPool(itemIds: string[]): void {
		for (const itemId of itemIds) {
			if (!this.items.some(item => item.id === itemId)) throw new Error(`Seeded item draw references unknown item '${itemId}'`)
		}
	}
}

function collisionVelocityVector(commands: readonly unknown[]): { x: number; y: number } | undefined {
	for (const command of commands) {
		if (!command || typeof command !== "object") continue;
		const effect = (command as { effect?: unknown }).effect;
		if (!effect || typeof effect !== "object") continue;
		const value = effect as { type?: unknown; typeValue?: unknown; effects?: unknown[] };
		if (value.type === "effect.composition" && Array.isArray(value.effects)) {
			const nested = collisionVelocityVector(value.effects);
			if (nested) return nested;
		}
		if (value.type === "movement.add-velocity" && value.typeValue && typeof value.typeValue === "object") {
			const vector = value.typeValue as { x?: unknown; y?: unknown };
			if (typeof vector.x === "number" && typeof vector.y === "number" && Number.isFinite(vector.x) && Number.isFinite(vector.y)) return { x: vector.x, y: vector.y };
		}
	}
	return undefined;
}

function isEntityForceFieldItemEffect(effect: LoweredItemEffect): effect is EntityForceFieldItemEffect {
	return "type" in effect && effect.type === MOVEMENT_APPLY_FORCE_TO_ENTITY_EFFECT_ID;
}

function isEntitySwapPositionItemEffect(effect: LoweredItemEffect): effect is EntitySwapPositionItemEffect {
	return "type" in effect && effect.type === TRANSFORM_SWAP_POSITION_EFFECT_ID;
}



export class GameHandlerBuilder {
	private engine: GameHandler
	private myTeam: number[] = []
	private enemyTeam: number[] = []
	private state: GameState = GameState.Your_turn
	constructor(tickRate?: number) { this.engine = new GameHandler(); this.engine.setTickRate(tickRate ?? 1) }


	public addSystem(system: ISystem) { this.engine.addSystem(system); return this }
	public addUIMouse(mousehandler: IMouse) {
		this.engine.setMouseHandler(mousehandler)
		// this.engine.addSystem(mousehandler)
		// this.engine.addPostDrawer(mousehandler)
		return this
	}
	public addPlayer(player: IEntity): this { this.engine.getEntityManager().addEntity(player); return this }
	public addStructure(structure: IStructure | IStructure & IPhysics<SHAPE>): this { if (structure) this.engine.addStructure(structure); return this }
	public addBackground(background: IBackground): this { this.engine.addPreTickAndDraw(background); return this }
	public setPlayerTeam(teams: number[]): this {
		teams.forEach(team => this.myTeam.push(team))
		this.engine.setMyTeam(this.myTeam)
		return this
	}
	public setOpponentTeam(teams: number[]): this { teams.forEach(team => this.enemyTeam.push(team)); return this }
	public addPhysics(physics: PhysicsStrategy) { this.engine.setPhysics(physics); return this }
	public defaultSystems(friction?: FrictionSettings): this {
		const physics = new defaultPhysics(friction)
		const physicsSystem = new PhysicsSystem(physics)
		this.engine.attachFeedbackToPhysics(physicsSystem)

		this
			.addPhysics(physics)
			.addSystem(new MovementSystem())
			.addSystem(new NumericSystem())
			.addSystem(new ParticipationSystem())
			.addSystem(new TransformSystem())
			.addSystem(new PlaybackSystem())
			.addSystem(physicsSystem)
			.addSystem(new BoundarySystem())
			.addSystem(new GameStateManager())
		return this
	}

	public fromSettings(gameSettings: EngineSettings | GameSettings): this {
		gameSettings = migrateGameSettingsEffects(gameSettings)
		const counters = canonicalizeCounterStates((gameSettings as GameSettings).counters ?? [])
		gameSettings = { ...gameSettings, counters }
		const drift = gameSettings.drift ?? DEFAULT_DRIFT
		validateDrift(drift)
		const playerCount = gameSettings.playerCount ?? (gameSettings.maxPlayers > 0 ? gameSettings.maxPlayers : 1)
		const figuresPerPlayer = gameSettings.figuresPerPlayer ?? Math.max(1, Math.floor(gameSettings.players.length / playerCount))
		validateFigureCounts(playerCount, figuresPerPlayer)
		if (gameSettings.gameMode !== undefined) validateItemEconomySettings(gameSettings.gameMode.itemEconomy)
		this.engine.saveSettings({ ...gameSettings, drift, playerCount, figuresPerPlayer })
		const { state: _state, turnNumber: _turnNumber, activeTeam: _activeTeam, ruleState: _ruleState, itemDrawState: _itemDrawState, itemPickupState: _itemPickupState, matchResult: _matchResult, physicsState: _physicsState, tickRate: _tickRate, systems: _systems, systemOrder: _systemOrder, ...initialSettings } = gameSettings as EngineSettings
		this.engine.setInitialSettings(initialSettings)
		const { screenResolution, worldSize = screenResolution, background, myTeam, mapBoundarys, players } = gameSettings
		this.engine.setId(gameSettings.id)
		this.engine.setTickRate((gameSettings as EngineSettings).tickRate ?? 1)
		this.engine.setWorldSize(worldSize)
		this.engine.getContext().counters.splice(0, this.engine.getContext().counters.length, ...counters)
		this.engine.setPhysics(new defaultPhysics(gameSettings.friction))
		const snapshot = gameSettings as EngineSettings
		if (snapshot.systems !== undefined && snapshot.systems.length > 0) {
			validateSystemSettingsList(snapshot.systems, snapshot.systemOrder)
			const systemSettings = snapshot.systems as import("../../systems/types.js").SystemSettings[]
			const systemOrder = snapshot.systemOrder as string[]
			const byId = new Map(systemSettings.map(system => [system.systemId, system]))
			const restored = new Map<string, ISerializableSystem>()
			for (const id of systemSettings.map(system => system.systemId).filter(id => id !== "core.simulator")) restored.set(id, createSystemFromSettings(byId.get(id)!, restored))
			if (byId.has("core.simulator")) restored.set("core.simulator", createSystemFromSettings(byId.get("core.simulator")!, restored))
			this.engine.replaceSystems(systemOrder.map(id => restored.get(id)!))
			if (!this.engine.getSystems().some(system => (system as ISerializableSystem).systemId === "core.numeric")) this.engine.addSystem(new NumericSystem())
			if (!this.engine.getSystems().some(system => (system as ISerializableSystem).systemId === "core.participation")) this.engine.addSystem(new ParticipationSystem())
			if (!this.engine.getSystems().some(system => (system as ISerializableSystem).systemId === "core.transform") && gameSettings.items.some(item => item.effects.some(effect => effect.type === TRANSFORM_SWAP_POSITION_EFFECT_ID))) this.engine.addSystem(new TransformSystem())
			const restoredPhysics = this.engine.getSystems().find(system => (system as ISerializableSystem).systemId === "core.physics") as PhysicsSystem | undefined
			if (!restoredPhysics) throw new Error("System snapshot must include core.physics")
			restoredPhysics.strategy = this.engine.getPhysics()
			this.engine.attachFeedbackToPhysics(restoredPhysics)
		}

		// Adding Background
		let backgroundSettings: IBackground = getBackgoundSystem(background)

		//add Team
		this.engine.setMyTeam(myTeam ?? [crypto.randomUUID()])
		this.engine.setTeamSize(gameSettings.allTeamSize)
		this.engine.setItems(gameSettings.items)
		this.engine.configureMapItemPickups(gameSettings.gameMode?.itemEconomy.mapPickups ?? [])
		this.engine.loadEffects(gameSettings.effects)
		this.engine.loadTriggerDefinitions(gameSettings.triggerDefinitions ?? [])
		if (!("state" in gameSettings) && gameSettings.triggerDefinitions?.some(definition => "effects" in definition.effect) && !this.engine.getSystems().some(system => (system as ISerializableSystem).systemId === "core.transform")) {
			this.engine.addSystem(new TransformSystem())
		}

		// Player
		players.forEach((player) => this.addPlayer(createRuntimePlayer(player)))
		if (!("state" in gameSettings)) {
			this.engine.initializeFixedLoadouts()
			this.engine.initializeItemDraws()
			this.engine.startTurn({ phase: gameSettings.gameMode?.phases[0] ?? RulePhase.Physics, activeTeam: 0, turnNumber: 0, itemUses: 0 })
		}

		// Structures
		mapBoundarys.forEach(boundary => this.engine.addStructure(new FullStructure(boundary)))
		this.engine.restoreStructureLifecycles((gameSettings as EngineSettings).structureLifecycles)
		this.engine.restoreDeferredEffects((gameSettings as EngineSettings).deferredEffects)
		if (!("state" in gameSettings) && gameSettings.environmentalMechanics?.length) {
			this.engine.addSystem(new EnvironmentalSystem(gameSettings.environmentalMechanics, undefined, gameSettings.environmentalMechanics.map(mechanic => {
				if (!mechanic.structure.id) throw new Error(`Environmental Structure '${mechanic.id}' has no stable ID`);
				return mechanic.structure.id;
			})))
		}

		if ("state" in gameSettings) {
			this.state = gameSettings.state
			const ruleState = gameSettings.ruleState ?? { phase: RulePhase.Physics, activeTeam: gameSettings.activeTeam ?? 0, turnNumber: gameSettings.turnNumber, itemUses: 0 }
			this.engine.setRuleState(ruleState)
			this.engine.setTurnNumber(ruleState.turnNumber)
			this.engine.setActiveTeam(ruleState.activeTeam)
			this.engine.setMatchResult(gameSettings.matchResult)
			this.engine.restoreItemDraws(gameSettings.itemDrawState)
			this.engine.restoreMapItemPickups(gameSettings.itemPickupState)
			this.engine.restorePhysicsState(gameSettings.physicsState)
		}

		return this
			.addBackground(backgroundSettings)
			.setWorldSize(worldSize.x, worldSize.y)
	}

	public setWorldSize(x: number, y: number): this { this.engine.setWorldSize({ x, y }); return this }
	public setMyTeam(team: number[]) { this.engine.setMyTeam(team) }

	public build(): GameHandler { return this.engine.start(this.state) }
}
