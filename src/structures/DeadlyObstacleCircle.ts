import type { RenderContext } from "../engine/RenderContext";
import { Player } from "../entity/Player.ts";
import type { IPhysics } from "../physics/physics";
import { StructureCircle } from "./structureCircle";

export class DeadlyObstacleCirle extends StructureCircle {
	constructor(x: number, y: number, r: number, color: string) {
		super(x, y, r, color)
	}

	public onCollision({ entity }: { entity: IPhysics; }): void {
		if (entity instanceof Player) {
			entity.addHP(-100)
			console.log("Player", entity)
			return
		}
		console.log("Collision", entity, entity instanceof Player)
		//TODO: PLAYER NEEDS TO BE KILLED
	}

	public override draw(ctx: RenderContext): void {
		ctx.setFillColor("green")

		const { x, y } = this.getPos()
		const { x: r } = this.getBounds()

		ctx.drawCircle(x, y, r * 2)
	}
}
