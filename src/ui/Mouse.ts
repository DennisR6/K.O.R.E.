import type { RenderContext } from "../engine/RenderContext.js";
import { type IMouseHandler } from "../engine/types.js";
import type { Vector2D } from "../physics/physics.js";
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
export class Mouse implements IMouseHandler {
	private currentMouse: Vector2D | null = null
	private dragStart: Vector2D & { actorId: string | number } | undefined;
	constructor() {
		// Initialisierung der Maus-States (z.B. buttonPressed = false)
	}


	/**
		 * Die "Mathe-Küche": Berechnet Winkel und Kraft aus der Mausbewegung.
		 * 
		 * Logik:
		 * - Power: Distanz zwischen Startpunkt und aktueller Maus (max. 100).
		 * - Angle: Wir addieren 180 Grad, da man "nach hinten" zieht, um "nach vorne" zu schießen (Billard-Prinzip).
		 * 
		 * @returns Ein Objekt mit ID, Winkel und Kraft oder null, wenn die Bewegung zu kurz war.
		 */
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
	/**
		 * Zeichnet das Benutzer-Interface (UI), das über der Welt liegt.
		 * 
		 * Wichtig: Elemente hier skalieren oft nicht mit der Weltkamera mit.
		 * Beinhaltet:
		 * - Den aktuellen Spielstatus (GameState)
		 * - Die Schuss-Vorschau (Trajektorie), wenn der Spieler zielt.
		 */
	public draw(ctx: RenderContext, handlerCtx: IGameContext) {
		ctx.push()
		const input = this.getLocalInput();
		if (this.dragStart && input) {
			const actor = handlerCtx.entities.getEntityById(input.actorId)
			if (!actor) throw new Error("Kein Spieler gefunden!")
			// const res = handlerCtx.physicsStrategy.calculateStopFromInput(actor.getPos(), input.angle, input.power)
			const { x, y } = actor.getPos()
			ctx.line(x, y, x + 10, y + 10);
			ctx.drawText(`${Math.round(input.angle)}°`, x, y);
		}
		ctx.pop()
	}

	/**
	 * @notimplemented
	 * Für Animationen des Cursors (z.B. Pulsieren beim Klicken).
	 */
	//@ts-ignore
	public tick(_deltatime: number, _globalfriction: number): void { }
	/**
	 * Wird aufgerufen, wenn eine Maustaste gedrückt wird.
	 */
	public handleMousePressed(_mouseX: number, _mouseY: number): void {
		// Logik für "MouseDown" Events
		const input = this.getLocalInput();
		//@ts-ignore
		if (input && this.inputEmitter && this.dragStart)
			//@ts-ignore
			this.inputEmitter.sendShot(input.actorId, input.angle, input.power);

		//@ts-ignore
		this.dragStart = null;

		//@ts-ignore
		return input;
	}

	/**
	 * Wird aufgerufen, wenn die Maustaste losgelassen wird.
	 */
	public handleMouseReleased(): void {
		// Logik für "MouseUp" Events
	}

	/**
	 * Aktualisiert die interne Position der Maus innerhalb der Engine.
	 */
	public updateMouse(_mouseX: number, _mouseY: number): void {
		// Speichern der aktuellen Koordinaten für draw() und tick()
		//@ts-ignore
		this.currentMouse = { x: mouseX, y: mouseY };
	}
	public handleMouseWheel(_event: WheelEvent): void { }
	public ticker(_ctx: IGameContext, _dt: number, _friction: number): void { }
}
