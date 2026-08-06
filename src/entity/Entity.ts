import type { UUID } from "node:crypto";
import type { AssetList } from "../assetManager/assets/assetRegistry.js";
import type { IDrawer, ITicker } from "../engine/RenderContext.js";
import type { ISettingsSerialize } from "../engine/types.js";
import type { IPhysics, SHAPE, Vector2D } from "../physics/physics.js";
import type { IKillable, PlayerSettings } from "./types.js";
import type { Effect, ItemEffectSettings } from "../effects/types.js";
import type { InventoryItem, ItemDocument } from "../item/types.js";

/**
 * Das Basis-Interface für alle Spielobjekte (Entities).
 * 
 * Jedes Objekt, das in der Spielwelt existieren soll (Spieler, Pucks, Hindernisse),
 * muss dieses Interface implementieren. Es vereint drei Kernaspekte:
 * 
 * 1. **Grafik (IDrawer)**: Das Objekt weiß, wie es sich auf der Leinwand zeichnet.
 * 2. **Logik (ITicker)**: Das Objekt reagiert auf den Lauf der Zeit (Bewegung).
 * 3. **Physik (IPhysicsCircle)**: Das Objekt hat eine physische Form für Kollisionen.
 */
export interface IEntity extends IDrawer, ITicker, IPhysics<SHAPE.CIRCLE>, IKillable, IInventory, ISettingsSerialize<PlayerSettings> {
	/**
	 * Gibt die aktuelle Position der Entity zurück.
	 * @returns {Vector2D} Ein Vektor mit den aktuellen x- und y-Koordinaten in Welt-Einheiten.
	 */
	getPos(): Vector2D;

	/**
	 * Die eindeutige Identifikationsnummer oder der Name der Entity.
	 * Wichtig für die Synchronisation zwischen Client, Server und Simulator.
	 * @returns {string} Die ID der Entity.
	 */
	getId(): UUID;

	/**
	 * @returns {Vector2D} Gibt die größe (Radius) des Players.
	 */
	getSize(): Vector2D;
	setColor(color: string): void;

	setPlayerIcon(icon: AssetList): void;
	setSize(size: number): void;
	getColor(): string;
	getTeam(): number[];
	setTeam(team: number[]): void
	setRotation(rotation: number): void
	getEffects(): Effect[]
	addItemEffect(effect: ItemEffectSettings): void
	getItemEffects(): ItemEffectSettings[]
}
export interface IInventory {
	AddItem(item: InventoryItem): void
	setInventory(items: InventoryItem[]): void
	use(item: ItemDocument): void
	resetItemUses(): void
	getInventory(): InventoryItem[]
}
