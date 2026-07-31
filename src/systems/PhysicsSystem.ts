import type { IEntity } from "../entity/Entity.js";
import { getOuterContainmentBoundaries } from "../structures/containment.js";
import type { IPhysics, PhysicsStrategy, SHAPE } from "../physics/physics.js";
import type { Structure } from "../structures/types.js";
import type { IGameContext, ISystem } from "./types.js";

/**
 * Das Herzstück der Bewegungs-Logik.
 * 
 * Dieses System ist dafür verantwortlich, die physikalischen Gesetze auf alle 
 * Entities anzuwenden. Es nutzt eine injizierte `PhysicsStrategy`, um flexibel 
 * zwischen verschiedenen Physik-Modellen (z.B. Arcade vs. Realistic) zu wechseln.
 * 
 * Der Ablauf pro Tick ist:
 * 1. Kollisionsprüfung (Entity vs. Entity & Entity vs. Structure)
 * 2. Anwenden der Reibung (Friction)
 * 3. Update der Positionen
 * 4. Stoppen von Mikrobewegungen via `STOP_THRESHOLD`
 */
export class PhysicsSystem implements ISystem {
	/** 
	 * Geschwindigkeit, unter der eine Entity als "stehend" betrachtet wird.
	 * Verhindert unendliches "Zittern" durch Gleitkomma-Berechnungen.
	 */
	private readonly STOP_THRESHOLD = 0.01;
	/** Die aktive Rechenlogik für Kollisionen und Reibung. */
	strategy: PhysicsStrategy

	DEFAULTFPS: number;

	/**
	 * @param strategy - Die zu verwendende Physik-Logik.
	 * @param fps - Die Ziel-Framerate, wichtig für die Normierung von `dt`.
	 */
	constructor(strategy: PhysicsStrategy, fps: number = 1) {
		this.strategy = strategy
		this.DEFAULTFPS = fps
		// strategy.printSettings("Physics")
	}

	/**
	 * Orchestriert die Physik-Berechnung pro Tick.
	 * 
	 * Verantworlich für:
	 * - Auflösung von Kollisionen (via Strategy)
	 * - Anwendung von Reibung (via Strategy)
	 * - Finales Positions-Update der Entities
	 * 
	 * @see PhysicsStrategy für die mathematischen Details der Berechnung.
	 */
	ticker(ctx: IGameContext, _dt: number = this.DEFAULTFPS, _friction: number): void {
		let totalMovement = 0;

		this.resolveAllCollisions(ctx);

		ctx.entities.getEntities().forEach((entity: IEntity) => {
			if (entity.isDead() || !entity.physicsEnabled()) return
			// this.strategy.applyFriction(entity, dt)

			// entity.tick(dt, friction);
			// this.constrainToMap(entity, ctx);

			const speed = Math.sqrt(entity.getVel().x ** 2 + entity.getVel().y ** 2);
			if (speed < this.STOP_THRESHOLD) {
				entity.setVel({ x: 0, y: 0 });
			} else {
				totalMovement += speed;
			}
		});
	}

	/**
	 * Berechnet die Physik für den aktuellen Frame.
	 * Wendet Kollisionen und Reibung an und stoppt Objekte, die die 
	 * Mindestgeschwindigkeit unterschreiten.
	 */
	private resolveAllCollisions(ctx: IGameContext) {
		const { entities, structures } = ctx;
		const enitityArr = entities.getEntities().filter(entity => !entity.isDead() && entity.physicsEnabled())
		const containmentBoundaries = new Set<IPhysics<SHAPE>>(
			getOuterContainmentBoundaries(structures as unknown as IPhysics<SHAPE>[]),
		);

		for (let i = 0; i < enitityArr.length; i++) {
			const entityA = enitityArr[i];

			for (let j = i + 1; j < enitityArr.length; j++) {
				const entityB = enitityArr[j];
				if (this.strategy.checkCollision(entityA, entityB)) {
					this.strategy.handleCollision(entityA, entityB);
				}
			}

			for (let j = 0; j < structures.length; j++) {
				const structureB = structures[j] as Structure<SHAPE>;
				if (!structureB.physicsEnabled()) continue
				// Containment-only boundaries must never resolve as filled obstacles.
				if (this.isContainmentOnly(structureB, containmentBoundaries)) continue
				if (this.strategy.checkCollision(entityA, structureB)) {
					this.strategy.handleCollision(entityA, structureB);
				}
			}
		}
	}

	/**
	 * Returns whether a structure serves containment only and must be skipped
	 * by solid-collision resolution. Explicit `"both"` and `"solid"` roles are
	 * always resolved as filled; an explicit `"containment"` role or a
	 * recognized outer containment boundary (default role) is never filled.
	 */
	private isContainmentOnly(structureB: Structure<SHAPE>, containmentBoundaries: Set<IPhysics<SHAPE>>): boolean {
		const role = structureB.getCollisionRole();
		if (role === "both" || role === "solid") return false;
		if (role === "containment") return true;
		return containmentBoundaries.has(structureB);
	}

	//@ts-ignore
	private constrainToMap(entity: IEntity, _ctx: IGameContext) {
		const pos = entity.getPos();
		const radius = entity.getBounds().x; // Angenommen Kreis-Radius
		const bounds = { minX: 0, maxX: 800, minY: 0, maxY: 450 };

		if (pos.x - radius < bounds.minX) {
			entity.setPos({ x: bounds.minX + radius, y: pos.y });
			entity.setVel({ x: 0, y: entity.getVel().y });
		} else if (pos.x + radius > bounds.maxX) {
			entity.setPos({ x: bounds.maxX - radius, y: pos.y });
			entity.setVel({ x: 0, y: entity.getVel().y });
		}

		if (pos.y - radius < bounds.minY) {
			entity.setPos({ x: bounds.minY + radius, y: pos.y });
			entity.setVel({ x: 0, y: entity.getVel().y });
		} else if (pos.y + radius > bounds.maxY) {
			entity.setPos({ x: bounds.maxY - radius, y: pos.y });
			entity.setVel({ x: 0, y: entity.getVel().y });
		}


	}
}
