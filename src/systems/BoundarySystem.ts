import { containsCircle, getOuterContainmentBoundaries } from "../structures/containment.js";
import type { IPhysics, SHAPE } from "@coffeemakerstudio/bean";
import type { IGameContext, ISerializableSystem, SystemSettings } from "./types.js";

/** Eliminates active players outside every inferred outer containment boundary. */
export class BoundarySystem implements ISerializableSystem<SystemSettings> {
	public readonly systemId = "core.boundary";
	public toSettings(): SystemSettings { return { systemId: this.systemId, schemaVersion: 1, state: {} }; }
	public ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		const boundaries = getOuterContainmentBoundaries(ctx.structures as unknown as IPhysics<SHAPE>[]);
		if (boundaries.length === 0) return;
		for (const entity of ctx.entities.getEntities()) {
			if (!entity.isDead() && !boundaries.every(boundary => containsCircle(boundary, entity))) entity.setIsDead(true);
		}
	}
}
