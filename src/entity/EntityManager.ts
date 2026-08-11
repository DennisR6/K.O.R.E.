import { type IEntity } from "./Entity.js";
import type { IDrawer, ITicker, RenderContext } from "../kore/runtime/RenderContext.js";
import { Player } from "./Player.js";
import { createRuntimePlayer } from "./runtimeFactory.js";
import type { ISettingsSerialize } from "../kore/runtime/types.js";
import type { PlayerSettings } from "./types.js";

/**
 * Der EntityManager ist die zentrale Verwaltung für alle dynamischen Spielobjekte (Entities).
 * Er fungiert als Brücke zwischen der Logik (ITicker) und der Anzeige (IDrawer).
 * 
 * @implements {IDrawer} Ermöglicht das Zeichnen aller verwalteten Entities.
 * @implements {ITicker} Ermöglicht das physikalische Update aller verwalteten Entities.
 */
export class EntityManager implements IDrawer, ITicker, ISettingsSerialize<PlayerSettings[]> {
	/** Die Liste aller aktuell im Spiel befindlichen Objekte. */
	private entities: IEntity[] = [];

	/**
	 * @param entities - Initiale Liste von Entities (z.B. Spieler oder Pucks).
	 */
	constructor(entities: PlayerSettings[] = []) {
		this.entities = entities.map(entity => createRuntimePlayer(entity))
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
	public getEntityById(id: string): IEntity | undefined {
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
			if (e.isDead()) return false
			const dist = Math.hypot(e.getPos().x - x, e.getPos().y - y);
			return dist < (e.getBounds().x + padding);
		});
	}

	/** Setzt die Geschwindigkeit aller Entities auf Null. Stoppt sofort alle Bewegungen. */
	public resetSpeeds() {
		this.entities.forEach(entity => entity.setVel({ x: 0, y: 0 }))
	}


	/**
		 * Verwandelt den aktuellen Zustand aller Entities in ein flaches Daten-Array.
		 * Wichtig für Netzwerk-Übertragung oder Snapshots für den Simulator.
		 * @returns Ein Array mit IDs, Positionen und Geschwindigkeiten.
		 */
	public serialize(): PlayerSettings[] {
		return this.entities.map(player => player.toSettings())
	}

	/**
		 * Erzeugt eine tiefe Kopie (Deep Copy) des gesamten EntityManagers.
		 * Dies wird vom Simulator genutzt, um Spielzüge in einer "Parallelwelt" 
		 * vorauszuberechnen, ohne die echte Anzeige zu stören.
		 */
	public applySerializedState(state: PlayerSettings[]) {
		this.applySettings(state)
	}

	/** Applies an authoritative complete state while preserving existing entity references. */
	public applySettings(state: PlayerSettings[]): void {
		const existing = new Map(this.entities.map(entity => [entity.getId(), entity]))
		this.entities = state.map(settings => {
			const entity = existing.get(settings.id)
			if (entity instanceof Player) {
				entity.applySettings(settings)
				return entity
			}
			return createRuntimePlayer(settings)
		})
	}

	public addPlayer(data: PlayerSettings) {
		this.entities.push(createRuntimePlayer(data));
	}

	/**
		 * Führt den Logik-Schritt für alle Entities aus.
		 * @param dt - Delta Time (Zeit seit dem letzten Frame).
		 * @param friction - Der Reibungswert der aktuellen Welt.
		 */
	public tick(dt: number, friction: number) {
		this.entities.forEach(e => e.tick(dt, friction));
	}

	/**
		 * Zeichnet alle Entities auf den übergebenen RenderContext.
		 * @param ctx - Der P5- oder alternative Renderer.
		 */
	public draw(ctx: RenderContext): void {
		this.entities.forEach(entity => entity.draw(ctx))
	}

	/**
		 * Erzeugt eine tiefe Kopie (Deep Copy) des gesamten EntityManagers.
		 * Dies wird vom Simulator genutzt, um Spielzüge in einer "Parallelwelt" 
		 * vorauszuberechnen, ohne die echte Anzeige zu stören.
		 */
	public clone(): EntityManager {
		const settings = this.toSettings()
		// const newManager = new EntityManager([]);
		// const data = this.serialize();
		// newManager.applySerializedState(data);
		return new EntityManager(settings);
	}
	public toSettings(): PlayerSettings[] { return this.entities.map(player => player.toSettings()) }
}
