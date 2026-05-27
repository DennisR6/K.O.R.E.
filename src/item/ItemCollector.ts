import type { IPhysics } from "../physics/physics.js"
import { StructureCircle } from "../structures/structureCircle.js"
// import { ItemWall } from "./ItemWall.js"

export class ItemCollector extends StructureCircle {
	private triggered: boolean = false
	constructor(_settings: {}) {
		super(150, 150, 10, "white")
		this.setPhysicsEnabled(false)
	}
	public override onCollision({ entity }: { entity: IPhysics }): void {
		if (!this.triggered) this.triggered = !this.triggered
		super.setColor(undefined)
		//@ts-ignore
		entity.addItem({})
	}
}

