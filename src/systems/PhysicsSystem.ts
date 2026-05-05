import type { IEntity } from "../entity/entity";
import type { PhysicsStrategy } from "../physics/physics";
import type { IGameContext, ISystem } from "./types";

export class PhysicsSystem implements ISystem {
	private readonly STOP_THRESHOLD = 0.01;
	DEFAULTFPS = 1000 / 60;
	strategy: PhysicsStrategy
	constructor(strategy: PhysicsStrategy, fps: number = 60) {
		this.strategy = strategy
		this.DEFAULTFPS = 1000 / fps
		strategy.printSettings("Physics")
	}

	update(ctx: IGameContext, dt: number, friction: number): void {
		let totalMovement = 0;
		this.resolveAllCollisions(ctx);

		ctx.entities.getEntities().forEach((entity: IEntity) => {
			this.strategy.applyFriction(entity, dt)
			entity.update(dt, friction);

			const speed = Math.sqrt(entity.getVel().x ** 2 + entity.getVel().y ** 2);
			if (speed < this.STOP_THRESHOLD) {
				entity.setVel({ x: 0, y: 0 });
			} else {
				totalMovement += speed;
			}
		});
	}

	private resolveAllCollisions(ctx: IGameContext) {
		const { entities, structures } = ctx;
		const enitityArr = entities.getEntities()
		for (let i = 0; i < enitityArr.length; i++) {
			const entityA = enitityArr[i];

			for (let j = i + 1; j < enitityArr.length; j++) {
				const entityB = enitityArr[j];
				if (this.strategy.checkCollision(entityA, entityB)) {
					this.strategy.handleCollision(entityA, entityB);
				}
			}

			for (let j = 0; j < structures.length; j++) {
				const structureB = structures[j];
				if (this.strategy.checkCollision(entityA, structureB)) {
					this.strategy.handleCollision(entityA, structureB);
				}
			}
		}
	}
}
