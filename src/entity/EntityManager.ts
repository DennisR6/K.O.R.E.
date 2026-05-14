import { type IEntity } from "./Entity";
import type { SettingsEntity } from "../settings/settings";
import type { IDrawer, ITicker, RenderContext } from "../engine/RenderContext";
import { Player } from "./Player";

/**
 * Der EntityManager ist die zentrale Verwaltung für alle dynamischen Spielobjekte (Entities).
 * Er fungiert als Brücke zwischen der Logik (ITicker) und der Anzeige (IDrawer).
 * 
 * @implements {IDrawer} Ermöglicht das Zeichnen aller verwalteten Entities.
 * @implements {ITicker} Ermöglicht das physikalische Update aller verwalteten Entities.
 */
export class EntityManager implements IDrawer, ITicker {
	/** Die Liste aller aktuell im Spiel befindlichen Objekte. */
	private entities: IEntity[] = [];

	/**
	 * @param entities - Initiale Liste von Entities (z.B. Spieler oder Pucks).
	 */
	constructor(entities: IEntity[]) {
		this.entities = entities
	}

	/**
	 * Fügt eine oder mehrere Entities zur Verwaltung hinzu.
	 * @param entity - Einzelnes Objekt oder ein Array von IEntity-Objekten.
	 */
	public addEntity(entity: IEntity | IEntity[]) {
		if (Array.isArray(entity))
			entity.forEach(e => this.entities.push(e))
		else
			this.entities.push(entity);
	}

	/** @returns Gibt alle verwalteten Entities zurück. */
	public getEntities(): IEntity[] {
		return this.entities;
	}

	/**
		 * Sucht eine Entity anhand ihrer eindeutigen ID.
		 * @param id - Die ID der gesuchten Entity.
		 */
	public getEntityById(id: string | number): IEntity | undefined {
		return this.entities.find(e => e.getId() === id);
	}

	/**
	 * Findet eine Entity an einer bestimmten Koordinate.
	 * Nützlich für Maus-Interaktionen (z.B. "Welchen Puck habe ich angeklickt?").
	 * @param x - X-Koordinate in Welt-Einheiten.
	 * @param y - Y-Koordinate in Welt-Einheiten.
	 * @param padding - Optionaler Puffer um die Entity herum (Klick-Toleranz).
	 */
	public getEntityAt(x: number, y: number, padding: number = 0): IEntity | undefined {
		return this.entities.find(e => {
			const dist = Math.hypot(e.getPos().x - x, e.getPos().y - y);
			return dist < (e.getBounds().x + padding);
		});
	}

	/** Setzt die Geschwindigkeit aller Entities auf Null. Stoppt sofort alle Bewegungen. */
	public resetSpeeds() {
		this.entities.forEach(entity => entity.setVel({ x: 0, y: 0 }))
	}

	public serialize(): any[] {
		return this.entities.map(e => ({
			id: e.getId(),
			x: e.getPos().x,
			y: e.getPos().y,
			vx: e.getVel()?.x ?? 0,
			vy: e.getVel()?.y ?? 0,
			//@ts-ignore
			color: e.color ?? "green"
		}));
	}

	/**
		 * Verwandelt den aktuellen Zustand aller Entities in ein flaches Daten-Array.
		 * Wichtig für Netzwerk-Übertragung oder Snapshots für den Simulator.
		 * @returns Ein Array mit IDs, Positionen und Geschwindigkeiten.
		 */
	public applySerializedState(state: Player[]) {
		state.forEach(data => {
			let existing = this.getEntityById(data.getId());
			if (!existing) {
				existing = new Player().new({ id: data.getId(), x: data.getPos().x, y: data.getPos().y, color: data.getColor(), size: data.getBounds().x });
				this.addEntity(existing);
			}
			// DEBUG: Vergleiche das Original (falls vorhanden) mit dem Klon
			console.log(`Entity ${data.getId()} - Mass: ${existing.getMass()}, Size: ${existing.getBounds().x}`);
		});
	}

	/**
		 * Erzeugt eine tiefe Kopie (Deep Copy) des gesamten EntityManagers.
		 * Dies wird vom Simulator genutzt, um Spielzüge in einer "Parallelwelt" 
		 * vorauszuberechnen, ohne die echte Anzeige zu stören.
		 */
	addPlayer(data: SettingsEntity) {
		const p = new Player().new({ x: data.x, y: data.y, size: data.size ?? 12, color: data.color, id: data.id, team: data.team, playericon: data.playericon });
		this.entities.push(p);
	}

	/**
		 * Führt den Logik-Schritt für alle Entities aus.
		 * @param dt - Delta Time (Zeit seit dem letzten Frame).
		 * @param friction - Der Reibungswert der aktuellen Welt.
		 */
	tick(dt: number, friction: number) {
		this.entities.forEach(e => e.tick(dt, friction));
	}

	/**
		 * Zeichnet alle Entities auf den übergebenen RenderContext.
		 * @param ctx - Der P5- oder alternative Renderer.
		 */
	draw(ctx: RenderContext): void {
		this.entities.forEach(entity => entity.draw(ctx))
	}

	/**
		 * Erzeugt eine tiefe Kopie (Deep Copy) des gesamten EntityManagers.
		 * Dies wird vom Simulator genutzt, um Spielzüge in einer "Parallelwelt" 
		 * vorauszuberechnen, ohne die echte Anzeige zu stören.
		 */
	public clone(): EntityManager {
		const newManager = new EntityManager([]);
		const data = this.serialize();
		newManager.applySerializedState(data);
		return newManager;
	}
}
