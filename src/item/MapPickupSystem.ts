import type { IEntity } from "../entity/Entity.js";
import type { IGameContext, ISystem } from "../systems/types.js";
import { addDrawnInventoryItem } from "./inventory.js";
import { type ItemDocument, type ItemPickup, type ItemPickupState, validateItemPickupState } from "./types.js";

export type ItemPickupCollector = (entity: IEntity, item: ItemDocument) => void;

/** Collects configured map pickups when an active, live entity enters their region. */
export class MapPickupSystem implements ISystem {
	private pickups: ItemPickup[] = [];
	private items = new Map<string, ItemDocument>();
	private state: ItemPickupState | undefined;
	private worldSize = { x: 800, y: 450 };
	private collect: ItemPickupCollector = (entity, item) => {
		const inventory = entity.getInventory();
		addDrawnInventoryItem(inventory, item);
		entity.setInventory(inventory);
	};

	public configure(pickups: ItemPickup[], items: ItemDocument[], worldSize: { x: number; y: number } = this.worldSize): void {
		this.pickups = structuredClone(pickups);
		this.items = new Map(items.map(item => [item.id, item]));
		this.worldSize = { ...worldSize };
		for (const pickup of this.pickups) {
			if (!this.items.has(pickup.itemId)) throw new Error(`Map pickup references unknown item '${pickup.itemId}'`);
		}
		this.state = this.pickups.length === 0 ? undefined : createItemPickupState(this.pickups.length);
	}

	public setCollector(collector: ItemPickupCollector | undefined): void {
		this.collect = collector ?? ((entity, item) => {
			const inventory = entity.getInventory();
			addDrawnInventoryItem(inventory, item);
			entity.setInventory(inventory);
		});
	}

	public restore(state: ItemPickupState | undefined): void {
		if (this.pickups.length === 0) {
			if (state) throw new Error("Map pickup state requires configured map pickups");
			return;
		}
		if (!state) throw new Error("Configured map pickups require a serialized pickup state");
		validateItemPickupState(state, this.pickups.length);
		this.state = clonePickupState(state);
		for (const [index, pickupState] of this.state.pickups.entries()) if (pickupState.spawnRegion) this.pickups[index]!.spawnRegion = { ...pickupState.spawnRegion };
	}

	public reset(): void {
		this.state = this.pickups.length === 0 ? undefined : createItemPickupState(this.pickups.length);
	}

	public toState(): ItemPickupState | undefined {
		return this.state && clonePickupState(this.state);
	}

	/** Returns a detached pickup configuration for presentation-only consumers. */
	public getPickups(): ItemPickup[] {
		return structuredClone(this.pickups);
	}

	public ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		if (!this.state) return;
		if (this.state.turnNumber !== ctx.currTurn) {
			this.advanceRound(ctx.currTurn);
		}
		for (let pickupIndex = 0; pickupIndex < this.pickups.length; pickupIndex++) {
			const pickup = this.pickups[pickupIndex];
			const pickupState = this.state.pickups[pickupIndex];
			if (pickupState.respawnCountdown !== undefined) continue;
			const item = this.items.get(pickup.itemId)!;
			// Mystery boxes are neutral map objects: either team may collect one
			// when its figure enters the region, regardless of whose turn it is.
			const neutralPickup = item.id === "mystery-box" || item.id === "magnet";
			const entitiesInRegion = ctx.entities.getEntities().filter(entity => this.canCollect(entity, pickup, ctx.activeTeam, neutralPickup));
			const occupants = new Set(entitiesInRegion.map(entity => entity.getId()));
			const limit = pickup.maxPickupsPerTurn ?? 1;
			for (const entity of entitiesInRegion) {
				if (pickupState.collected >= limit || pickupState.occupants.includes(entity.getId())) continue;
				this.collect(entity, item);
				pickupState.collected++;
			}
			pickupState.occupants = [...occupants];
			if (pickup.respawnConfig && pickupState.collected >= limit) {
				pickupState.respawnCountdown = pickup.respawnConfig.intervalRounds;
			}
		}
	}

	private advanceRound(turnNumber: number): void {
		if (!this.state) return;
		const elapsedRounds = Math.max(1, turnNumber - this.state.turnNumber);
		for (let index = 0; index < this.pickups.length; index++) {
			const pickup = this.pickups[index];
			const state = this.state.pickups[index];
			state.occupants = [];
			if (!pickup.respawnConfig) {
				state.collected = 0;
				continue;
			}
			if (state.respawnCountdown !== undefined) {
				state.respawnCountdown -= elapsedRounds;
				if (state.respawnCountdown <= 0) {
					state.collected = 0;
					state.respawnCountdown = undefined;
					if (pickup.respawnConfig?.relocate) {
						pickup.spawnRegion = relocatedRegion(pickup.spawnRegion, index, turnNumber, this.worldSize);
						state.spawnRegion = { ...pickup.spawnRegion };
					}
				}
			}
		}
		this.state.turnNumber = turnNumber;
	}

	private canCollect(entity: IEntity, pickup: ItemPickup, activeTeam: number, neutralPickup = false): boolean {
		if (entity.isDead() || (!neutralPickup && !entity.getTeam().includes(activeTeam))) return false;
		const position = entity.getPos();
		const radius = entity.getSize().x;
		const nearestX = Math.max(pickup.spawnRegion.x, Math.min(position.x, pickup.spawnRegion.x + pickup.spawnRegion.w));
		const nearestY = Math.max(pickup.spawnRegion.y, Math.min(position.y, pickup.spawnRegion.y + pickup.spawnRegion.h));
		const dx = position.x - nearestX;
		const dy = position.y - nearestY;
		return dx * dx + dy * dy <= radius * radius;
	}
}

function createItemPickupState(pickupCount: number, turnNumber: number = 0): ItemPickupState {
	return { turnNumber, pickups: Array.from({ length: pickupCount }, () => ({ collected: 0, occupants: [] })) };
}

function clonePickupState(state: ItemPickupState): ItemPickupState {
	return {
		turnNumber: state.turnNumber,
		pickups: state.pickups.map(pickup => ({ collected: pickup.collected, occupants: [...pickup.occupants], ...(pickup.respawnCountdown === undefined ? {} : { respawnCountdown: pickup.respawnCountdown }), ...(pickup.spawnRegion ? { spawnRegion: { ...pickup.spawnRegion } } : {}) })),
	};
}

function relocatedRegion(region: { x: number; y: number; w: number; h: number }, pickupIndex: number, turnNumber: number, worldSize: { x: number; y: number }): { x: number; y: number; w: number; h: number } {
	const seed = Math.imul((turnNumber + 1) ^ ((pickupIndex + 1) * 0x45d9f3b), 0x27d4eb2d) >>> 0;
	const padding = Math.max(0, Math.min(40, Math.floor(Math.min(worldSize.x - region.w, worldSize.y - region.h) / 2)));
	const maxX = Math.max(padding, Math.floor(worldSize.x - region.w - padding));
	const maxY = Math.max(padding, Math.floor(worldSize.y - region.h - padding));
	return { ...region, x: maxX === padding ? padding : padding + seed % (maxX - padding + 1), y: maxY === padding ? padding : padding + Math.floor(seed / (maxX - padding + 1)) % (maxY - padding + 1) };
}
