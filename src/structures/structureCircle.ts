import type { RenderContext } from "../engine/RenderContext"
import type { IPhysics, IPhysicsCircle, Vector2D } from "../physics/physics"
import { GameLogger } from "../utils/log"
import type { IStructure } from "./structures"

export class StructureCircle implements IStructure, IPhysicsCircle {
	x: number
	y: number
	r: number
	color: string
	shape: "circle"
	bounce: number
	vel: Vector2D
	mass: number = 9000;
	friction: number | undefined
	constructor(x: number, y: number, r: number, color: string) {
		this.shape = "circle"
		this.x = x
		this.y = y
		this.r = r
		this.color = color || "green"
		this.bounce = 1
		this.vel = { x: 0, y: 0 }
	}
	draw(ctx: RenderContext) {
		ctx.setFillColor(this.color)
		ctx.drawCircle(this.x, this.y, this.r * 2)
		ctx.drawImage("/eis.png", this.x - this.r * 2, this.y - this.r * 2, this.r * 4, this.r * 4)
	}
	update(_dt: number): void { }

	getBounceFactor(): number {
		return this.bounce
	}
	getBounds(): { radius: number } {
		return { radius: this.r }
	}
	getPos(): Vector2D {
		return { x: this.x, y: this.y }
	}
	getVel(): Vector2D {
		return this.vel
	}
	setVel(vel: Vector2D): void {
		this.vel = vel
	}
	setMass(mass: number): void {
		this.mass = mass
	}
	getMass(): number {
		return this.mass
	}
	setPos(pos: Vector2D): void {
		this.x = pos.x
		this.y = pos.y
	}
	onCollision({ entity }: { entity: IPhysics }): void {
		GameLogger.debug("Collision with:" + entity.getShape())
	}
	getFriction(): number {
		return 0
	}
	setFriction(_friction: number): void { }
	getShape(): "circle" { return this.shape }

}

