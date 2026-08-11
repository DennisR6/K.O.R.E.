import type { UUID } from "node:crypto";
import type { AssetList } from "../assetManager/assets/assetRegistry.js";
import type { IDrawer, ITicker } from "../kore/runtime/RenderContext.js";
import type { ISettingsSerialize } from "../kore/runtime/types.js";
import type { IPhysics, SHAPE, Vector2D } from "../physics/physics.js";
import type { IKillable, PlayerSettings } from "./types.js";
import type { Effect, ItemEffectSettings } from "../effects/types.js";
import type { EngineTriggerEvent } from "../engine/sdk/trigger.js";
import type { InventoryItem, ItemDocument } from "../item/types.js";
import type { NumericStateOwner } from "../engine/contracts/numericState.js";
import type { EngineEffectSettings } from "../engine/sdk/effectRegistry.js";
import type { TemporalModifierSettings } from "../engine/contracts/temporalModifier.js";
import type { AcceptedForceInput, ActionModifierSettings } from "../engine/contracts/actionModifier.js";
import type { CollisionFilterLifetimeSettings, CollisionFilterSettings } from "../engine/contracts/collisionFilter.js";
import type { ActorEligibilityConstraintLifetimeSettings, ActorEligibilityConstraintSettings } from "../engine/contracts/actorEligibility.js";

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
export interface IEntity extends IDrawer, ITicker, IPhysics<SHAPE.CIRCLE>, IKillable, IInventory, NumericStateOwner, ISettingsSerialize<PlayerSettings> {
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
	drawingEnabled(): boolean;
	setDrawingEnabled(drawingEnabled: boolean): void;
	setTeam(team: number[]): void
	setRotation(rotation: number): void
	getEffects(): Effect[]
	getAlwaysEffects(): Effect[]
	onRound(event: EngineTriggerEvent): void
	addItemEffect(effect: ItemEffectSettings, source?: { itemId: string; order: number }): void
	removeItemEffects(itemIds: ReadonlySet<string>): void
	advanceItemEffectsTurn(): ItemEffectSettings[]
	getItemEffects(): ItemEffectSettings[]
	addTemporalModifier(modifier: TemporalModifierSettings): void
	getTemporalModifiers(): TemporalModifierSettings[]
	advanceTemporalModifiersTurn(): void
	removeTemporalModifiers(sourceIds: ReadonlySet<string>): void
	addPendingActionModifier(modifier: ActionModifierSettings): void
	getPendingActionModifiers(): ActionModifierSettings[]
	applyPendingActionModifiers(input: AcceptedForceInput): AcceptedForceInput
	consumePendingActionModifiers(): void
	advancePendingActionModifierLifetimes(): void
	removePendingActionModifiers(sourceIds: ReadonlySet<string>): void
	addCollisionFilter(filter: CollisionFilterSettings, lifetime: CollisionFilterLifetimeSettings): void
	getCollisionFilters(): CollisionFilterSettings[]
	getCollisionFilterLifetimes(): CollisionFilterLifetimeSettings[]
	advanceCollisionFilterLifetimes(): void
	removeCollisionFilters(sourceIds: ReadonlySet<string>): void
	addActorEligibilityConstraint(constraint: ActorEligibilityConstraintSettings, lifetime: ActorEligibilityConstraintLifetimeSettings): void
	getActorEligibilityConstraints(): ActorEligibilityConstraintSettings[]
	getActorEligibilityConstraintLifetimes(): ActorEligibilityConstraintLifetimeSettings[]
	advanceActorEligibilityConstraintLifetimes(): void
	removeActorEligibilityConstraints(sourceIds: ReadonlySet<string>): void
	isActorEligible(): boolean
	setNumericEffectDispatcher(dispatcher: (effect: EngineEffectSettings) => void): void;
	dispatchNumericAdd(stateId: string, amount: number): void;
	dispatchNumericSet(stateId: string, value: number): void;
}
export interface IInventory {
	AddItem(item: InventoryItem): void
	setInventory(items: InventoryItem[]): void
	use(item: ItemDocument): void
	resetItemUses(): void
	getInventory(): InventoryItem[]
}
