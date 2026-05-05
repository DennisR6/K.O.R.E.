import type { IDrawer, IRenderer, RenderContext } from "../engine/RenderContext";
import type { IPhysics, IPhysicsCircle, Vector2D } from "../physics/physics";
import { GameLogger } from "../utils/log";

export interface IEntity extends IDrawer, IRenderer, IPhysicsCircle {
	getPos(): Vector2D
	getId(): number | string
}

export interface IPlayer {
	id?: number | string,
	x: number,
	y: number,
	team?: string[];
	color?: string,
	playericon?: string
	size?: number
}
export class Player implements IEntity {
	private id: number | string;
	private position: Vector2D
	private team: string[];
	private color: string;
	private playericon: string;
	private shape: "circle"
	private velocity: Vector2D;
	private bouncyness: number;
	private mass: number = 1;
	private size: number;
	private friction: number | undefined

	constructor() {
		this.id = 0
		this.position = { x: 0, y: 0 }
		this.team = []
		this.color = "red"
		this.playericon = ""
		this.shape = "circle"
		this.velocity = { x: 0, y: 0 } as Vector2D
		this.bouncyness = 0.1
		this.friction = undefined;
		this.size = 20;
		this.mass = 1
	}
	new(player: IPlayer) {
		this.id = player.id || crypto.randomUUID();
		this.position = {
			x: player.x - (player.size ?? 20),
			y: player.y - (player.size ?? 20)
		};

		this.velocity = {
			x: (player as any).vx ?? 0,
			y: (player as any).vy ?? 0
		};
		this.team = player.team ?? this.team;
		this.color = player.color ?? this.color;
		this.playericon = player.playericon ?? this.playericon;
		this.size = player.size ?? 20;
		this.shape = "circle";
		return this;
	}
	draw(ctx: RenderContext): void {
		ctx.setFillColor(this.color);
		ctx.drawCircle(this.position.x + this.size, this.position.y + + this.size, this.size * 2);
		const nextX = this.position.x + this.velocity.x * 3;
		const nextY = this.position.y + this.velocity.y * 3;
		if (this.velocity.x !== 0 || this.velocity.y !== 0) {
			ctx.line(this.getPos().x, this.getPos().y, nextX, nextY)
		}
	}
	update(deltaTime: number, _globalFriction: number) {
		this.position.x += this.velocity.x * deltaTime;
		this.position.y += this.velocity.y * deltaTime;
	}

	getBounds(): { radius: number; } {
		return { radius: this.size }
	}
	getVel() { return { x: this.velocity.x, y: this.velocity.y }; }
	getBounceFactor(): number {
		return this.bouncyness
	}
	setVel(v: { x: number, y: number }) {
		this.velocity.x = v.x;
		this.velocity.y = v.y;
	}
	getMass(): number {
		return this.mass
	}
	setMass(inertia: number): void {
		this.mass = Math.min(inertia, 1)
	}
	setPos(pos: Vector2D): void {
		if (
			(this.position.x > pos.x * 1.1 || this.position.x < pos.x * 0.9) ||
			(this.position.y > pos.y * 1.1 || this.position.y < pos.y * 0.9)
		) {
			GameLogger.error("neue Position weicht massiv ab: ", pos, "\nOldPosition: ", this.getPos())
		}
		this.position = { x: pos.x - this.size, y: pos.y - this.size }
	}
	getPos(): Vector2D { return { x: this.position.x + this.size, y: this.position.y + this.size } }
	onCollision({ entity: _ }: { entity: IPhysics; }): void { }
	getFriction(): number | undefined {
		return this.friction
	}
	setFriction(friction: number): void {
		this.friction = friction
	}
	getId(): number | string {
		return this.id
	}
	setId(id: string | number): void {
		this.id = id
	}
	getShape(): "circle" {
		return this.shape
	}
	public enableMutationTracking() {
		this.position = createTrackingProxy(this.position, "POSITION", this.id.toString());
		this.velocity = createTrackingProxy(this.velocity, "VELOCITY", this.id.toString());
	}
}

export function createTrackingProxy(target: any, label: string, entityId: string) {
	return new Proxy(target, {
		set(obj, prop, value) {
			// Wir ignorieren Änderungen von 0 auf 0, um Rauschen zu vermeiden
			if (obj[prop] === value) return true;

			console.warn(`[MUTATION] Entity ${entityId} | ${label}.${String(prop)}: ${obj[prop]} -> ${value}`);
			console.trace(); // Das zeigt uns die exakte Datei und Zeile des Übeltäters

			obj[prop] = value;
			return true;
		}
	});
}
