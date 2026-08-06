import type { UUID } from "node:crypto";
import { AssetList } from "../assetManager/assets/assetRegistry.js";
import { SHAPE, type Vector2D } from "../physics/physics.js";
import type { FullEffectSettings } from "../effects/types.js";
import type { InventoryItem } from "../item/types.js";
import type { ItemEffectSettings } from "../effects/types.js";

/**
 * Ein EntitySnapshot repräsentiert den Zustand einer Entity zu einem spezifischen Zeitpunkt.
 * 
 * Snapshots sind essenziell für:
 * 1. **Simulation**: Speichern des Endergebnisses eines Spielzugs im `TurnPacket`.
 * 2. **Interpolation**: Berechnung von Zwischenpositionen während des Playbacks.
 * 3. **Netzwerk**: Übertragung der minimal notwendigen Daten vom Server zum Client.
 */
export interface EntitySnapshot {
	/** Die eindeutige ID der Entity, um sie im EntityManager wiederzufinden. */
	id: string;

	/** Die X-Position in Welt-Einheiten zum Zeitpunkt des Snapshots. */
	x: number;
	/** Die Y-Position in Welt-Einheiten zum Zeitpunkt des Snapshots. */
	y: number;

	/** Die Geschwindigkeit auf der X-Achse (Velocity X). Wichtig für Bewegungsunschärfe oder Vorhersagen. */
	vx: number;
	/** Die Geschwindigkeit auf der Y-Achse (Velocity Y). */
	vy: number;

	/** 
	 * Optionale Rotation in Radiant oder Grad. 
	 * Nützlich für asymmetrische Objekte oder visuelle Effekte. 
	 */
	rotation?: number;

	/** 
	 * Statusflag: Gibt an, ob das Objekt zum Zeitpunkt des Snapshots bereits ruhte. 
	 * Hilft dem Renderer, Berechnungen für ruhende Objekte zu überspringen.
	 */
	isStatic?: boolean;
}
export interface IKillable {
	setHP(hp: number): void;
	getHP(): number;
	addHP(hp: number): void
	setIsDead(dead: boolean): void
	isDead(): boolean
}
/**
 * Complete serializable state for a Player. This is the single creation and
 * snapshot contract: `new Player(settings).toSettings()` must round-trip it.
 */
export interface PlayerSettings {
	id: UUID;
	position: Vector2D;
	velocity: Vector2D;
	rotation: number;
	angularVelocity: number;
	hp: number;
	bouncyness: number;
	mass: number;
	size: number;
	friction: number | undefined;
	team: number[];
	color: string;
	playericon: AssetList;
	shape: SHAPE.CIRCLE
	hoop: AssetList
	isPhysicsEnabled: boolean
	isDead: boolean
	effects: FullEffectSettings[]
	inventory: InventoryItem[]
	itemEffects?: ItemEffectSettings[]
}

export function validatePlayerMass(mass: number): void {
	if (!Number.isFinite(mass) || mass <= 0) throw new Error("Player mass must be a finite positive number");
}

/** Creates an independent, complete player snapshot with sensible defaults. */
export function createPlayerSettings(overrides: Partial<PlayerSettings> = {}): PlayerSettings {
	const mass = overrides.mass ?? 1;
	validatePlayerMass(mass);
	return {
		id: overrides.id ?? crypto.randomUUID() as UUID,
		position: { x: overrides.position?.x ?? 0, y: overrides.position?.y ?? 0 },
		velocity: { x: overrides.velocity?.x ?? 0, y: overrides.velocity?.y ?? 0 },
		rotation: overrides.rotation ?? 0,
		angularVelocity: overrides.angularVelocity ?? 0,
		hp: overrides.hp ?? 30,
		bouncyness: overrides.bouncyness ?? 1,
		mass,
		size: overrides.size ?? 20,
		friction: overrides.friction,
		team: [...(overrides.team ?? [])],
		color: overrides.color ?? "red",
		playericon: overrides.playericon ?? AssetList.picturePenguinPenguinIdleFrame1PNG,
		shape: SHAPE.CIRCLE,
		hoop: overrides.hoop ?? AssetList.pictureReifenPNG,
		isPhysicsEnabled: overrides.isPhysicsEnabled ?? true,
		isDead: overrides.isDead ?? false,
		effects: (overrides.effects ?? []).map(effect => ({ ...effect })),
		inventory: (overrides.inventory ?? []).map(item => ({ ...item })),
		...(overrides.itemEffects ? { itemEffects: overrides.itemEffects.map(effect => ({ type: effect.type, typeValue: structuredClone(effect.typeValue) })) } : {}),
	};
}
