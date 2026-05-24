import type { IDrawer, RenderContext } from "../engine/RenderContext.js";
import { GameState, type IInput, type IMouseHandler } from "../engine/types.js";
import { EntityManager } from "../entity/EntityManager.js";
import { defaultPhysics } from "../physics/defaultPhysics.js";
import type { PhysicsStrategy, Vector2D } from "../physics/physics.js";
import type { IGameContext } from "../systems/types.js";

/**
 * Das Grundgerüst für die Maus-Interaktion innerhalb der Engine.
 * 
 * @status NOCH NICHT IMPLEMENTIERT
 * 
 * @description
 * Diese Klasse dient aktuell als Platzhalter. Sie ist dafür vorgesehen, 
 * die native Maus des Betriebssystems durch ein In-Game-Objekt zu ersetzen.
 * 
 * Zukünftige Features:
 * 1. **Custom Visuals**: In der `draw`-Methode kann ein eigener Cursor gezeichnet werden.
 * 2. **Input-Handling**: Zentrale Verwaltung von Klicks und Bewegungen.
 * 3. **Interaktion**: Umrechnung von Screen-Koordinaten in Welt-Koordinaten.
 */
export class Mouse implements IMouseHandler, IDrawer {
	private currentMouse: Vector2D
	private dragStart: Vector2D & { actorId: string | number } | undefined;
	private entityManager: EntityManager
	private yourTurn: boolean
	private myTeam: string[]
	private output: IInput | undefined
	private physics: PhysicsStrategy
	constructor(team: string[] = [], yourTurn: boolean = true) {
		this.currentMouse = { x: 0, y: 0 }
		this.myTeam = team
		this.yourTurn = yourTurn
		this.physics = new defaultPhysics()
		this.entityManager = new EntityManager([])
	}


	setPhysics(physics: PhysicsStrategy) { this.physics = physics }
	setEntityManager(entityManager: EntityManager) { this.entityManager = entityManager }

	/**
		 * Die "Mathe-Küche": Berechnet Winkel und Kraft aus der Mausbewegung.
		 * 
		 * Logik:
		 * - Power: Distanz zwischen Startpunkt und aktueller Maus (max. 100).
		 * - Angle: Wir addieren 180 Grad, da man "nach hinten" zieht, um "nach vorne" zu schießen (Billard-Prinzip).
		 * 
		 * @returns Ein Objekt mit ID, Winkel und Kraft oder null, wenn die Bewegung zu kurz war.
		 */
	public parseLocalInput(): IInput | undefined {
		if (!this.dragStart || !this.currentMouse) return undefined;

		const dx = this.currentMouse.x - this.dragStart.x;
		const dy = this.currentMouse.y - this.dragStart.y;

		const rawPower = Math.sqrt(dx * dx + dy * dy);

		// Deadzone: Ignoriere Mikrobewegungen
		if (rawPower < 5) return undefined;

		// 1. Definiere, ab wie viel Pixeln die maximale Power erreicht ist
		const DISTANCE_FOR_MAX_POWER = 100; // Wenn du 100px ziehst, hast du volle Power

		// 2. Berechne den Skalierungsfaktor (0.0 bis 1.0)
		const factor = Math.min(rawPower / DISTANCE_FOR_MAX_POWER, 1.0);

		// 3. Skaliere auf den Zielbereich (z.B. 0 bis 10)
		const MAX_POWER_VALUE = 10;
		const power = factor * MAX_POWER_VALUE;

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
	/**
		 * Zeichnet das Benutzer-Interface (UI), das über der Welt liegt.
		 * 
		 * Wichtig: Elemente hier skalieren oft nicht mit der Weltkamera mit.
		 * Beinhaltet:
		 * - Den aktuellen Spielstatus (GameState)
		 * - Die Schuss-Vorschau (Trajektorie), wenn der Spieler zielt.
		 */
	public draw(ctx: RenderContext) {
		ctx.push()
		if (this.dragStart) {
			const input = this.parseLocalInput()
			if (!input) return
			const actor = this.entityManager.getEntityById(this.dragStart.actorId)
			if (!actor) return
			const res = this.physics.calculateStopFromInput(actor.getPos(), input.angle, input?.power)
			const { x, y } = actor.getPos()
			ctx.line(x, y, res.x, res.y);
			ctx.drawText(`${Math.round(this.output?.angle ?? 0)}°`, x, y);
		}
		ctx.pop()
	}

	/**
	 * Wird aufgerufen, wenn eine Maustaste gedrückt wird.
	 */
	public handleMousePressed(mouseX: number, mouseY: number): IInput | undefined {
		const e = this.entityManager.getEntityAt(mouseX, mouseY, 25)
		if (!e) return

		let valid
		if (this.yourTurn)
			valid = this.myTeam.some(team => e.getTeam().includes(team))
		else
			valid = this.myTeam.some(team => !e.getTeam().includes(team))

		if (!valid) return
		this.dragStart = { actorId: e.getId(), x: e.getPos().x, y: e.getPos().y };
	}

	/**
	 * Wird aufgerufen, wenn die Maustaste losgelassen wird.
	 */
	public handleMouseReleased(cb?: (actorId: number | string, angle: number, power: number) => void): void {
		const output = this.parseLocalInput();
		this.dragStart = undefined
		if (output && cb) cb(output.actorId, output.angle, output.power)
	}

	public getData(): IInput | undefined {
		const snap = this.output
		this.output = undefined
		return snap
	}

	/**
	 * Aktualisiert die interne Position der Maus innerhalb der Engine.
	 */
	public updateMouse(mouseX: number, mouseY: number): void {
		// Speichern der aktuellen Koordinaten für draw() und tick()
		this.currentMouse = { x: mouseX, y: mouseY };
	}
	public handleMouseWheel(_event: WheelEvent): void { }
	public ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		if (ctx.state == GameState.YOUR_TURN) this.yourTurn = true
		if (ctx.state == GameState.OPPONENTS_TURN) this.yourTurn = false
	}

	public addTeam(team: string | string[]): this {
		if (Array.isArray(team)) {
			team.forEach((x) => this.myTeam.push(x))
		} else {
			this.myTeam.push(team)
		}
		return this
	}
	public setCurrentMousePosition(pos: Vector2D) { this.currentMouse = { ...pos } }
	public getCurrentMousePosition(): Vector2D { return this.currentMouse }

}

