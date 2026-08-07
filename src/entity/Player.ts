import type { UUID } from "crypto";
import type { RenderContext } from "../engine/RenderContext.js";
import { SHAPE, type IPhysics, type Vector2D } from "../physics/physics.js";
import type { IEntity } from "./Entity.js";
import { createPlayerSettings, validatePlayerMass, type PlayerSettings } from "./types.js";
import { EffectTrigger, EffectType, type Effect, type FullEffectSettings, type ItemEffectSettings, type PlayerSettingKey, type SettingValue } from "../effects/types.js";
import { createRuntimeEffect } from "../effects/runtimeFactory.js";
import { validateRuntimeItemEffectSettings } from "../effects/validate.js";
import { orderInstalledEffects } from "../effects/ordering.js";
import { advanceRuntimeItemEffect, advanceRuntimeItemEffectTick } from "../kore/sdk/itemRuntime.js";
import { createCollisionEnterEvent, createTickEvent, dispatchTriggeredEffects } from "../effects/triggerDispatcher.js";
import type { EngineTriggerEvent } from "../engine/sdk/trigger.js";

import { consumeInventoryItem, resetInventoryTurnUses } from "../item/inventory.js";
import type { InventoryItem, ItemDocument } from "../item/types.js";
import type { AssetList } from "../assetManager/assets/assetRegistry.js";


/**
 * Die Player-Klasse ist die konkrete Umsetzung einer IEntity.
 * 
 * Sie kombiniert:
 * 1. **Physik**: Geschwindigkeit (Velocity), Masse und Reibung.
 * 2. **Darstellung**: Zeichnet sich selbst und einen kleinen Richtungsvektor (Velocity-Line).
 * 3. **Debugging**: Kann Mutationen tracken, um unerwartete Wertänderungen zu finden.
 */
export class Player implements IEntity {
	private hp: number = 30;
	/** Eindeutige ID (wird via crypto.randomUUID() generiert, falls nicht vorhanden). */
	private id: UUID;
	/** Die aktuelle Position auf dem Spielfeld (Top-Left des Begrenzungsrahmens). */
	private position: Vector2D;
	/** Aktuelle Bewegungsrichtung und Geschwindigkeit. */
	private velocity: Vector2D;
	private rotation: number = 0;
	private angularVelocity: number = 0;
	/** Bestimmt, wie stark das Objekt bei Kollisionen abprallt (0 bis 1). */
	private bouncyness: number;
	/** Trägheit des Objekts bei Kollisionen. */
	private mass: number = 1;
	/** Der Radius des Spielers. */
	private size: number = 1;
	/** Individuelle Reibung (überschreibt bei Bedarf die globale Reibung). */
	private friction: number | undefined;
	private team: number[] = [];
	private color: string;
	private playericon: AssetList;
	private shape: SHAPE.CIRCLE = SHAPE.CIRCLE
	private hoop: AssetList
	private isPhysicsEnabled: boolean = true
	private dead: boolean = false
	private items: InventoryItem[] = []
	private itemEffects: ItemEffectSettings[] = []

	private effectAlways: Effect[] = []
	private effectCollision: Effect[] = []
	private effectRound: Effect[] = []

	constructor(settings: PlayerSettings) {
		const normalized = createPlayerSettings(settings)
		this.id = normalized.id
		this.position = { x: 0, y: 0 }
		this.velocity = { x: 0, y: 0 }
		this.bouncyness = 1
		this.color = "red"
		this.playericon = normalized.playericon
		this.hoop = normalized.hoop
		this.applySettings(normalized)
	}

	/** Reconciles this live entity with a complete authoritative snapshot. */
	public applySettings(settings: PlayerSettings): void {
		this.id = settings.id
		this.position = { ...settings.position }
		this.velocity = { ...settings.velocity }
		this.rotation = settings.rotation
		this.angularVelocity = settings.angularVelocity
		this.hp = settings.hp
		this.bouncyness = settings.bouncyness
		this.setMass(settings.mass)
		this.size = settings.size
		this.friction = settings.friction
		this.team = [...settings.team]
		this.color = settings.color
		this.playericon = settings.playericon
		this.shape = settings.shape
		this.hoop = settings.hoop
		this.isPhysicsEnabled = settings.isPhysicsEnabled
		this.dead = settings.isDead
		this.items = settings.inventory.map(item => ({ ...item }))
		for (const effect of settings.itemEffects ?? []) validateRuntimeItemEffectSettings(effect)
		this.itemEffects = (settings.itemEffects ?? []).map(effect => ({ ...effect, typeValue: structuredClone(effect.typeValue) }))
		this.effectAlways = []
		this.effectCollision = []
		this.effectRound = []
		for (const effect of settings.effects) this.addEffect(effect.trigger, createRuntimeEffect(effect))
	}

	/**
		 * Zeichnet den Spieler und einen Richtungsvektor.
		 * Der Richtungsvektor hilft dem Spieler zu sehen, wohin sich der Puck bewegt.
		 */
	public draw(ctx: RenderContext): void {
		if (this.dead) return
		ctx.drawImage(this.hoop, this.position.x - this.size, this.position.y - this.size, this.size * 2, this.size * 2);
		ctx.drawImage(this.playericon, this.position.x - this.size, this.position.y - this.size, this.size * 2, this.size * 2);
	}

	/**
		 * Integriert die Geschwindigkeit in die Position basierend auf der vergangenen Zeit.
		 * @param deltaTime - Zeit seit dem letzten Physik-Schritt.
		 */
	public tick(_deltaTime: number, _globalFriction: number, _drift: number = 0, _stopThreshold: number = 0) {
		if (this.dead || !this.isPhysicsEnabled) return
		if (this.effectAlways.length === 0) return;
		dispatchTriggeredEffects({ effects: this.effectAlways, event: createTickEvent(String(this.id), _deltaTime), apply: effect => {
			if (effect.getType() == EffectType.Physics) effect.apply(this, 12)
		}});
	}

	public setId(id: UUID): void { this.id = id }
	public getId(): UUID { return this.id }
	public setMass(inertia: number): void {
		validatePlayerMass(inertia)
		this.mass = Math.min(inertia, 1)
	}
	public getMass(): number { return this.mass }
	public setVel(v: { x: number, y: number }) { this.velocity.x = v.x; this.velocity.y = v.y; }
	public getVel() { return { x: this.velocity.x, y: this.velocity.y }; }
	public setRotation(rotation: number): void { this.rotation = rotation }
	public getRotation(): number { return this.rotation }
	public setAngularVelocity(angularVelocity: number): void { this.angularVelocity = angularVelocity }
	public getAngularVelocity(): number { return this.angularVelocity }
	public setBounceFactor(bounce: number): void { this.bouncyness = bounce }
	public getBounds(): Vector2D { return { x: this.size, y: this.size } }
	public getBounceFactor(): number { return this.bouncyness }
	public setPos(pos: Vector2D): void { this.position = { x: pos.x, y: pos.y }; }
	public getPos(): Vector2D { return { x: this.position.x, y: this.position.y } }

	public setFriction(friction: number | undefined): void { this.friction = friction }
	public getFriction(): number | undefined { return this.friction }
	public getSize(): Vector2D { return { x: this.size, y: this.size } }
	public addHP(hp: number): void {
		this.hp += hp;
		if (this.hp <= 0) this.setIsDead(true);
	}
	public getHP(): number { return this.hp }
	public setColor(color: string): void { this.color = color }
	public getColor(): string { return this.color }
	public setPlayerIcon(icon: AssetList): void { this.playericon = icon; }
	public setSize(size: number): void { this.size = size; }
	public getShape(): SHAPE.CIRCLE { return this.shape }

	public onCollision({ entity }: { entity: IPhysics<SHAPE>; }): void {
		dispatchTriggeredEffects({
			effects: this.effectCollision,
			event: createCollisionEnterEvent(String(this.id), String(this.id), "collision", `${String(this.id)}:collision`),
			apply: effect => effect.apply(entity),
		});
	}
	public getTeam(): number[] { return this.team }
	public isActive(): boolean { return !this.dead }
	public physicsEnabled(): boolean { return this.isPhysicsEnabled }
	public setHP(hp: number): void { this.hp = hp }
	public setPhysicsEnabled(physicsEnabled: boolean): void { this.isPhysicsEnabled = physicsEnabled }
	public use(item: ItemDocument): void { consumeInventoryItem(this.items, item) }

	/** Applies an allowlisted setting exactly, including serializable state changes. */
	public setSetting(key: PlayerSettingKey, value: SettingValue): void {
		switch (key) {
			case "hp": if (typeof value === "number") this.setHPAndDeath(value); break
			case "mass": if (typeof value === "number") this.setMass(value); break
			case "size": if (typeof value === "number") this.setSize(value); break
			case "friction": if (typeof value === "number" || value === undefined) this.setFriction(value); break
			case "position": if (isVector(value)) this.setPos(value); break
			case "velocity": if (isVector(value)) this.setVel(value); break
			case "team": if (Array.isArray(value) && value.every(Number.isFinite)) this.setTeam([...value]); break
			case "dead": if (typeof value === "boolean") this.setIsDead(value); break
			case "physicsEnabled": if (typeof value === "boolean") this.setPhysicsEnabled(value); break
		}
	}

	/** Adds a numeric/vector setting or appends team IDs. */
	public addSetting(key: PlayerSettingKey, value: SettingValue): void {
		if (typeof value === "number") {
			switch (key) {
				case "hp": this.setHPAndDeath(this.hp + value); return
				case "mass": this.setMass(this.mass + value); return
				case "size": this.setSize(this.size + value); return
				case "friction": this.setFriction((this.friction ?? 0) + value); return
			}
		}
		if (isVector(value)) {
			if (key === "position") this.setPos({ x: this.position.x + value.x, y: this.position.y + value.y })
			if (key === "velocity") this.setVel({ x: this.velocity.x + value.x, y: this.velocity.y + value.y })
		}
		if (key === "team" && Array.isArray(value) && value.every(Number.isFinite)) this.team = [...new Set([...this.team, ...value])]
	}

	/** Removes numeric/vector values, team IDs, or clears boolean settings. */
	public removeSetting(key: PlayerSettingKey, value: SettingValue): void {
		if (typeof value === "number") {
			switch (key) {
				case "hp": this.setHPAndDeath(this.hp - value); return
				case "mass": this.setMass(this.mass - value); return
				case "size": this.setSize(this.size - value); return
				case "friction": this.setFriction((this.friction ?? 0) - value); return
			}
		}
		if (isVector(value)) {
			if (key === "position") this.setPos({ x: this.position.x - value.x, y: this.position.y - value.y })
			if (key === "velocity") this.setVel({ x: this.velocity.x - value.x, y: this.velocity.y - value.y })
		}
		if (key === "team" && Array.isArray(value) && value.every(Number.isFinite)) this.team = this.team.filter(team => !value.includes(team))
		if (key === "dead") this.setIsDead(false)
		if (key === "physicsEnabled") this.setPhysicsEnabled(false)
	}

	public toSettings(): PlayerSettings {
		const sett0 = this.effectAlways.map(x => { return { ...x.toSettings(), trigger: EffectTrigger.Always, triggerValue: [] } as FullEffectSettings })
		const sett1 = this.effectCollision.map(x => { return { ...x.toSettings(), trigger: EffectTrigger.Collision, triggerValue: [] } as FullEffectSettings })
		const sett2 = this.effectRound.map(x => { return { ...x.toSettings(), trigger: EffectTrigger.Round, triggerValue: [] } as FullEffectSettings })
		return {
			id: this.getId(),
			position: { ...this.position },
			velocity: { ...this.velocity },
			rotation: this.rotation,
			angularVelocity: this.angularVelocity,
			playericon: this.playericon,
			team: this.team,
			hoop: this.hoop,
			color: this.color,
			size: this.size,
			hp: this.hp,
			bouncyness: this.bouncyness,
			mass: this.mass,
			friction: this.friction,
			shape: this.shape,
			isPhysicsEnabled: this.isPhysicsEnabled,
			isDead: this.dead,
			effects: [
				...sett0,
				...sett1,
				...sett2,
			],
			inventory: this.items.map(item => ({ ...item })),
			...(this.itemEffects.length ? { itemEffects: this.itemEffects.map(effect => ({ ...effect, typeValue: structuredClone(effect.typeValue) })) } : {}),
		}
	}
	public setTeam(team: number[]) { this.team = team }
	public setHoop(asset: AssetList) { this.hoop = asset }
	public setBouncyness(bouncyness: number) { this.bouncyness = bouncyness }
	public setIsDead(dead: boolean) {
		this.dead = dead
		if (dead) this.setVel({ x: 0, y: 0 })
	}
	public AddItem(item: InventoryItem): void { this.items.push({ ...item }) }
	public setInventory(items: InventoryItem[]): void { this.items = items.map(item => ({ ...item })) }
	public resetItemUses(): void { resetInventoryTurnUses(this.items) }
	public getInventory(): InventoryItem[] { return this.items.map(item => ({ ...item })) }
	public isDead(): boolean { return this.dead }
	public getEffects(): Effect[] { return [...this.effectAlways, ...this.effectCollision] }
	public getAlwaysEffects(): Effect[] { return [...this.effectAlways] }
	public onRound(event: EngineTriggerEvent): void {
		if (this.dead) return;
		dispatchTriggeredEffects({ effects: this.effectRound, event, apply: effect => effect.apply(this) });
	}
	public addItemEffect(effect: ItemEffectSettings, source?: { itemId: string; order: number }): void {
		this.itemEffects.push({ ...effect, ...(source ?? {}), typeValue: structuredClone(effect.typeValue) } as ItemEffectSettings)
		this.itemEffects = orderInstalledEffects(this.itemEffects)
	}
	public removeItemEffects(itemIds: ReadonlySet<string>): void {
		this.itemEffects = this.itemEffects.filter(effect => !effect.itemId || !itemIds.has(effect.itemId))
	}
	public advanceItemEffectsTurn(): void {
		this.itemEffects = this.itemEffects.flatMap(effect => {
			const next = advanceRuntimeItemEffect(effect)
			return next ? [{ ...next, ...(effect.itemId ? { itemId: effect.itemId } : {}), ...(effect.order === undefined ? {} : { order: effect.order }) }] : []
		})
	}
	public advanceItemEffectsTick(): ItemEffectSettings[] {
		const due: ItemEffectSettings[] = [];
		const next: ItemEffectSettings[] = [];
		for (const effect of this.itemEffects) {
			const result = advanceRuntimeItemEffectTick(effect);
			if (result.due) due.push(effect);
			else if (result.next) next.push(result.next);
		}
		this.itemEffects = next;
		return due.map(effect => ({ ...effect, typeValue: structuredClone(effect.typeValue) }));
	}
	public getItemEffects(): ItemEffectSettings[] { return this.itemEffects.map(effect => ({ ...effect, typeValue: structuredClone(effect.typeValue) })) }
	public addEffect(trigger: EffectTrigger, effect: Effect): void {
		switch (trigger) {
			case EffectTrigger.Always: this.effectAlways.push(effect); break
			case EffectTrigger.Collision: this.effectCollision.push(effect); break
			case EffectTrigger.Round: this.effectRound.push(effect); break
			default: console.error("TODO", trigger)
		}
	}

	private setHPAndDeath(hp: number): void {
		this.hp = hp
		if (hp <= 0) this.setIsDead(true)
	}
}

function isVector(value: SettingValue): value is Vector2D {
	return typeof value === "object" && value !== null && "x" in value && "y" in value &&
		typeof value.x === "number" && typeof value.y === "number"
}
