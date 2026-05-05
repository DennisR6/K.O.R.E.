import { type PhysicsStrategy } from "../physics/physics";
import { EntityManager } from "../entity/EntityManager";
import { PhysicsSystem } from "../systems/PhysicsSystem";
import { PlaybackSystem } from "../systems/PlayBackSystem";
import type { IDrawer, IRenderer, RenderContext } from "./RenderContext";
import { createDefaultContext, GameState } from "./types";
import type { GameStateType, HandlerDependencies, IInputEmitter, IMouse, ISimulator, TurnPacket } from "./types.ts"
import type { IGameContext, ISystem } from "../systems/types.ts";
import { defaultPhysics } from "../physics/defaultPhysics.ts";
import { GameLogger } from "../utils/log.ts";


export type Override = Partial<HandlerDependencies>;
export const createTestHandler = (overrides: Override = {}) => {
	const physicsStrategy = new defaultPhysics()
	const em = new EntityManager([])
	const defaultDependencies: HandlerDependencies = {
		context: createDefaultContext({ entities: em, state: GameState.STARTING }),
		entityManager: em,
		physicsStrategy,
		inputEmitter: { sendShot: () => { } },
		systems: [new PhysicsSystem(physicsStrategy), new PlaybackSystem()],
	};

	const handler = new GameHandler(
		overrides.context ?? defaultDependencies.context,
		overrides.entityManager ?? defaultDependencies.entityManager,
		overrides.physicsStrategy ?? defaultDependencies.physicsStrategy,
		overrides.inputEmitter ?? defaultDependencies.inputEmitter,
		overrides.systems ?? defaultDependencies.systems,
	);
	return handler
};
export class GameHandler implements IRenderer, IMouse {
	private context: IGameContext;
	private systems: ISystem[] = []; private entityManager: EntityManager;
	private physicsStrategy: PhysicsStrategy
	private simulator: ISimulator | undefined
	private lastTurnFinalState: any[] | null = null;
	private dragStart: { x: number, y: number, actorId: string | number } | null = null;
	private currentMouse: { x: number, y: number } = { x: 0, y: 0 };
	private inputEmitter: IInputEmitter | undefined = undefined;
	private preTickers: IRenderer[] = []
	private postTickers: IRenderer[] = []
	private preDrawers: IDrawer[] = []
	private postDrawers: IDrawer[] = []


	constructor(
		context: IGameContext,
		entityManager: EntityManager,
		physics: PhysicsStrategy,
		emitter: IInputEmitter,
		systems: ISystem[] = []
	) {
		//@ts-ignore
		this.context = { state: GameState.STARTING }
		this.context = context;
		this.entityManager = entityManager;
		this.physicsStrategy = physics;
		this.inputEmitter = emitter;
		this.systems = systems;
	}

	setPhysics(strategy: PhysicsStrategy) {
		this.physicsStrategy = strategy;
	}
	setSimulator(strategy: ISimulator) {
		if (!this.physicsStrategy)
			return new Error("Physics Strategy not defined")
		this.simulator = strategy;
	}

	/*EntitySnapshot*
	 * Schaut in die Zukunft: Erzeugt ein Ticket (TurnPacket)
	 * für einen geplanten Zug, ohne den aktuellen Zustand zu verändern.
	 */
	public simulateTurn(actorId: string | number, angle: number, power: number): TurnPacket {
		this.setState(GameState.SIMULATING);
		const tempManager = this.entityManager.clone();

		const actor = tempManager.getEntityById(actorId);
		if (!actor) throw new Error(`Actor ${actorId} not found`);

		this.physicsStrategy.applyImpulse(actor, angle, power);

		const physSystem = this.systems.find(x => x instanceof PhysicsSystem)
		if (!physSystem) throw new Error("Kein Physik System installiert")

		let frames = 0;
		while (!this.simulator!.isStatic(tempManager) && frames < 1200) {
			this.simulator!.step(physSystem, 1, tempManager, this.context.structures);
			frames++;
		}

		const finalState = tempManager.serialize();
		this.setState(GameState.SIMULATING_DONE);

		return {
			actorId,
			input: { angle, power },
			durationFrames: frames,
			finalState
		};
	}
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

	public getContext(): IGameContext {
		return this.context;
	}
	public finalizeTurnManual(): void {
		// 1. Hard-Sync sofort ausführen
		if (this.lastTurnFinalState) {
			this.lastTurnFinalState.forEach(saved => {
				const entity = this.context.entities.getEntityById(saved.id)
				if (entity) {
					entity.setPos({ x: saved.x, y: saved.y });
					entity.setVel({ x: 0, y: 0 }); // Im Stillstand Vel auf 0
				}
			});
		}

		// 2. Status sauber setzen
		this.setState(GameState.PLAYING_DONE)

		// 3. PlaybackSystem "resetten"
		const playback = this.systems.find(s => s instanceof PlaybackSystem) as PlaybackSystem;
		if (playback) {
			playback.start(0, []);
		}

		this.lastTurnFinalState = null;
	}
	public update(dt: number) {
		this.preTickers.forEach(t => t.update(dt, this.physicsStrategy.getFriction()));
		this.systems.forEach(s => s.update(this.context, dt, this.physicsStrategy.getFriction()))
		// this.entityManager.update(dt, this.physicsStrategy.getFriction())
		this.postTickers.forEach(t => t.update(dt, this.physicsStrategy.getFriction()));
	}
	/**
	 * Zeichnet alle Objekte in der Spielwelt (Pucks, Hindernisse, etc.)
	 * Wird meistens innerhalb von p.push() / p.scale() aufgerufen.
	 */
	public drawWorld(renderer: RenderContext): void {
		renderer.clear()
		this.preDrawers.forEach(d => d.draw(renderer))
		// 2. Entities (Player/Pucks) zeichnen
		this.getEntityManager().getEntities().forEach(entity => {
			renderer.push()
			entity.draw(renderer);
			renderer.pop()
		});
		this.postDrawers.forEach(d => d.draw(renderer))
	}

	/**
	 * Zeichnet Interface-Elemente, die nicht mitskalieren sollen 
	 * (z.B. die Schuss-Vorschau oder Texte)
	 */
	public drawUI(renderer: RenderContext) {
		renderer.drawText(this.context.state, renderer.WORLD_SIZE_X / 2 - 32 * 3, 32 * 2, 32)
		if (this.context.state != GameState.YOUR_TURN) return
		renderer.push()
		const input = this.getLocalInput();
		if (this.dragStart && input) {
			const actor = this.entityManager.getEntityById(input.actorId)
			if (!actor) throw new Error("Kein Spieler gefunden!")
			const res = this.physicsStrategy.calculateStopFromInput(actor.getPos(), input.angle, input.power)
			renderer.line(this.dragStart.x, this.dragStart.y, res.x, res.y);
			renderer.drawText(`${Math.round(input.angle)}°`, res.x, res.y);
		}
		renderer.pop()
	}

	public handleMousePressed(mouseX: number, mouseY: number) {
		if (this.context.state !== GameState.YOUR_TURN) return;
		const e = this.entityManager.getEntityAt(mouseX, mouseY, 12)
		if (e) this.dragStart = { actorId: e.getId(), x: e.getPos().x, y: e.getPos().y };
	}

	public updateMouse(mouseX: number, mouseY: number) {
		this.currentMouse = { x: mouseX, y: mouseY };
	}

	public handleMouseReleased() {
		const input = this.getLocalInput();

		if (input && this.inputEmitter && this.dragStart) {
			this.inputEmitter.sendShot(input.actorId, input.angle, input.power);
		}
		this.dragStart = null;

		return input;
	}

	public getLocalInput(): { actorId: string | number, angle: number, power: number } | null {
		if (!this.dragStart || !this.currentMouse) return null;

		const dx = this.currentMouse.x - this.dragStart.x;
		const dy = this.currentMouse.y - this.dragStart.y;

		const rawPower = Math.sqrt(dx * dx + dy * dy);
		if (rawPower < 5) return null;

		const maxDrag = 200;
		let power = (rawPower / maxDrag) * 10;
		power = Math.min(power, 100);

		let angleRad = Math.atan2(dy, dx);
		let angleDeg = angleRad * (180 / Math.PI);

		let finalAngle = angleDeg + 180;

		finalAngle = ((finalAngle % 360) + 360) % 360;

		return {
			actorId: this.dragStart.actorId,
			angle: finalAngle,
			power: power
		};
	}

	public addSystem(system: ISystem) {
		this.systems.push(system)
	}
	public getEntityManager(): EntityManager {
		return this.entityManager
	}
	public addPreTicker(ticker: IRenderer) {
		this.preTickers.push(ticker);
	}

	public addPostTicker(ticker: IRenderer) {
		this.postTickers.push(ticker);
	}

	public rmPreTicker(ticker: IRenderer) {
		this.preTickers = this.preTickers.filter(t => t !== ticker);
	}
	public rmPostTicker(ticker: IRenderer) {
		this.postTickers = this.postTickers.filter(t => t !== ticker);
	}
	// --- GRAFIK (Draw) ---

	public addPreDrawer(drawer: IDrawer) {
		this.preDrawers.push(drawer);
	}

	public addPostDrawer(drawer: IDrawer) {
		this.postDrawers.push(drawer);
	}
	public rmPreDrawer(drawer: IDrawer) {
		this.preDrawers = this.preDrawers.filter(d => d !== drawer);
	}
	public rmPostDrawer(drawer: IDrawer) {
		this.postDrawers = this.postDrawers.filter(d => d !== drawer);
	}

	// --- Alles ---
	public addPreTickAndDraw(item: IDrawer & IRenderer) {
		this.addPreTicker(item)
		this.addPreDrawer(item)
	}
	public addPostTickAndDraw(item: IDrawer & IRenderer) {
		this.addPostTicker(item)
		this.addPostDrawer(item)
	}
	public rmPreTickAndDraw(item: IDrawer & IRenderer) {
		this.rmPreTicker(item)
		this.rmPreDrawer(item)
	}
	public rmPostTickAndDraw(item: IDrawer & IRenderer) {
		this.rmPostTicker(item)
		this.rmPostDrawer(item)
	}
	public setState(state: GameStateType): void {
		GameLogger.debug(this.getState(), state)
		this.context.state = state
	}
	public getState(): GameStateType {
		return this.context.state
	}
	public setEmitter(emitter: IInputEmitter) {
		this.inputEmitter = emitter;
	}
	public start(state?: GameStateType) {
		this.context.state = state ?? GameState.YOUR_TURN
	}
	public getPhysics(): PhysicsStrategy {
		return this.physicsStrategy
	}

}
