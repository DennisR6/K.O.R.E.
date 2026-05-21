import { type PhysicsStrategy } from "../physics/physics";
import { EntityManager } from "../entity/EntityManager";
import { PhysicsSystem } from "../systems/PhysicsSystem";
import { PlaybackSystem } from "../systems/PlayBackSystem";
import type { IDrawer, ITicker, RenderContext } from "./RenderContext";
import { createDefaultContext, GameState } from "./types";
import type { GameStateType, HandlerDependencies, IInputEmitter, IMouse, IMouseHandler, TurnPacket } from "./types.ts"
import type { IGameContext, ISystem } from "../systems/types.ts";
import { defaultPhysics } from "../physics/defaultPhysics.ts";
import { GameLogger } from "../utils/log.ts";
import type { IStructure } from "../structures/structures.ts";
import { Simulator } from "../systems/Simulator.ts";

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
export type Override = Partial<HandlerDependencies>;
export const createTestHandler = (overrides: Override = {}) => {
	const physicsStrategy = new defaultPhysics()
	const em = new EntityManager([])
	const defaultDependencies: HandlerDependencies = {
		context: createDefaultContext(),
		entityManager: em,
		physicsStrategy,
		inputEmitter: { sendShot: () => { } },
		systems: [new PhysicsSystem(physicsStrategy), new PlaybackSystem()],
		dt: 1,
	};

	const handler = new GameHandler(
		createDefaultContext({ entities: em, state: GameState.STARTING, ...overrides.context }),
		overrides.entityManager ?? defaultDependencies.entityManager,
		overrides.physicsStrategy ?? defaultDependencies.physicsStrategy,
		overrides.inputEmitter ?? defaultDependencies.inputEmitter,
		overrides.systems ?? defaultDependencies.systems,
		overrides.dt ?? defaultDependencies.dt,
	);
	return handler
};

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
export class GameHandler implements ITicker, IMouse {
	private context: IGameContext;
	private systems: ISystem[] = []; private entityManager: EntityManager;
	private physicsStrategy: PhysicsStrategy
	private lastTurnFinalState: any[] | null = null;
	//@ts-ignore
	private inputEmitter: IInputEmitter | undefined = undefined;
	private preTickers: ITicker[] = []
	private postTickers: ITicker[] = []
	private preDrawers: IDrawer[] = []
	private postDrawers: IDrawer[] = []
	private dt: number;
	private mouseHandler: IMouseHandler | undefined;

	/**
		 * Erzeugt eine neue Instanz der Engine.
		 * 
		 * @param context - Der "globale Wissensspeicher" (Status, Entities, Strukturen).
		 * @param entityManager - Die Verwaltungseinheit für alle Spielobjekte.
		 * @param physics - Die mathematischen Regeln für Bewegung und Kollision.
		 * @param emitter - Das Sprachrohr für Inputs (z.B. Schuss-Befehle an den Server).
		 * @param systems - Eine Liste von Modulen, die pro Tick laufen (z.B. Physik, Animation).
		 */
	constructor(
		context: IGameContext,
		entityManager: EntityManager,
		physics: PhysicsStrategy,
		emitter: IInputEmitter,
		systems: ISystem[] = [],
		dt: number,
	) {
		//@ts-ignore
		this.context = { state: GameState.STARTING }
		this.context = context;
		this.entityManager = entityManager;
		this.physicsStrategy = physics;
		this.inputEmitter = emitter;
		this.systems = systems;
		this.dt = dt
	}

	/**
	 * Tauscht die Physik-Regeln im laufenden Betrieb aus.
	 * Nützlich, wenn man z.B. von "Eis" (wenig Reibung) auf "Rasen" (viel Reibung) wechselt.
	 */
	setPhysics(strategy: PhysicsStrategy) {
		this.physicsStrategy = strategy;
	}


	/**
		 * Die "Glaskugel" der Engine: Berechnet einen kompletten Zug im Voraus.
		 * 
		 * Erstellt eine Kopie der aktuellen Welt und lässt die Physik so lange laufen, 
		 * bis alles wieder stillsteht. Der eigentliche Spielzustand bleibt unberührt.
		 * 
		 * @param actorId - Wer führt den Zug aus?
		 * @param angle - In welche Richtung wird geschossen?
		 * @param power - Wie stark ist der Stoß?
		 * @returns Ein "Ticket" (TurnPacket), das genau beschreibt, was passieren wird.
		 */
	public simulateTurn(actorId: string | number, angle: number, power: number): TurnPacket {
		const simulator = this.systems.find(x => x instanceof Simulator)
		if (simulator === undefined) throw new Error("No Simulation Engine added")
		this.setState(GameState.SIMULATING);
		const tempManager = this.entityManager.clone();

		const actor = tempManager.getEntityById(actorId);
		if (!actor) throw new Error(`Actor ${actorId} not found`);

		this.physicsStrategy.applyImpulse(actor, angle, power);

		const physSystem = this.systems.find(x => x instanceof PhysicsSystem)
		if (!physSystem) throw new Error("Kein Physik System installiert")

		const frameSteps = []
		let frames = 0;
		const mockContext = this.getContext()
		mockContext.entities = tempManager
		while (!simulator.isStatic(tempManager) && frames < 1200) {
			simulator.tick(mockContext, this.dt, this.physicsStrategy.getFriction());
			frames++;
			const finalState = tempManager.serialize();
			frameSteps.push(finalState)
		}

		const finalState = tempManager.serialize();
		this.setState(GameState.SIMULATING_DONE);
		// console.log(frameSteps)
		return {
			actorId,
			input: { angle, power },
			durationFrames: frames,
			finalState
		};
	}

	/**
		 * Führt den zuvor berechneten Zug visuell für den Spieler aus.
		 * 
		 * Nutzt das TurnPacket aus `simulateTurn`, um die Animation zu starten. 
		 * Hier sieht der Junior (und der Spieler) erst die Bewegung auf dem Bildschirm.
		 * 
		 * @param packet - Das Datenpaket aus der Simulation.
		 */
	public tickTurn(packet: TurnPacket): void {
		this.setState(GameState.PLAYING)

		const actor = this.entityManager.getEntityById(packet.actorId);
		if (actor) this.physicsStrategy.applyImpulse(actor, packet.input.angle, packet.input.power);

		const physSystem = this.systems.find(x => x instanceof PhysicsSystem)
		if (!physSystem) throw new Error("Kein Physik System installiert")

		const playback = this.systems.find(s => s instanceof PlaybackSystem) as PlaybackSystem;
		playback.start(packet.durationFrames, packet.finalState, () => {
			GameLogger.debug("Playing done")
			this.entityManager.resetSpeeds()
			this.setState(GameState.PLAYING_DONE)
		});
	}

	/**
		 * Beendet den aktuellen Zug sofort und erzwingt den Endzustand.
		 * 
		 * Diese Methode ist der "Hard-Reset":
		 * 1. Sie teleportiert alle Objekte sofort an ihre berechneten Endpositionen.
		 * 2. Sie stoppt alle laufenden Animationen im PlaybackSystem.
		 * 3. Sie setzt den GameState direkt auf PLAYING_DONE.
		 * 
		 * Nützlich für: "Animation überspringen" oder um sicherzustellen, dass 
		 * alle Clients exakt die gleichen Daten haben (Sync).
		 */
	public finalizeTurnManual(): void {
		if (this.lastTurnFinalState) {
			this.lastTurnFinalState.forEach(saved => {
				const entity = this.context.entities.getEntityById(saved.id)
				if (entity) {
					entity.setPos({ x: saved.x, y: saved.y });
					entity.setVel({ x: 0, y: 0 }); // Im Stillstand Vel auf 0
				}
			});
		}

		this.setState(GameState.PLAYING_DONE)

		const playback = this.systems.find(s => s instanceof PlaybackSystem) as PlaybackSystem;
		if (!playback) return
		playback.start(0, []);

		this.lastTurnFinalState = null;
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
		this.systems.forEach(s => s.tick(this.context, dt, this.physicsStrategy.getFriction()))
		this.context.structures.forEach(str => str.tick(dt, this.physicsStrategy.getFriction()))
		// this.entityManager.tick(dt, this.physicsStrategy.getFriction())
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
		renderer.drawText(this.context.state, renderer.WORLD_SIZE_X / 2 - 32 * 3, 32 * 2, 32)
		this.preDrawers.forEach(d => d.draw(renderer))
		this.context.structures.forEach(str => str.draw(renderer))
		// 2. Entities (Player/Pucks) zeichnen
		this.getEntityManager().getEntities().forEach(entity => {
			renderer.push()
			entity.draw(renderer);
			renderer.pop()
		});
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

	/**
	 * Registriert den Klick auf ein Objekt.
	 * Prüft, ob an der Mausposition eine Entity (z.B. ein Puck) liegt, 
	 * die man "ziehen" kann.
	 */
	public handleMousePressed(mouseX: number, mouseY: number) {
		// this.systems.filter(x => x instanceof )
		if (this.context.state !== GameState.YOUR_TURN) return;
		const e = this.entityManager.getEntityAt(mouseX, mouseY, 12)
		//@ts-ignore
		if (e) this.dragStart = { actorId: e.getId(), x: e.getPos().x, y: e.getPos().y };
	}

	/** Aktualisiert die aktuelle Mausposition für Berechnungen (z.B. die Vorschau-Linie). */
	public updateMouse(mouseX: number, mouseY: number) {
		this.mouseHandler?.updateMouse(mouseX, mouseY)
	}

	/**
		 * Schließt die Eingabe ab und feuert den Schuss ab.
		 * Wandelt die Zieh-Bewegung in ein Input-Paket um und sendet es an den Server/Emitter.
		 */
	public handleMouseReleased() { this.mouseHandler?.handleMouseReleased() }
	public handleMouseWheel(event: WheelEvent): void { this.mouseHandler?.handleMouseWheel(event) }

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

	public setState(state: GameStateType): void {
		GameLogger.debug(this.getState(), state)
		this.context.state = state
	}

	public getState(): GameStateType { return this.context.state }
	public setEmitter(emitter: IInputEmitter) { this.inputEmitter = emitter; }
	public getPhysics(): PhysicsStrategy { return this.physicsStrategy }
	public start(state?: GameStateType) { this.context.state = state ?? GameState.YOUR_TURN }
	public addStructure(structure: IStructure) { this.context.structures.push(structure) }
	public setMouseHandler(mouseHandler: IMouseHandler | undefined): void { this.mouseHandler = mouseHandler }
}
