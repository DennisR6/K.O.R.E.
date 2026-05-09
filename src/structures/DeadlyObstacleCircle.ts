import { Player } from "../entity/entity";
import type { IPhysics } from "../physics/physics";
import { StructureCircle } from "./structureCircle";

export class DeadlyObstacleCirle extends StructureCircle {
	constructor(x: number, y: number, r: number, color: string) {
		super(x, y, r, color)
	}
	public getBounds(): { radius: number; } {
		const r = super.getBounds().radius
		return { radius: r }
	}
	public onCollision({ entity }: { entity: IPhysics; }): void {
		console.log("Collision", entity, entity instanceof Player)
	}
}
