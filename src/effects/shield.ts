import { ItemEffectType, type ItemEffectSettings } from "./types.js";

export interface ShieldValue {
	capacity: number;
	remainingCapacity?: number;
	blocksCollision?: boolean;
}

/** A serializable shield that absorbs damage before it reaches the entity. */
export class EffectShield {
	public readonly capacity: number;
	public readonly blocksCollision: boolean;
	private remainingCapacity: number;

	public constructor(settings: { typeValue: ShieldValue }) {
		const { capacity, remainingCapacity = capacity, blocksCollision = true } = settings.typeValue;
		if (!Number.isFinite(capacity) || capacity <= 0) throw new Error("shield capacity must be a finite positive number");
		if (!Number.isFinite(remainingCapacity) || remainingCapacity < 0 || remainingCapacity > capacity) throw new Error("shield remainingCapacity must be between zero and capacity");
		if (typeof blocksCollision !== "boolean") throw new Error("shield blocksCollision must be boolean");
		this.capacity = capacity;
		this.remainingCapacity = remainingCapacity;
		this.blocksCollision = blocksCollision;
	}

	/** Returns damage not absorbed by the shield and consumes absorbed capacity. */
	public absorbDamage(damage: number): number {
		if (!Number.isFinite(damage) || damage < 0) throw new Error("Shield damage must be finite and non-negative");
		const absorbed = Math.min(this.remainingCapacity, damage);
		this.remainingCapacity -= absorbed;
		return damage - absorbed;
	}

	public isActive(): boolean { return this.remainingCapacity > 0; }
	public shouldBlockCollision(): boolean { return this.isActive() && this.blocksCollision; }
	public getRemainingCapacity(): number { return this.remainingCapacity; }

	public toSettings(): ItemEffectSettings {
		return {
			type: ItemEffectType.Shield,
			typeValue: {
				capacity: this.capacity,
				remainingCapacity: this.remainingCapacity,
				blocksCollision: this.blocksCollision,
			},
		};
	}
}
