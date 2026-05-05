import type { RenderContext } from "../engine/RenderContext"
import type { IPhysics, IPhysicsRectangle, Vector2D } from "../physics/physics"
import { GameLogger } from "../utils/log"
import type { IStructure } from "./structures"

export class StructureLine implements IStructure, IPhysicsRectangle {
	x: number
	y: number
	x2: number
	y2: number
	color: string
	shape: "rectangle"
	vel: Vector2D
	bounce: number
	mass: number = 9000
	friction: number | undefined
	constructor(x: number, y: number, x2: number, y2: number, color: string) {
		this.x = x
		this.x2 = x2
		this.y = y
		this.y2 = y2
		this.color = color || "green"
		this.shape = "rectangle"
		this.vel = { x: 0, y: 0 }
		this.bounce = 0
	}
	draw(ctx: RenderContext) {
		ctx.setFillColor(this.color)
		ctx.drawRect(this.x, this.y, this.x2, this.y2)
	}
	getBounceFactor(): number {
		return this.bounce
	}
	getBounds(): { width: number; height: number } {
		return { width: this.x2, height: this.y2 }
	}
	getPos(): Vector2D {
		return { x: this.x, y: this.y }
	}
	getVel(): Vector2D {
		return this.vel
	}
	onCollision({ entity }: { entity: IPhysics }): void {
		GameLogger.debug("Collision with:" + entity.getShape())
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
	getFriction(): number {
		return 0
	}
	setFriction(_friction: number): void { }
	update(_deltatime: number, _globalfriction: number): void { }
	getShape(): "rectangle" { return this.shape }
}
