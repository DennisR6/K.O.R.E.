import type { UUID } from "crypto";
import { AssetList } from "../assetManager/assets/assetRegistry.js";
import type { RenderContext } from "../engine/RenderContext.js";
import type { IItem } from "../item/Items.js";
import { SHAPE, type IPhysics, type Vector2D } from "../physics/physics.js";
import type { IEntity } from "./Entity.js";
import type { EngineSettingsEntity } from "./types.js";
import { EffectTrigger, EffectType, type Effect, type FullEffectSettings } from "../effects/types.js";
import { MetaEffect } from "../effects/effects.js";
import type { SettingsEntity } from "../settings/settings.js";


/**
 * Das Konfigurations-Interface für einen Spieler.
 * 
 * Es dient als Vorlage (Data Transfer Object), um einen Spieler mit 
 * individuellen Eigenschaften wie Teamzugehörigkeit, Farbe oder Icons zu erstellen.
 * Alle Eigenschaften außer den Koordinaten sind optional, um maximale Flexibilität
 * beim Erstellen von Gast-Accounts oder Standard-Entities zu bieten.
 */
interface IPlayerType {
	/** 
	 * Eindeutige ID des Spielers. 
	 * Wenn nicht angegeben, generiert die Engine eine neue UUID. 
	 */
	id?: UUID;

	position: Vector2D,
	/** 
	 * Team-Zugehörigkeit. 
	 * Kann genutzt werden, um Kollisionen im selben Team zu ignorieren 
	 * oder für die Punkteberechnung.
	 */
	team?: number[];

	/** 
	 * Die Primärfarbe des Spielers.
	 * Wird vom Renderer genutzt, um den Kreis oder Effekte einzufärben.
	 */
	color?: string;

	/** 
	 * Pfad oder Schlüssel für das Icon/Avatar.
	 * Der P5Renderer nutzt dies, um die entsprechende Textur aus dem Cache zu laden.
	 */
	playericon?: AssetList;

	/** 
	 * Der physikalische Radius (Größe) des Spielers.
	 * Standardwert ist meist 12, falls hier nichts definiert wird.
	 */
	size?: number;
	hoop?: AssetList;
	effects?: FullEffectSettings[]
}

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
	private shape: SHAPE.CIRCLE
	private hoop: AssetList
	private isPhysicsEnabled: boolean = true
	private dead: boolean = false
	private items: IItem[] = []
	private effectAlways: Effect[] = []
	private effectCollision: Effect[] = []
	private effectRound: Effect[] = []

	constructor() {
		// Standardwerte für ein leeres Objekt
		this.id = crypto.randomUUID()
		this.position = { x: 0, y: 0 }
		this.color = "red"
		this.playericon = AssetList.picturePenguinPenguinIdleFrame1PNG
		this.shape = SHAPE.CIRCLE
		this.velocity = { x: 0, y: 0 } as Vector2D
		this.bouncyness = 1
		this.friction = undefined;
		this.size = 20;
		this.mass = 1
		this.hoop = AssetList.pictureReifenWEBP
	}

	/**
		 * Initialisiert den Spieler mit echten Daten.
		 * Berechnet die Position so, dass der Ankerpunkt in der Mitte liegt.
		 * @param player - Die Konfigurationsdaten (IPlayer).
		 */
	public new(player: IPlayerType) {
		this.setId(player.id || crypto.randomUUID())
		this.setPos({ ...player.position })
		this.team = player.team ?? this.team;
		this.setColor(player.color ?? "red")
		this.setPlayerIcon(player.playericon ?? this.playericon)
		this.setSize(player.size ?? 20)
		this.shape = SHAPE.CIRCLE;
		this.hoop = player.hoop ?? AssetList.pictureReifenPNG
		for (const eff of player.effects ?? []) {
			switch (eff.trigger) {
				case EffectTrigger.Always: this.effectAlways.push(new MetaEffect(eff)); break
				case EffectTrigger.Collision: this.effectCollision.push(new MetaEffect(eff)); break
				case EffectTrigger.Round: this.effectRound.push(new MetaEffect(eff)); break
				default: console.error("TODO", eff.trigger)
			}
		}
		return this;
	}

	/**
		 * Zeichnet den Spieler und einen Richtungsvektor.
		 * Der Richtungsvektor hilft dem Spieler zu sehen, wohin sich der Puck bewegt.
		 */
	public draw(ctx: RenderContext): void {
		// if (this.hp <= 0) return
		ctx.drawImage(this.hoop, this.position.x - this.size, this.position.y - this.size, this.size * 2, this.size * 2);
		ctx.drawImage(this.playericon, this.position.x - this.size, this.position.y - this.size, this.size * 2, this.size * 2);
	}

	/**
		 * Integriert die Geschwindigkeit in die Position basierend auf der vergangenen Zeit.
		 * @param deltaTime - Zeit seit dem letzten Physik-Schritt.
		 */
	public tick(deltaTime: number, _globalFriction: number) {
		this.effectAlways.forEach(effect => {
			if (effect.getType() == EffectType.Movement) effect.apply(this, { x: this.velocity.x, y: this.velocity.y, deltaTime })
			if (effect.getType() == EffectType.Physics) effect.apply(this, 12)
		})
	}

	public setId(id: UUID): void { this.id = id }
	public getId(): UUID { return this.id }
	public setMass(inertia: number): void { this.mass = Math.min(inertia, 1) }
	public getMass(): number { return this.mass }
	public setVel(v: { x: number, y: number }) { this.velocity.x = v.x; this.velocity.y = v.y; }
	public getVel() { return { x: this.velocity.x, y: this.velocity.y }; }
	public setBounceFactor(bounce: number): void { this.bouncyness = bounce }
	public getBounds(): Vector2D { return { x: this.size, y: this.size } }
	public getBounceFactor(): number { return this.bouncyness }
	public setPos(pos: Vector2D): void { this.position = { x: pos.x, y: pos.y }; }
	public getPos(): Vector2D { return { x: this.position.x, y: this.position.y } }

	public setFriction(friction: number | undefined): void { this.friction = friction }
	public getFriction(): number | undefined { return this.friction }
	public getSize(): Vector2D { return { x: this.size, y: this.size } }
	public addHP(hp: number): void { this.hp += hp; }
	public getHP(): number { return this.hp }
	public setColor(color: string): void { this.color = color }
	public getColor(): string { return this.color }
	public setPlayerIcon(icon: AssetList): void { this.playericon = icon; }
	public setSize(size: number): void { this.size = size; }
	public getShape(): SHAPE.CIRCLE { return this.shape }

	public onCollision({ entity: _ }: { entity: IPhysics<SHAPE>; }): void {
		this.effectCollision.forEach(effect => {
			effect.apply(this)
		})
	}
	public getTeam(): number[] { return this.team }
	public isActive(): boolean { return !this.dead }
	public physicsEnabled(): boolean { return this.isPhysicsEnabled }
	public setHP(hp: number): void { this.hp = hp }
	public setPhysicsEnabled(physicsEnabled: boolean): void { this.isPhysicsEnabled = physicsEnabled }
	// public AddItem(item: IItem): void { }
	// public getInventory(): IItem[] { return [] }
	public use(_item: IItem): void { }

	public toSettings(): EngineSettingsEntity {
		const sett0 = this.effectAlways.map(x => { return { ...x.toSettings(), trigger: EffectTrigger.Always, triggerValue: [] } as FullEffectSettings })
		const sett1 = this.effectCollision.map(x => { return { ...x.toSettings(), trigger: EffectTrigger.Collision, triggerValue: [] } as FullEffectSettings })
		const sett2 = this.effectRound.map(x => { return { ...x.toSettings(), trigger: EffectTrigger.Round, triggerValue: [] } as FullEffectSettings })
		return {
			id: this.getId(),
			position: this.position,
			velocity: this.velocity,
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
		}
	}
	public setTeam(team: number[]) { this.team = team }
	public setHoop(asset: AssetList) { this.hoop = asset }
	public setBouncyness(bouncyness: number) { this.bouncyness = bouncyness }
	public setIsDead(dead: boolean) { this.dead = dead }
	public AddItem(item: IItem): void { this.items.push(item) }
	public getInventory(): IItem[] { return this.items }
	public isDead(): boolean { return this.dead }
	public getEffects(): Effect[] { return [...this.effectAlways, ...this.effectCollision] }
	public addEffect(trigger: EffectTrigger, effect: Effect): void {
		switch (trigger) {
			case EffectTrigger.Always: this.effectAlways.push(effect); break
			case EffectTrigger.Collision: this.effectCollision.push(effect); break
			case EffectTrigger.Round: this.effectRound.push(effect); break
			default: console.error("TODO", trigger)
		}
	}


	public fromSettings(settings: SettingsEntity | EngineSettingsEntity): this {
		this.setId(settings.id || crypto.randomUUID())
		this.setPos({ ...settings.position })
		this.team = settings.team ?? this.team;
		this.setColor(settings.color ?? "red")
		this.setPlayerIcon(settings.playericon ?? this.playericon)
		this.setSize(settings.size ?? 20)
		this.shape = SHAPE.CIRCLE;
		this.hoop = settings.hoop ?? AssetList.pictureReifenPNG
		if ("velocity" in settings) this.velocity = settings.velocity;
		if ("effects" in settings) {
			for (const eff of settings.effects ?? []) {
				switch (eff.trigger) {
					case EffectTrigger.Always: this.effectAlways.push(new MetaEffect(eff)); break
					case EffectTrigger.Collision: this.effectCollision.push(new MetaEffect(eff)); break
					case EffectTrigger.Round: this.effectRound.push(new MetaEffect(eff)); break
					default: console.error("TODO", eff.trigger)
				}
			}
		}
		return this;
	}
}


export function createPlayerFromSettings(settings: EngineSettingsEntity): Player {
	const player = new Player()
	player.setId(settings.id)
	player.setPos(settings.position)
	player.setVel(settings.velocity)
	player.setPlayerIcon(settings.playericon)
	player.setTeam(settings.team)
	player.setHoop(settings.hoop)
	player.setColor(settings.color)
	player.setSize(settings.size)
	player.setHP(settings.hp)
	player.setBouncyness(settings.bouncyness)
	player.setMass(settings.mass)
	player.setFriction(settings.friction)
	player.setIsDead(settings.isDead)
	return player
}
