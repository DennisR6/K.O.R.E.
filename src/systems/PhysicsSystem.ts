import type { IEntity } from "../entity/Entity.js";
import { getOuterContainmentBoundaries } from "../structures/containment.js";
import { SHAPE, MAX_CONTACT_SOLVER_ITERATIONS, PHYSICS_CONTACT_SLOP, CCD_MAX_STEP_SIZE, MAX_CCD_SUBSTEPS, type IPhysics, type PhysicsStrategy } from "../physics/physics.js";
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
	 * Pairs that still touch after the previous completed physics tick. Collision
	 * effects are edge-triggered: persistent contacts continue to resolve but do
	 * not invoke callbacks until a later separation and re-entry.
	 */
	private activeContactPairs = new Set<string>();
	private readonly objectIdentities = new WeakMap<object, number>();
	private nextObjectIdentity = 1;

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
	ticker(ctx: IGameContext, dt: number = this.DEFAULTFPS, _friction: number): void {
		const activeEntities = ctx.entities.getEntities().filter(e => !e.isDead() && e.physicsEnabled());

		let maxDisplacement = 0;
		for (const e of activeEntities) {
			const vel = e.getVel();
			const disp = Math.hypot(vel.x, vel.y) * dt;
			if (disp > maxDisplacement) {
				maxDisplacement = disp;
			}
		}

		const stepSize = CCD_MAX_STEP_SIZE;
		const substeps = maxDisplacement > stepSize
			? Math.min(Math.ceil(maxDisplacement / stepSize), MAX_CCD_SUBSTEPS)
			: 1;

		const contactedPairsThisTick = new Set<string>();
		if (substeps <= 1) {
			this.resolveAllCollisions(ctx, contactedPairsThisTick);
		} else {
			// Substep CCD: rewind entities to start-of-tick position
			for (const e of activeEntities) {
				const vel = e.getVel();
				const pos = e.getPos();
				e.setPos({
					x: pos.x - vel.x * dt,
					y: pos.y - vel.y * dt,
				});
			}

			const subDt = dt / substeps;

			for (let step = 0; step < substeps; step++) {
				for (const e of activeEntities) {
					if (e.isDead() || !e.physicsEnabled()) continue;
					const vel = e.getVel();
					const pos = e.getPos();
					e.setPos({
						x: pos.x + vel.x * subDt,
						y: pos.y + vel.y * subDt,
					});
				}
				this.resolveAllCollisions(ctx, contactedPairsThisTick);
			}
		}

		let totalMovement = 0;
		ctx.entities.getEntities().forEach((entity: IEntity) => {
			if (entity.isDead() || !entity.physicsEnabled()) return;
			const speed = Math.sqrt(entity.getVel().x ** 2 + entity.getVel().y ** 2);
			if (speed < this.STOP_THRESHOLD) {
				entity.setVel({ x: 0, y: 0 });
			} else {
				totalMovement += speed;
			}
		});

		// Only contacts that remain at the end of this complete tick are carried
		// forward. A one-call rectangle/line depenetration must not suppress a
		// later genuine entry merely because it was touched earlier this tick.
		this.activeContactPairs = this.collectCurrentContactPairs(ctx);
	}

	/**
	 * Berechnet die Physik für den aktuellen Frame.
	 * Wendet Kollisionen und Reibung an und stoppt Objekte, die die 
	 * Mindestgeschwindigkeit unterschreiten.
	 */
	private resolveAllCollisions(ctx: IGameContext, contactedPairsThisTick: Set<string> = new Set<string>()) {
		const { entities, structures } = ctx;
		const enitityArr = entities.getEntities().filter(entity => !entity.isDead() && entity.physicsEnabled())
		const containmentBoundaries = new Set<IPhysics<SHAPE>>(
			getOuterContainmentBoundaries(structures as unknown as IPhysics<SHAPE>[]),
		);

		let prevTotalOverlap = Infinity;
		for (let iter = 0; iter < MAX_CONTACT_SOLVER_ITERATIONS; iter++) {
			for (let i = 0; i < enitityArr.length; i++) {
				const entityA = enitityArr[i];

				for (let j = i + 1; j < enitityArr.length; j++) {
					const entityB = enitityArr[j];
					if (this.strategy.checkCollision(entityA, entityB)) {
						this.handlePairCollision(entityA, entityB, contactedPairsThisTick);
					}
				}

				for (let j = 0; j < structures.length; j++) {
					const structureB = structures[j] as Structure<SHAPE>;
					if (!structureB.physicsEnabled()) continue
					// Containment-only boundaries must never resolve as filled obstacles.
					if (this.isContainmentOnly(structureB, containmentBoundaries)) continue
					if (this.strategy.checkCollision(entityA, structureB)) {
						this.handlePairCollision(entityA, structureB, contactedPairsThisTick);
					}
				}
			}

			let totalOverlap = 0;
			for (let i = 0; i < enitityArr.length; i++) {
				const entityA = enitityArr[i];
				for (let j = i + 1; j < enitityArr.length; j++) {
					const entityB = enitityArr[j];
					totalOverlap += this.getOverlapDistance(entityA, entityB);
				}
				for (let j = 0; j < structures.length; j++) {
					const structureB = structures[j] as Structure<SHAPE>;
					if (!structureB.physicsEnabled() || this.isContainmentOnly(structureB, containmentBoundaries)) continue;
					totalOverlap += this.getOverlapDistance(entityA, structureB);
				}
			}

			if (totalOverlap <= 1e-4) {
				break;
			}

			const progress = prevTotalOverlap - totalOverlap;
			if (iter === MAX_CONTACT_SOLVER_ITERATIONS - 1 && totalOverlap > 1e-4 && progress < 1e-4) {
				throw new Error("Unresolved penetration after max solver iterations");
			}
			prevTotalOverlap = totalOverlap;
		}
	}

	private getObjectIdentity(obj: object): string {
		let id = this.objectIdentities.get(obj);
		if (id === undefined) {
			id = this.nextObjectIdentity++;
			this.objectIdentities.set(obj, id);
		}
		return String(id);
	}

	private getPairKey(a: object, b: object): string {
		const idA = this.getObjectIdentity(a);
		const idB = this.getObjectIdentity(b);
		return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
	}

	private handlePairCollision(
		entityA: IPhysics<SHAPE>,
		entityB: IPhysics<SHAPE>,
		contactedPairs: Set<string>,
	) {
		const pairKey = this.getPairKey(entityA, entityB);
		if (contactedPairs.has(pairKey) || this.activeContactPairs.has(pairKey)) {
			const origA = entityA.onCollision;
			const origB = entityB.onCollision;
			entityA.onCollision = () => {};
			entityB.onCollision = () => {};
			try {
				this.strategy.handleCollision(entityA, entityB);
			} finally {
				entityA.onCollision = origA;
				entityB.onCollision = origB;
			}
		} else {
			contactedPairs.add(pairKey);
			this.strategy.handleCollision(entityA, entityB);
		}
	}

	/**
	 * Returns the eligible contacts after all solver/CCD passes. This is kept
	 * separate from the per-tick dispatch set so an entry followed by immediate
	 * separation does not become a stale persistent contact.
	 */
	private collectCurrentContactPairs(ctx: IGameContext): Set<string> {
		const contacts = new Set<string>();
		const entities = ctx.entities.getEntities().filter(entity => !entity.isDead() && entity.physicsEnabled());
		const containmentBoundaries = new Set<IPhysics<SHAPE>>(
			getOuterContainmentBoundaries(ctx.structures as unknown as IPhysics<SHAPE>[]),
		);

		for (let i = 0; i < entities.length; i++) {
			const entity = entities[i];
			for (let j = i + 1; j < entities.length; j++) {
				const other = entities[j];
				if (this.strategy.checkCollision(entity, other)) contacts.add(this.getPairKey(entity, other));
			}
			for (const structure of ctx.structures as Structure<SHAPE>[]) {
				if (!structure.physicsEnabled() || this.isContainmentOnly(structure, containmentBoundaries)) continue;
				if (this.strategy.checkCollision(entity, structure)) contacts.add(this.getPairKey(entity, structure));
			}
		}
		return contacts;
	}

	private getOverlapDistance(entityA: IPhysics<SHAPE>, entityB: IPhysics<SHAPE>): number {
		const shapeA = entityA.getShape();
		const shapeB = entityB.getShape();
		if (shapeA === SHAPE.CIRCLE && shapeB === SHAPE.CIRCLE) {
			const cA = entityA as IPhysics<SHAPE.CIRCLE>;
			const cB = entityB as IPhysics<SHAPE.CIRCLE>;
			const dx = cB.getPos().x - cA.getPos().x;
			const dy = cB.getPos().y - cA.getPos().y;
			const dist = Math.hypot(dx, dy);
			const rSum = cA.getBounds().x + cB.getBounds().x;
			const overlap = rSum - dist;
			return Math.max(overlap - PHYSICS_CONTACT_SLOP, 0);
		}
		if (shapeA === SHAPE.CIRCLE && shapeB === SHAPE.RECTANGLE) {
			const c = entityA as IPhysics<SHAPE.CIRCLE>;
			const r = entityB as IPhysics<SHAPE.RECTANGLE>;
			const cPos = c.getPos();
			const rPos = r.getPos();
			const rBounds = r.getBounds();
			const radius = c.getBounds().x;
			const closestX = Math.max(rPos.x, Math.min(cPos.x, rPos.x + rBounds.x));
			const closestY = Math.max(rPos.y, Math.min(cPos.y, rPos.y + rBounds.y));
			const dx = cPos.x - closestX;
			const dy = cPos.y - closestY;
			const distance = Math.hypot(dx, dy);
			const overlap = radius - distance;
			return Math.max(overlap - 0.01, 0);
		}
		if (shapeA === SHAPE.RECTANGLE && shapeB === SHAPE.CIRCLE) {
			return this.getOverlapDistance(entityB, entityA);
		}
		if (shapeA === SHAPE.CIRCLE && shapeB === SHAPE.LINE) {
			const c = entityA as IPhysics<SHAPE.CIRCLE>;
			const l = entityB as IPhysics<SHAPE.LINE>;
			const start = l.getPos();
			const end = l.getBounds();
			const segmentX = end.x - start.x;
			const segmentY = end.y - start.y;
			const lengthSq = segmentX * segmentX + segmentY * segmentY;
			const cPos = c.getPos();
			const factor = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((cPos.x - start.x) * segmentX + (cPos.y - start.y) * segmentY) / lengthSq));
			const closestX = start.x + segmentX * factor;
			const closestY = start.y + segmentY * factor;
			const dx = cPos.x - closestX;
			const dy = cPos.y - closestY;
			const distance = Math.hypot(dx, dy);
			const radius = c.getBounds().x;
			const overlap = radius - distance;
			return Math.max(overlap - 0.01, 0);
		}
		if (shapeA === SHAPE.LINE && shapeB === SHAPE.CIRCLE) {
			return this.getOverlapDistance(entityB, entityA);
		}
		return 0;
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
