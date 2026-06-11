import { SHAPE, type IPhysics, type PhysicsStrategy, type Vector2D } from "../physics/physics.js";
import { EntityManager } from "../entity/EntityManager.js";
import { PlaybackSystem } from "../systems/PlayBackSystem.js";
import type { IDrawer, ITicker, RenderContext } from "./RenderContext.js";
import { GameState, getEngineStateName } from "./types.js";
import type { EngineSettings, IInput, IMouse, ISettingsSerialize, TurnPacket } from "./types.js"
import type { IGameContext, ISystem } from "../systems/types.js";
import { defaultPhysics } from "../physics/defaultPhysics.js";
import { GameSettings, type FrictionSettings } from "../settings/settings.js"
import { RoundPlayerSystem } from "../systems/RoundSystem.js"; import { getBackgoundSystem } from "../ui/Background.js";
import { Mouse } from "../ui/Mouse.js";
import type { IStructure } from "../structures/types.js";
import type { IEntity } from "../entity/Entity.js";
import type { IBackground } from "../ui/types.js";
import { Player } from "../entity/Player.js";
import { FullStructure } from "../structures/fullStructure.js";
import type { UUID } from "crypto";
import { EffectTrigger, type Effect } from "../effects/types.js";
import { MetaEffect } from "../effects/effects.js";
import { GameStateManager } from "../systems/GameStateManager.js";

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
	private teamSize = 2
	private id: UUID
	private turns: TurnPacket[] = []
	private settings: any
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
			mouse: {
				start: { x: 0, y: 0 },
				now: { x: 0, y: 0 },
				end: { x: 0, y: 0 },
				pressed: false,
				released: false,
			},
			physics: new defaultPhysics(),
			currTurn: 0,
			myTeamNumber: 0,
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
		const settings = this.toSettings()
		this.setState(GameState.Simulating);
		const g = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build()
		const actor = g.getEntityManager().getEntityById(actorId)
		if (!actor) throw new Error(`Actor ${actorId} not found`);
		g.physicsStrategy.applyImpulse(actor, angle, power);
		let frames = 0;
		while (!this.physicsStrategy.isStatic(g.getEntityManager()) && frames < 1200) {
			g.tick()
			frames++;
		}
		const finalState = g.getEntityManager().serialize();
		this.setState(GameState.Simulating_done);
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
	public tickTurn(packet: TurnPacket): void {
		this.turns.push(packet)
		this.setState(GameState.Playing)
		const actor = this.entityManager.getEntityById(packet.actorId);
		if (actor) this.getPhysics().applyImpulse(actor, packet.input.angle, packet.input.power);

		const playback = this.systems.find(s => s instanceof PlaybackSystem) as PlaybackSystem;
		if (!playback) return
		playback.start(packet.durationFrames, packet.finalState, () => {
			this.setState(GameState.Playing_done)
		});
	}


	public applyRawTurn({ actorId, angle, power }: IInput) {
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
		this.preTickers.forEach(t => t.tick(dt, this.physicsStrategy.getFriction()));
		for (const e of this.entityManager.getEntities()) { this.effectAlways.forEach(eff => { eff.apply(e) }) }
		for (const e of this.entityManager.getEntities()) { e.tick(dt, this.physicsStrategy.getFriction()) }
		this.systems.forEach(s => s.ticker(this.context, dt, this.physicsStrategy.getFriction()))
		this.context.structures.forEach(str => str.tick(dt, this.physicsStrategy.getFriction()))
		this.postTickers.forEach(t => t.tick(dt, this.physicsStrategy.getFriction()));
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
		renderer.clear()
		renderer.drawText(getEngineStateName(this.context.state), renderer.WORLD_SIZE_X / 2 - 32 * 3, 32 * 2, 32)
		this.preDrawers.forEach(d => d.draw(renderer))
		this.context.structures.forEach(str => str.draw(renderer))
		// 2. Entities (Player/Pucks) zeichnen
		this.getEntityManager().getEntities().forEach(entity => {
			renderer.push()
			entity.draw(renderer);
			renderer.pop()
		});
		this.drawUI(renderer)
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
		// renderer.drawText(getEngineStateName(this.context.state), renderer.WORLD_SIZE_X / 2, renderer.WORLD_SIZE_Y / 2, 32)
		if (this.context.state != GameState.Your_turn && this.context.state != GameState.Opponents_turn) return
	}

	/**
	 * Registriert den Klick auf ein Objekt.
	 * Prüft, ob an der Mausposition eine Entity (z.B. ein Puck) liegt, 
	 * die man "ziehen" kann.
	 */
	public handleMousePressed(x: number, y: number) {
		this.context.mouse.start = { x, y }
		this.context.mouse.pressed = true
		this.mouseHandler?.handleMousePressed(x, y)
	}
	/** Aktualisiert die aktuelle Mausposition für Berechnungen (z.B. die Vorschau-Linie). */
	public updateMouse(x: number, y: number) {
		this.context.mouse.end = { x, y }
		this.mouseHandler?.updateMouse(x, y)
	}
	/**
		 * Schließt die Eingabe ab und feuert den Schuss ab.
		 * Wandelt die Zieh-Bewegung in ein Input-Paket um und sendet es an den Server/Emitter.
		 */
	public handleMouseReleased() {
		this.context.mouse.released = true
		this.mouseHandler?.handleMouseReleased()
	}
	public handleMouseWheel(event: WheelEvent): void {
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
	public getEntityManager(): EntityManager { return this.entityManager }

	public setState(state: GameState): void {
		// console.info(`${getEngineStateName(this.getState())} -> ${getEngineStateName(state)}`)
		this.context.state = state
	}

	public getState(): GameState { return this.context.state }
	public getPhysics(): PhysicsStrategy { return this.physicsStrategy }
	public start(state?: GameState): this { this.context.state = state ?? GameState.Your_turn; return this }
	public addStructure(structure: IStructure | IStructure & IPhysics<SHAPE>) {
		this.context.structures.push(structure)
		// if ("getShape" in structure) this.physicsStrategy.addToQueue(PhysicsLevel.Map, structure)
	}
	public setMouseHandler(mouseHandler: IMouse): void { this.mouseHandler = mouseHandler }
	public getMouseHandler() { return this.mouseHandler }

	public setTickRate(tickRate: number) { this.dt = tickRate } public getCurrentMousePosition(): Vector2D { return { x: 0, y: 0 } }
	public setCurrentMousePosition(_pos: Vector2D): void { }
	public saveSettings(settings: any) { this.settings = settings }
	public getSettings(): GameSettings { return this.settings }
	public exportGame(): { logs: TurnPacket[], settings: Partial<GameSettings> | any } { return { logs: this.turns, settings: JSON.stringify(this.settings) } }
	public addLog(log: any) { this.logs.push(log) }

	public serialize(): string { return JSON.stringify(this) }
	public deserialize(_: string): GameHandler {
		// const state = JSON.parse(input)
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(GameSettings).build()
		// for (const key of Object.keys(state)) {
		// 	//@ts-ignore
		// 	handler[key] = state[key]
		// }
		return handler
	}
	public getGameId(): UUID {
		return this.id
	}
	public toSettings(): EngineSettings {
		return {
			state: this.getState(),
			background: { color: "white", type: "color" },
			friction: this.getPhysics().toSettings(),
			id: this.getGameId(),
			mapBoundarys: [],
			screenResolution: this.getContext().worldSize,
			myTeam: this.team,
			allTeams: [],
			effects: [],
			items: [],
			players: this.entityManager.toSettings(),
			minPlayers: this.settings?.minPlayers ?? 0,
			maxPlayers: this.settings?.maxPlayers ?? 0,
			allTeamSize: this.teamSize,
			turnNumber: this.getContext().currTurn
		}
	}
	public getTeam(): number[] { return this.team }
	public setId(id: UUID) { this.id = id }
	public getId(): string { return this.id }
	public setMyTeam(team: number[]) { this.team = team }
	public addEffectEveryTick(effect: Effect): void { this.effectAlways.push(effect) }
	public addEffectEveryRound(effect: Effect): void { this.effectRound.push(effect) }
	public addEffectEveryCollision(effect: Effect): void { this.effectCollision.push(effect) }
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
	public addPlayer(player: IEntity): this {
		this.engine.getEntityManager().addEntity(player);
		return this
	}
	public addStructure(structure: IStructure | IStructure & IPhysics<SHAPE>): this {
		if (structure) this.engine.addStructure(structure);
		return this
	}
	public addBackground(background: IBackground): this { this.engine.addPreTickAndDraw(background); return this }
	public setPlayerTeam(teams: number[]): this { teams.forEach(team => this.myTeam.push(team)); return this }
	public setOpponentTeam(teams: number[]): this { teams.forEach(team => this.enemyTeam.push(team)); return this }
	public addPhysics(physics: PhysicsStrategy) { this.engine.setPhysics(physics); return this }
	public defaultSystems(friction?: FrictionSettings): this {
		const physics = new defaultPhysics(friction)

		this
			.addPhysics(physics)
			.addSystem(new PlaybackSystem())
			.addSystem(new GameStateManager())
		// .addSystem(new PhysicsSystem(physics))
		return this
	}

	public fromSettings(gameSettings: EngineSettings | GameSettings): this {
		this.engine.saveSettings(gameSettings)
		const { screenResolution, background, myTeam, mapBoundarys, players } = gameSettings
		this.engine.setId(gameSettings.id)
		//@ts-ignore
		this.engine.context.worldSize = gameSettings.screenResolution
		if ("state" in gameSettings) this.state = gameSettings.state
		this.setWorldSize(screenResolution.x, screenResolution.y)
		// Adding Background
		let backgroundSettings: IBackground = getBackgoundSystem(background)

		//add Team
		this.engine.setMyTeam(myTeam ?? [crypto.randomUUID()])
		// Add Mouse
		const mouseHandler = new Mouse()
		this.addSystem(mouseHandler)
		this.engine.setMouseHandler(mouseHandler)
		this.engine.addPostDrawer(mouseHandler)
		this.engine.getContext().currTurn = gameSettings.turn ?? 2
		for (const eff of gameSettings.effects) {
			switch (eff.trigger) {
				case EffectTrigger.Always: this.engine.addEffectEveryTick(new MetaEffect(eff)); break
				case EffectTrigger.Round: this.engine.addEffectEveryRound(new MetaEffect(eff)); break
				case EffectTrigger.Collision: this.engine.addEffectEveryCollision(new MetaEffect(eff)); break
			}
		}

		// Player
		players.forEach((player) => this.addPlayer(new Player().new({ ...player })))
		// Structures
		mapBoundarys.forEach(boundary => {
			const str = new FullStructure(boundary)
			this.engine.addStructure(str)
			// if (str.isPhysicsObj()) this.engine.getPhysics().addToQueue(PhysicsLevel.Map, str)

		})

		return this
			.addSystem(new RoundPlayerSystem(new Array(gameSettings.allTeamSize)))
			.addBackground(backgroundSettings)
			.setWorldSize(screenResolution.x, screenResolution.y)
			.addUIMouse(mouseHandler)
	}

	public setWorldSize(x: number, y: number): this { this.engine.getContext().worldSize = { x, y }; return this }
	public setMyTeam(team: number[]) { this.engine.setMyTeam(team) }

	public build(): GameHandler { return this.engine.start(this.state) }
}
