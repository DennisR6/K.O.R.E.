import { SHAPE, type IPhysics, type PhysicsStrategy, type Vector2D } from "../physics/physics.js";
import { EntityManager } from "../entity/EntityManager.js";
import { PlaybackSystem } from "../systems/PlayBackSystem.js";
import type { IDrawer, ITicker, RenderContext } from "./RenderContext.js";
import { GameState } from "./types.js";
import type { EngineSettings, IInput, IMouse, ISettingsSerialize, ItemDrawState, TurnPacket } from "./types.js"
import type { IGameContext, ISerializableSystem, ISystem } from "../systems/types.js";
import { createSystemFromSettings, validateSystemSettingsList } from "../systems/systemSettings.js";
import { defaultPhysics } from "../physics/defaultPhysics.js";
import { DEFAULT_DRIFT, GameSettings, type FrictionSettings, validateDrift, validateFigureCounts } from "../settings/settings.js"
import type { IStructure } from "../structures/types.js";
import type { IEntity } from "../entity/Entity.js";
import type { IBackground } from "../ui/types.js";
import { Player } from "../entity/Player.js";
import { FullStructure } from "../structures/fullStructure.js";
import type { UUID } from "crypto";
import { EffectTrigger, type Effect, type FullEffectSettings } from "../effects/types.js";
import { MetaEffect } from "../effects/effects.js";
import { GameStateManager } from "../systems/GameStateManager.js";
import { getBackgoundSystem } from "../ui/Background.js";
import { PhysicsSystem } from "../systems/PhysicsSystem.js";
import { BoundarySystem } from "../systems/BoundarySystem.js";
import { MatchStatus, RulePhase, validateItemEconomySettings, type RuleState } from "../rules/types.js";
import { RuleInterpreter } from "../rules/RuleInterpreter.js";
import { currentTurnMode } from "../rules/defaultGameModes.js";
import type { MatchResult } from "../rules/types.js";
import { addDrawnInventoryItem, createFixedLoadoutInventory } from "../item/inventory.js";
import { MapPickupSystem } from "../item/MapPickupSystem.js";
import { validateItemDocument, type ItemDocument, type ItemPickup, type ItemPickupState } from "../item/types.js";
import { SeededRandom } from "../utils/random.js";
import { validateItemTarget } from "../item/target.js";
import type { AiSettings } from "../ai/types.js";
import type { IAiTurnProducer } from "../ai/aiEmitter.js";
import { EasyAi } from "../ai/easyAi.js";
import { MediumAi } from "../ai/mediumAi.js";
import { HardAi } from "../ai/hardAi.js";
import { AuthoritativeGameplayRenderer, type AuthoritativeGameplaySnapshot } from "../ui/AuthoritativeGameplayRenderer.js";

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
	private logs: any[] = []
	private team: number[] = []
	private effectAlways: Effect[] = []
	private effectRound: Effect[] = []
	private effectCollision: Effect[] = []
	private items: ItemDocument[] = []
	private itemDrawRandom: SeededRandom | undefined
	private mapPickupSystem = new MapPickupSystem()
	private readonly gameplayRenderer = new AuthoritativeGameplayRenderer(this)
	private ruleState: RuleState = { phase: RulePhase.Physics, activeTeam: 0, turnNumber: 0, itemUses: 0 }
	private matchResult: MatchResult | undefined
	private disposed = false
	/** True while `resolveTurn` is resolving the accepted turn's final state. */
	private resolvingTurn = false
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
			finishMatch: (result) => this.finishMatch(result),
		}
		this.entityManager = em;
		this.physicsStrategy = new defaultPhysics();
	}

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
	public simulateTurn(actorId: string, angle: number, power: number): TurnPacket {
		if (this.context.state === GameState.Game_over) throw new Error("A completed match cannot simulate further turns")
		const settings = JSON.parse(JSON.stringify(this.toSettings()))
		const g = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build()
		return g.resolveTurn({ actorId, angle, power })
	}

	/** Resolves and commits one turn on this handler. Use this on the authoritative server. */
	public resolveTurn({ actorId, angle, power }: IInput): TurnPacket {
		if (this.context.state === GameState.Game_over) throw new Error("A completed match cannot resolve further turns")
		const actor = this.entityManager.getEntityById(actorId)
		if (!actor) throw new Error(`Actor ${actorId} not found`);
		if (actor.isDead()) throw new Error(`Actor ${actorId} is not active`);
		this.physicsStrategy.applyImpulse(actor, angle, power);
		// The resolution loop is part of the accepted turn: the completion gate
		// must not freeze it even if a gameplay system completes the match
		// mid-loop (the deciding tick already stored the result).
		this.resolvingTurn = true;
		let frames = 0;
		try {
			for (; !this.physicsStrategy.isStatic(this.entityManager) && frames < 1200; frames++) this.tick()
		} finally {
			this.resolvingTurn = false;
		}
		const finalState = this.entityManager.serialize();
		return {
			actorId,
			input: { angle, power },
			durationFrames: frames,
			finalState,
		};
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
		this.setState(GameState.Playing)

		const actor = this.entityManager.getEntityById(packet.actorId);
		if (!actor) throw new Error("actor not found!")
		this.getPhysics().applyImpulse(actor, packet.input.angle, packet.input.power);

		const playback = this.systems.find(s => s instanceof PlaybackSystem) as PlaybackSystem;
		if (!playback) throw new Error("playbacksystem not found!")
		playback.start(packet.durationFrames, packet.finalState, () => {
			// A terminal match state set by gameplay systems during the final
			// tick (e.g. WinningSystem) must survive the playback completion.
			if (this.context.state !== GameState.Game_over) {
				this.setState(GameState.Playing_done)
			}
			onComplete?.()
			console.log("done")
		});
	}


	public applyRawTurn({ actorId, angle, power }: IInput) {
		if (this.context.state === GameState.Game_over) throw new Error("A completed match cannot accept raw turns")
		const actor = this.entityManager.getEntityById(actorId);
		if (!actor) { console.log("Player not Found"); return }
		this.physicsStrategy.applyImpulse(actor, angle, power);
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
		for (const e of this.entityManager.getEntities()) { this.effectAlways.forEach(eff => { eff.apply(e) }) }
		const drift = this.settings?.drift ?? DEFAULT_DRIFT
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
		if (this.context.state !== GameState.Starting && this.context.state !== GameState.Your_turn && this.context.state !== GameState.Game_over) return
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
		if (this.context.state !== GameState.Your_turn) return
		this.mouseHandler?.handleMouseReleased()
	}

	public handleMouseWheel(event: WheelEvent): void {
		if (this.disposed) return
		this.mouseHandler?.handleMouseWheel(event);
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
	public getPhysics(): PhysicsStrategy { return this.physicsStrategy }
	public setWorldSize(worldSize: Vector2D): void { this.context.worldSize = { ...worldSize } }
	public setTurnNumber(turnNumber: number): void {
		if (this.context.currTurn !== turnNumber) this.entityManager.getEntities().forEach(entity => entity.resetItemUses())
		this.context.currTurn = turnNumber
		this.ruleState.turnNumber = turnNumber
	}
	public getTurnNumber(): number { return this.context.currTurn }
	public setActiveTeam(team: number): void {
		if (!Number.isInteger(team) || team < 0) throw new Error("Active team must be a non-negative integer")
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
		this.initializeFixedLoadouts()
		this.context.structures = settings.mapBoundarys.map(boundary => new FullStructure(boundary))
		this.setPhysics(new defaultPhysics(settings.friction))
		this.setWorldSize(settings.screenResolution)
		this.setMyTeam(settings.myTeam)
		this.setTeamSize(settings.allTeamSize)
		this.setItems(settings.items)
		this.loadEffects(settings.effects)
		this.initializeItemDraws()
		this.resetMapItemPickups()
		const initialPhase = settings.gameMode?.phases?.[0] ?? RulePhase.Physics
		this.startTurn({ phase: initialPhase, activeTeam: 0, turnNumber: 0, itemUses: 0 })
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
	public getActiveTeam(): number { return this.context.activeTeam }
	public start(state?: GameState): this { this.context.state = state ?? GameState.Your_turn; return this }
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
	public addLog(log: any) { this.logs.push(log) }

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
			minPlayers: this.settings?.minPlayers ?? 0,
			maxPlayers: this.settings?.maxPlayers ?? 0,
			allTeamSize: this.teamSize,
			playerCount: this.settings?.playerCount ?? 1,
			figuresPerPlayer: this.settings?.figuresPerPlayer ?? Math.max(1, this.entityManager.getEntities().length),
			...(this.settings?.gameMode ? { gameMode: JSON.parse(JSON.stringify(this.settings.gameMode)) } : {}),
			...(this.settings?.ai ? { ai: JSON.parse(JSON.stringify(this.settings.ai)) } : {}),
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
	public setTeamSize(size: number): void { this.teamSize = size }
	public setItems(items: ItemDocument[]): void {
		items.forEach(validateItemDocument)
		this.items = structuredClone(items)
	}
	public configureMapItemPickups(pickups: ItemPickup[]): void { this.mapPickupSystem.configure(pickups, this.items) }
	/** Produces the complete detached state consumed by the gameplay renderer. */
	public getAuthoritativeRenderState(): AuthoritativeGameplaySnapshot {
		return {
			gameState: this.getState(),
			ruleState: this.getRuleState(),
			matchResult: this.getMatchResult(),
			structures: this.context.structures.map(structure => structure.toSettings()),
			players: this.entityManager.toSettings(),
			pickups: this.mapPickupSystem.getPickups(),
			pickupState: this.mapPickupSystem.toState(),
		}
	}
	public restoreMapItemPickups(state: ItemPickupState | undefined): void { this.mapPickupSystem.restore(state) }
	public resetMapItemPickups(): void { this.mapPickupSystem.reset() }
	/** Consumes a declared item without applying its effects or validating targets. */
	public useItem(actorId: string, itemId: string, target: unknown = { type: "self" }): void {
		const actor = this.entityManager.getEntityById(actorId)
		if (!actor) throw new Error(`Actor ${actorId} not found`)
		const item = this.items.find(candidate => candidate.id === itemId)
		if (!item) throw new Error(`Item '${itemId}' is not declared for this game`)
		validateItemTarget(item, target, { actor, entities: this.entityManager.getEntities(), worldSize: this.context.worldSize })
		actor.use(item)
	}
	public loadEffects(effects: FullEffectSettings[]): void {
		this.effectAlways = []
		this.effectRound = []
		this.effectCollision = []
		for (const effect of effects) {
			switch (effect.trigger) {
				case EffectTrigger.Always: this.effectAlways.push(new MetaEffect(effect)); break
				case EffectTrigger.Round: this.effectRound.push(new MetaEffect(effect)); break
				case EffectTrigger.Collision: this.effectCollision.push(new MetaEffect(effect)); break
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

		this
			.addPhysics(physics)
			.addSystem(new PlaybackSystem())
			.addSystem(new PhysicsSystem(physics))
			.addSystem(new BoundarySystem())
			.addSystem(new GameStateManager())
		return this
	}

	public fromSettings(gameSettings: EngineSettings | GameSettings): this {
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
		this.engine.setPhysics(new defaultPhysics(gameSettings.friction))
		const snapshot = gameSettings as EngineSettings
		if (snapshot.systems !== undefined || snapshot.systemOrder !== undefined) {
			validateSystemSettingsList(snapshot.systems, snapshot.systemOrder)
			const systemSettings = snapshot.systems as import("../systems/types.js").SystemSettings[]
			const systemOrder = snapshot.systemOrder as string[]
			const byId = new Map(systemSettings.map(system => [system.systemId, system]))
			const restored = new Map<string, ISerializableSystem>()
			for (const id of systemSettings.map(system => system.systemId).filter(id => id !== "ui.direction-arrow" && id !== "core.simulator")) restored.set(id, createSystemFromSettings(byId.get(id)!, restored))
			if (byId.has("core.simulator")) restored.set("core.simulator", createSystemFromSettings(byId.get("core.simulator")!, restored))
			if (byId.has("ui.direction-arrow")) restored.set("ui.direction-arrow", createSystemFromSettings(byId.get("ui.direction-arrow")!, restored))
			this.engine.replaceSystems(systemOrder.map(id => restored.get(id)!))
			const restoredPhysics = this.engine.getSystems().find(system => (system as ISerializableSystem).systemId === "core.physics") as PhysicsSystem | undefined
			if (!restoredPhysics) throw new Error("System snapshot must include core.physics")
			restoredPhysics.strategy = this.engine.getPhysics()
		}

		// Adding Background
		let backgroundSettings: IBackground = getBackgoundSystem(background)

		//add Team
		this.engine.setMyTeam(myTeam ?? [crypto.randomUUID()])
		this.engine.setTeamSize(gameSettings.allTeamSize)
		this.engine.setItems(gameSettings.items)
		this.engine.configureMapItemPickups(gameSettings.gameMode?.itemEconomy.mapPickups ?? [])
		this.engine.loadEffects(gameSettings.effects)

		// Player
		players.forEach((player) => this.addPlayer(new Player(player)))
		if (!("state" in gameSettings)) {
			this.engine.initializeFixedLoadouts()
			this.engine.initializeItemDraws()
			this.engine.startTurn({ phase: gameSettings.gameMode?.phases[0] ?? RulePhase.Physics, activeTeam: 0, turnNumber: 0, itemUses: 0 })
		}

		// Structures
		mapBoundarys.forEach(boundary => this.engine.addStructure(new FullStructure(boundary)))

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
