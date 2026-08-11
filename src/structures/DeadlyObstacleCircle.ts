import type { FullEffectSettings } from "../effects/types.js";
import type { RenderContext } from "../kore/runtime/RenderContext.js";
import type { IEntity } from "../entity/Entity.js";
import { Player } from "../entity/Player.js";
import { StructureCircle } from "./structureCircle.js";

export class DeadlyObstacleCirle extends StructureCircle {
	secondaryColor: string = "green"
	constructor(x: number, y: number, r: number, color: string | undefined, effects: FullEffectSettings[]) { super(x, y, r, color, effects) }

	public onCollision({ entity }: { entity: IEntity }): void {
		if (!(entity instanceof Player)) return
		entity.dispatchNumericAdd("hp", -100);
		return
	}

	public override draw(ctx: RenderContext): void {
		if (!this.getColor()) return

		ctx.push()
		const { x, y } = this.getPos()
		const { x: r } = this.getBounds()
		ctx.setFillColor(this.secondaryColor)
		ctx.setStrokeColor(this.secondaryColor)
		ctx.drawCircle(x, y, r * 2)
		ctx.setFillColor(this.getColor()!)
		ctx.setStrokeColor(this.getColor()!)
		ctx.drawCircle(x, y, r)
		ctx.pop()
	}
}
