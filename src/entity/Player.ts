import type { UUID } from "crypto";
import type { RenderContext } from "../kore/runtime/RenderContext.js";
import { SHAPE, type IPhysics, type Vector2D } from "@coffeemakerstudio/bean";
import type { IEntity } from "./Entity.js";
import { createDefaultNumericThresholdBindings, createPlayerSettings, validatePlayerMass, type PlayerSettings } from "./types.js";
import { EffectTrigger, EffectType, type Effect, type FullEffectSettings, type ItemEffectSettings, type SettingKey, type SettingValue } from "../effects/types.js";
import { createRuntimeEffect } from "../effects/runtimeFactory.js";
import { validateRuntimeItemEffectSettings } from "../effects/validate.js";
import { orderInstalledEffects } from "../effects/ordering.js";
import { advanceRuntimeItemEffectTurn } from "../kore/sdk/itemRuntime.js";
import { createCollisionEnterEvent, createTickEvent, dispatchTriggeredEffects } from "../effects/triggerDispatcher.js";
import type { EngineTriggerEvent } from "@coffeemakerstudio/roast";

import { consumeInventoryItem, resetInventoryTurnUses } from "../item/inventory.js";
import type { InventoryItem, ItemDocument } from "../item/types.js";
import type { AssetList } from "../assetManager/assets/assetRegistry.js";
import { validateNumericThresholdBindings, type NumericThresholdBinding } from "@coffeemakerstudio/roast";
import type { EngineEffectSettings } from "@coffeemakerstudio/roast";
import { advanceTemporalModifier, validateTemporalModifier, type TemporalModifierSettings } from "@coffeemakerstudio/roast";
import { applyActionModifiers, consumeActionModifiers, validateActionModifier, type AcceptedForceInput, type ActionModifierSettings } from "@coffeemakerstudio/roast";
import { advanceLifetime } from "@coffeemakerstudio/roast";
import { advanceCollisionFilterLifetime, validateCollisionFilter, validateCollisionFilterLifetime, validateCollisionFilterState, type CollisionFilterLifetimeSettings, type CollisionFilterSettings } from "@coffeemakerstudio/roast";
import { advanceActorEligibilityConstraintLifetime, isActorEligible, validateActorEligibilityConstraint, validateActorEligibilityConstraintLifetime, validateActorEligibilityState, type ActorEligibilityConstraintLifetimeSettings, type ActorEligibilityConstraintSettings } from "@coffeemakerstudio/roast";


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
	private isDrawingEnabled: boolean = true
	private items: InventoryItem[] = []
	private itemEffects: ItemEffectSettings[] = []
	private temporalModifiers: TemporalModifierSettings[] = []
	private pendingActionModifiers: ActionModifierSettings[] = []
	private collisionFilters: CollisionFilterSettings[] = []
	private collisionFilterLifetimes: CollisionFilterLifetimeSettings[] = []
	private actorEligibilityConstraints: ActorEligibilityConstraintSettings[] = []
	private actorEligibilityConstraintLifetimes: ActorEligibilityConstraintLifetimeSettings[] = []
	private numericThresholds: NumericThresholdBinding[] = []
	private numericEffectDispatcher: ((effect: EngineEffectSettings) => void) | undefined

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
		this.isDrawingEnabled = settings.isDrawingEnabled
		this.items = settings.inventory.map(item => ({ ...item }))
		for (const effect of settings.itemEffects ?? []) validateRuntimeItemEffectSettings(effect)
		this.itemEffects = (settings.itemEffects ?? []).map(effect => ({ ...effect, typeValue: structuredClone(effect.typeValue) }))
		for (const modifier of settings.temporalModifiers ?? []) validateTemporalModifier(modifier)
		this.temporalModifiers = structuredClone(settings.temporalModifiers ?? [])
		for (const modifier of settings.pendingActionModifiers ?? []) validateActionModifier(modifier)
		this.pendingActionModifiers = structuredClone(settings.pendingActionModifiers ?? [])
		for (const filter of settings.collisionFilters ?? []) validateCollisionFilter(filter)
		for (const lifetime of settings.collisionFilterLifetimes ?? []) validateCollisionFilterLifetime(lifetime)
		validateCollisionFilterState(settings.collisionFilters ?? [], settings.collisionFilterLifetimes ?? [])
		this.collisionFilters = structuredClone(settings.collisionFilters ?? [])
		this.collisionFilterLifetimes = structuredClone(settings.collisionFilterLifetimes ?? [])
		for (const constraint of settings.actorEligibilityConstraints ?? []) validateActorEligibilityConstraint(constraint)
		for (const lifetime of settings.actorEligibilityConstraintLifetimes ?? []) validateActorEligibilityConstraintLifetime(lifetime)
		validateActorEligibilityState(settings.actorEligibilityConstraints ?? [], settings.actorEligibilityConstraintLifetimes ?? [])
		this.actorEligibilityConstraints = structuredClone(settings.actorEligibilityConstraints ?? [])
		this.actorEligibilityConstraintLifetimes = structuredClone(settings.actorEligibilityConstraintLifetimes ?? [])
		validateNumericThresholdBindings(settings.numericThresholds ?? [])
		this.numericThresholds = structuredClone(settings.numericThresholds ?? createDefaultNumericThresholdBindings())
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
		if (!this.isDrawingEnabled) return
		ctx.drawImage(this.hoop, this.position.x - this.size, this.position.y - this.size, this.size * 2, this.size * 2);
		ctx.drawImage(this.playericon, this.position.x - this.size, this.position.y - this.size, this.size * 2, this.size * 2);
	}

	/**
		 * Integriert die Geschwindigkeit in die Position basierend auf der vergangenen Zeit.
		 * @param deltaTime - Zeit seit dem letzten Physik-Schritt.
		 */
	public tick(_deltaTime: number, _globalFriction: number, _drift: number = 0, _stopThreshold: number = 0) {
		if (!this.isPhysicsEnabled) return
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
	public getHP(): number { return this.hp }
	public getNumericValue(stateId: string): number {
		if (stateId !== "hp") throw new Error(`Unknown numeric state '${stateId}'`)
		return this.hp
	}
	public setNumericValue(stateId: string, value: number): void {
		if (stateId !== "hp") throw new Error(`Unknown numeric state '${stateId}'`)
		if (!Number.isFinite(value)) throw new Error("Numeric state value must be finite")
		this.hp = value
	}
	public setNumericEffectDispatcher(dispatcher: (effect: EngineEffectSettings) => void): void { this.numericEffectDispatcher = dispatcher }
	public dispatchNumericAdd(stateId: string, amount: number): void {
		if (stateId !== "hp") throw new Error(`Unknown numeric state '${stateId}'`)
		if (!this.numericEffectDispatcher) throw new Error("Numeric effect dispatcher is not attached")
		this.numericEffectDispatcher({ schemaVersion: 1, type: "numeric.add", target: { type: "numeric", entityId: String(this.id), stateId }, typeValue: { amount } })
	}
	public dispatchNumericSet(stateId: string, value: number): void {
		if (stateId !== "hp") throw new Error(`Unknown numeric state '${stateId}'`)
		if (!this.numericEffectDispatcher) throw new Error("Numeric effect dispatcher is not attached")
		this.numericEffectDispatcher({ schemaVersion: 1, type: "numeric.set", target: { type: "numeric", entityId: String(this.id), stateId }, typeValue: { value } })
	}
	public getNumericResetValue(stateId: string): number | undefined {
		return this.numericThresholds.find(binding => binding.id === stateId)?.resetValue
	}
	public getNumericThresholds(stateId: string): NumericThresholdBinding[] {
		return this.numericThresholds.filter(binding => binding.id === stateId).map(binding => structuredClone(binding))
	}
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
	public isActive(): boolean { return this.isPhysicsEnabled && this.isDrawingEnabled }
	public physicsEnabled(): boolean { return this.isPhysicsEnabled }
	public drawingEnabled(): boolean { return this.isDrawingEnabled }
	public setDrawingEnabled(drawingEnabled: boolean): void { this.isDrawingEnabled = drawingEnabled }
	public setPhysicsEnabled(physicsEnabled: boolean): void { this.isPhysicsEnabled = physicsEnabled }
	public use(item: ItemDocument): void { consumeInventoryItem(this.items, item) }

	/** Applies an allowlisted setting exactly, including serializable state changes. */
	public setSetting(key: SettingKey, value: SettingValue): void {
		switch (key) {
			case "mass": if (typeof value === "number") this.setMass(value); break
			case "size": if (typeof value === "number") this.setSize(value); break
			case "friction": if (typeof value === "number" || value === undefined) this.setFriction(value); break
			case "position": if (isVector(value)) this.setPos(value); break
			case "velocity": if (isVector(value)) this.setVel(value); break
			case "team": if (Array.isArray(value) && value.every(Number.isFinite)) this.setTeam([...value]); break
			case "physicsEnabled": if (typeof value === "boolean") this.setPhysicsEnabled(value); break
			case "drawingEnabled": if (typeof value === "boolean") this.setDrawingEnabled(value); break
		}
	}

	/** Adds a numeric/vector setting or appends team IDs. */
	public addSetting(key: SettingKey, value: SettingValue): void {
		if (typeof value === "number") {
			switch (key) {
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
	public removeSetting(key: SettingKey, value: SettingValue): void {
		if (typeof value === "number") {
			switch (key) {
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
		if (key === "physicsEnabled") this.setPhysicsEnabled(false)
		if (key === "drawingEnabled") this.setDrawingEnabled(false)
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
			isDrawingEnabled: this.isDrawingEnabled,
			effects: [
				...sett0,
				...sett1,
				...sett2,
			],
			inventory: this.items.map(item => ({ ...item })),
			...(this.itemEffects.length ? { itemEffects: this.itemEffects.map(effect => ({ ...effect, typeValue: structuredClone(effect.typeValue) })) } : {}),
			...(this.temporalModifiers.length ? { temporalModifiers: structuredClone(this.temporalModifiers) } : {}),
			...(this.pendingActionModifiers.length ? { pendingActionModifiers: structuredClone(this.pendingActionModifiers) } : {}),
			...(this.collisionFilters.length ? { collisionFilters: structuredClone(this.collisionFilters) } : {}),
			...(this.collisionFilterLifetimes.length ? { collisionFilterLifetimes: structuredClone(this.collisionFilterLifetimes) } : {}),
			...(this.actorEligibilityConstraints.length ? { actorEligibilityConstraints: structuredClone(this.actorEligibilityConstraints) } : {}),
			...(this.actorEligibilityConstraintLifetimes.length ? { actorEligibilityConstraintLifetimes: structuredClone(this.actorEligibilityConstraintLifetimes) } : {}),
			...(this.numericThresholds.length ? { numericThresholds: structuredClone(this.numericThresholds) } : {}),
		}
	}
	public setTeam(team: number[]) { this.team = team }
	public setHoop(asset: AssetList) { this.hoop = asset }
	public setBouncyness(bouncyness: number) { this.bouncyness = bouncyness }
	public setIsDead(dead: boolean) {
		this.setPhysicsEnabled(!dead)
		this.setDrawingEnabled(!dead)
		if (dead) this.setVel({ x: 0, y: 0 })
	}
	public AddItem(item: InventoryItem): void { this.items.push({ ...item }) }
	public setInventory(items: InventoryItem[]): void { this.items = items.map(item => ({ ...item })) }
	public resetItemUses(): void { resetInventoryTurnUses(this.items) }
	public getInventory(): InventoryItem[] { return this.items.map(item => ({ ...item })) }
	/** Transitional convenience projection; participation flags are canonical. */
	public isDead(): boolean { return !this.isActive() }
	public getEffects(): Effect[] { return [...this.effectAlways, ...this.effectCollision] }
	public getAlwaysEffects(): Effect[] { return [...this.effectAlways] }
	public onRound(event: EngineTriggerEvent): void {
		if (!this.isActive()) return;
		dispatchTriggeredEffects({ effects: this.effectRound, event, apply: effect => effect.apply(this) });
	}
	public addItemEffect(effect: ItemEffectSettings, source?: { itemId: string; order: number }): void {
		this.itemEffects.push({ ...effect, ...(source ?? {}), typeValue: structuredClone(effect.typeValue) } as ItemEffectSettings)
		this.itemEffects = orderInstalledEffects(this.itemEffects)
	}
	public removeItemEffects(itemIds: ReadonlySet<string>): void {
		this.itemEffects = this.itemEffects.filter(effect => !effect.itemId || !itemIds.has(effect.itemId))
	}
	public advanceItemEffectsTurn(): ItemEffectSettings[] {
		const due: ItemEffectSettings[] = [];
		const next: ItemEffectSettings[] = [];
		for (const effect of this.itemEffects) {
			const result = advanceRuntimeItemEffectTurn(effect);
			if (result.due) due.push(effect);
			else if (result.next) next.push({ ...result.next, ...(effect.itemId ? { itemId: effect.itemId } : {}), ...(effect.order === undefined ? {} : { order: effect.order }) });
		}
		this.itemEffects = next;
		return due.map(effect => ({ ...effect, typeValue: structuredClone(effect.typeValue) }));
	}
	public getItemEffects(): ItemEffectSettings[] { return this.itemEffects.map(effect => ({ ...effect, typeValue: structuredClone(effect.typeValue) })) }
	public addTemporalModifier(modifier: TemporalModifierSettings): void {
		validateTemporalModifier(modifier)
		this.temporalModifiers.push(structuredClone(modifier))
	}
	public getTemporalModifiers(): TemporalModifierSettings[] { return structuredClone(this.temporalModifiers) }
	public advanceTemporalModifiersTurn(): void {
		this.temporalModifiers = this.temporalModifiers.flatMap(modifier => {
			const next = advanceTemporalModifier(modifier)
			return next ? [next] : []
		})
	}
	public removeTemporalModifiers(sourceIds: ReadonlySet<string>): void {
		this.temporalModifiers = this.temporalModifiers.filter(modifier => !modifier.sourceId || !sourceIds.has(modifier.sourceId))
	}
	public addPendingActionModifier(modifier: ActionModifierSettings): void {
		validateActionModifier(modifier)
		this.pendingActionModifiers.push(structuredClone(modifier))
	}
	public getPendingActionModifiers(): ActionModifierSettings[] { return structuredClone(this.pendingActionModifiers) }
	public applyPendingActionModifiers(input: AcceptedForceInput): AcceptedForceInput {
		if (this.pendingActionModifiers.length === 0) return input;
		return applyActionModifiers(input, this.pendingActionModifiers)
	}
	public consumePendingActionModifiers(): void {
		this.pendingActionModifiers = consumeActionModifiers(this.pendingActionModifiers)
	}
	public advancePendingActionModifierLifetimes(): void {
		this.pendingActionModifiers = this.pendingActionModifiers.flatMap(modifier => {
			if (modifier.durationUnit === undefined) return [modifier];
			const next = advanceLifetime({ durationUnit: modifier.durationUnit, duration: modifier.duration!, remaining: modifier.remaining! });
			return next ? [{ ...modifier, ...next }] : [];
		});
	}
	public removePendingActionModifiers(sourceIds: ReadonlySet<string>): void {
		this.pendingActionModifiers = this.pendingActionModifiers.filter(modifier => !modifier.sourceId || !sourceIds.has(modifier.sourceId))
	}
	public addCollisionFilter(filter: CollisionFilterSettings, lifetime: CollisionFilterLifetimeSettings): void {
		validateCollisionFilter(filter)
		validateCollisionFilterLifetime(lifetime)
		if (lifetime.filterId !== filter.id) throw new Error("Collision filter lifetime must target its filter");
		this.collisionFilters = [...this.collisionFilters.filter(existing => existing.id !== filter.id), structuredClone(filter)].sort(compareCollisionFilters)
		this.collisionFilterLifetimes = [...this.collisionFilterLifetimes.filter(existing => existing.filterId !== filter.id), structuredClone(lifetime)].sort(compareCollisionFilterLifetimes)
	}
	public getCollisionFilters(): CollisionFilterSettings[] { return structuredClone(this.collisionFilters) }
	public getCollisionFilterLifetimes(): CollisionFilterLifetimeSettings[] { return structuredClone(this.collisionFilterLifetimes) }
	public advanceCollisionFilterLifetimes(): void {
		const active: CollisionFilterLifetimeSettings[] = []
		const activeIds = new Set<string>()
		for (const lifetime of this.collisionFilterLifetimes) {
			const next = advanceCollisionFilterLifetime(lifetime)
			if (next) { active.push(next); activeIds.add(lifetime.filterId) }
		}
		this.collisionFilterLifetimes = active.sort(compareCollisionFilterLifetimes)
		this.collisionFilters = this.collisionFilters.filter(filter => activeIds.has(filter.id))
	}
	public removeCollisionFilters(sourceIds: ReadonlySet<string>): void {
		const removed = new Set(this.collisionFilters.filter(filter => filter.sourceId && sourceIds.has(filter.sourceId)).map(filter => filter.id))
		this.collisionFilters = this.collisionFilters.filter(filter => !removed.has(filter.id))
		this.collisionFilterLifetimes = this.collisionFilterLifetimes.filter(lifetime => !removed.has(lifetime.filterId) && (!lifetime.sourceId || !sourceIds.has(lifetime.sourceId)))
	}
	public addActorEligibilityConstraint(constraint: ActorEligibilityConstraintSettings, lifetime: ActorEligibilityConstraintLifetimeSettings): void {
		validateActorEligibilityConstraint(constraint)
		validateActorEligibilityConstraintLifetime(lifetime)
		if (lifetime.constraintId !== constraint.id) throw new Error("Actor eligibility lifetime must target its constraint");
		this.actorEligibilityConstraints = [...this.actorEligibilityConstraints.filter(existing => existing.id !== constraint.id), structuredClone(constraint)].sort(compareActorConstraints)
		this.actorEligibilityConstraintLifetimes = [...this.actorEligibilityConstraintLifetimes.filter(existing => existing.constraintId !== constraint.id), structuredClone(lifetime)].sort(compareActorLifetimes)
	}
	public getActorEligibilityConstraints(): ActorEligibilityConstraintSettings[] { return structuredClone(this.actorEligibilityConstraints) }
	public getActorEligibilityConstraintLifetimes(): ActorEligibilityConstraintLifetimeSettings[] { return structuredClone(this.actorEligibilityConstraintLifetimes) }
	public advanceActorEligibilityConstraintLifetimes(): void {
		const active: ActorEligibilityConstraintLifetimeSettings[] = []
		const activeIds = new Set<string>()
		for (const lifetime of this.actorEligibilityConstraintLifetimes) {
			const next = advanceActorEligibilityConstraintLifetime(lifetime)
			if (next) { active.push(next); activeIds.add(lifetime.constraintId) }
		}
		this.actorEligibilityConstraintLifetimes = active.sort(compareActorLifetimes)
		this.actorEligibilityConstraints = this.actorEligibilityConstraints.filter(constraint => activeIds.has(constraint.id))
	}
	public removeActorEligibilityConstraints(sourceIds: ReadonlySet<string>): void {
		const removed = new Set(this.actorEligibilityConstraints.filter(constraint => constraint.sourceId && sourceIds.has(constraint.sourceId)).map(constraint => constraint.id))
		this.actorEligibilityConstraints = this.actorEligibilityConstraints.filter(constraint => !removed.has(constraint.id))
		this.actorEligibilityConstraintLifetimes = this.actorEligibilityConstraintLifetimes.filter(lifetime => !removed.has(lifetime.constraintId) && (!lifetime.sourceId || !sourceIds.has(lifetime.sourceId)))
	}
	public isActorEligible(): boolean { return isActorEligible(this.actorEligibilityConstraints) }
	public addEffect(trigger: EffectTrigger, effect: Effect): void {
		switch (trigger) {
			case EffectTrigger.Always: this.effectAlways.push(effect); break
			case EffectTrigger.Collision: this.effectCollision.push(effect); break
			case EffectTrigger.Round: this.effectRound.push(effect); break
			default: console.error("TODO", trigger)
		}
	}

}

function compareCollisionFilters(first: CollisionFilterSettings, second: CollisionFilterSettings): number {
	return (first.sourceOrder ?? 0) - (second.sourceOrder ?? 0) || first.id.localeCompare(second.id);
}

function compareCollisionFilterLifetimes(first: CollisionFilterLifetimeSettings, second: CollisionFilterLifetimeSettings): number {
	return (first.sourceOrder ?? 0) - (second.sourceOrder ?? 0) || first.id.localeCompare(second.id);
}

function compareActorConstraints(first: ActorEligibilityConstraintSettings, second: ActorEligibilityConstraintSettings): number {
	return (first.sourceOrder ?? 0) - (second.sourceOrder ?? 0) || first.id.localeCompare(second.id);
}

function compareActorLifetimes(first: ActorEligibilityConstraintLifetimeSettings, second: ActorEligibilityConstraintLifetimeSettings): number {
	return (first.sourceOrder ?? 0) - (second.sourceOrder ?? 0) || first.id.localeCompare(second.id);
}

function isVector(value: SettingValue): value is Vector2D {
	return typeof value === "object" && value !== null && "x" in value && "y" in value &&
		typeof value.x === "number" && typeof value.y === "number"
}
