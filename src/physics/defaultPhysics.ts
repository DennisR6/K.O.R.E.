import type { FrictionSettings } from "../settings/settings";
import { GameLogger } from "../utils/log";
import type { IPhysics, IPhysicsCircle, IPhysicsRectangle, PhysicsStrategy, Vector2D } from "./physics";

/**
 * Die Standard-Physik-Strategie der Engine.
 * 
 * Diese Klasse berechnet die Bewegungsdämpfung (Friction & Drag) und 
 * bestimmt die Flugbahnen der Objekte.
 * 
 * @important
 * @constant
 * @readonly
 * Diese Logik ist fest definiert und durch automatisierte Tests 
 * abgesichert. Änderungen an den Formeln in `calculateStop` oder `calculateStopFromInput` 
 * sind untersagt, da sie die Vorhersagbarkeit (Determinismus) des Spiels zerstören würden.
 * Falls du mehr Infos brauchst, findest du diese im Test unter tests/physics.test.ts
 */
export class defaultPhysics implements PhysicsStrategy {
	/** Exponentielle Reibung (Multiplikator pro Frame, z.B. 0.995). */
	friction: number;
	/** Linearer Widerstand (fester Abzug pro Frame). */
	linearDrag: number;
	/** Geschwindigkeits-Grenze, unter der ein Objekt als "stehend" gilt. */
	stopThreshold: number;

	/**
	 * @param settings - Optionale Reibungseinstellungen. Falls leer, werden Standardwerte genutzt.
	 */
	constructor(settings?: FrictionSettings) {
		const defaults = this.getDefaults()
		this.friction = settings?.friction ?? defaults.friction
		this.linearDrag = settings?.linearDrag ?? defaults.linearDrag
		this.stopThreshold = settings?.stopThreshold ?? defaults.stopThreshold
	}

	public getDefaults(): FrictionSettings {
		return {
			friction: 0.995,
			linearDrag: 0.01,
			stopThreshold: 0.1,
		}
	}

	public calculateBounce(vel: Vector2D, normal: Vector2D): Vector2D {
		const n = this.normalize(normal)
		const dot = this.dot(vel, normal)
		return this.sub(vel, this.mult(n, 2 * dot))
	}

	public add(a: Vector2D, b: Vector2D) {
		return { x: a.x + b.x, y: a.y + b.y };
	}

	public sub(a: Vector2D, b: Vector2D) {
		return { x: a.x - b.x, y: a.y - b.y };
	}

	public mult(a: Vector2D, scalar: number) {
		return { x: a.x * scalar, y: a.y * scalar };
	}

	public dot(a: Vector2D, b: Vector2D) {
		return a.x * b.x + a.y * b.y;
	}

	public magSq(v: Vector2D) {
		return v.x * v.x + v.y * v.y;
	}

	public mag(v: Vector2D) {
		return Math.sqrt(v.x * v.x + v.y * v.y);
	}

	public normalize(v: Vector2D) {
		const m = Math.sqrt(v.x * v.x + v.y * v.y);
		return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
	}

	public dist(a: Vector2D, b: Vector2D): number {
		const dx = a.x - b.x;
		const dy = a.y - b.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	public distSq(a: Vector2D, b: Vector2D): number {
		const dx = a.x - b.x;
		const dy = a.y - b.y;
		return dx * dx + dy * dy;
	}

	public clamp(val: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, val))
	}

	public checkCollision(entityA: IPhysics, entityB: IPhysics): boolean {
		switch (true) {
			case entityA.getShape() == "circle" && entityB.getShape() == "circle":
				return this.checkCollisionCircles(entityA as IPhysicsCircle, entityB as IPhysicsCircle)
			case entityA.getShape() == "rectangle" && entityB.getShape() == "circle":
				return this.checkCollisionCircleRect(entityB as IPhysicsCircle, entityA as IPhysicsRectangle);
			case entityA.getShape() == "circle" && entityB.getShape() == "rectangle":
				return this.checkCollisionCircleRect(entityA as IPhysicsCircle, entityB as IPhysicsRectangle)
			case entityA.getShape() == "rectangle" && entityB.getShape() == "rectangle":
				return this.checkCollisionRects(entityA as IPhysicsRectangle, entityB as IPhysicsRectangle)
		}
		return false
	}

	public checkCollisionCircles(entityA: IPhysicsCircle, entityB: IPhysicsCircle): boolean {
		const d2 = this.distSq(entityA.getPos(), entityB.getPos());
		const rSum = entityA.getBounds().radius + entityB.getBounds().radius;
		return d2 <= (rSum * rSum);
	}

	public checkCollisionRects(entityA: IPhysicsRectangle, entityB: IPhysicsRectangle): boolean {
		const { x: Ax, y: Ay } = entityA.getPos()
		const { x: Bx, y: By } = entityB.getPos()
		return Ax <= Bx + entityB.getBounds().width &&
			Ax + entityA.getBounds().width >= Bx &&
			Ay <= By + entityB.getBounds().height &&
			Ay + entityA.getBounds().height >= By;
	}

	public checkCollisionCircleRect(entityA: IPhysicsCircle, entityB: IPhysicsRectangle): boolean {
		const { x: Ax, y: Ay } = entityA.getPos()
		const { x: Bx, y: By } = entityB.getPos()
		const closest = {
			x: this.clamp(Ax, Bx, Bx + entityB.getBounds().width),
			y: this.clamp(Ay, By, By + entityB.getBounds().height)
		};
		const d2 = this.distSq(entityA.getPos(), closest);
		return d2 <= (entityA.getBounds().radius * entityA.getBounds().radius);
	}

	public handleCollision(entityA: IPhysics, entityB: IPhysics): void {
		const posA = { ...entityA.getPos() };
		const posB = { ...entityB.getPos() };
		const dist = this.dist(posA, posB);

		if (entityA.getShape() === "circle") entityA as IPhysicsCircle
		switch (true) {
			case (entityA.getShape() === "circle" && entityB.getShape() === "circle"): {
				//@ts-ignore
				const radiusA = entityA.getBounds().radius;
				//@ts-ignore
				const radiusB = entityB.getBounds().radius!;
				const combinedRadius = radiusA + radiusB;


				if (dist < combinedRadius) {
					const safeDist = dist === 0 ? 0.1 : dist;

					const nx = (posB.x - posA.x) / safeDist;
					const ny = (posB.y - posA.y) / safeDist;

					const invMassA = 1 / entityA.getMass();
					const invMassB = 1 / entityB.getMass();
					const totalInvMass = invMassA + invMassB;

					const overlap = combinedRadius - dist;
					if (totalInvMass > 0) {
						const moveMagnitude = overlap / totalInvMass;
						entityA.setPos({
							x: posA.x - nx * moveMagnitude * invMassA,
							y: posA.y - ny * moveMagnitude * invMassA
						});
						entityB.setPos({
							x: posB.x + nx * moveMagnitude * invMassB,
							y: posB.y + ny * moveMagnitude * invMassB
						});
					}

					const velA = entityA.getVel();
					const velB = entityB.getVel();
					const relVelX = velB.x - velA.x;
					const relVelY = velB.y - velA.y;
					const dotProduct = relVelX * nx + relVelY * ny;

					if (dotProduct < 0) {
						const restitution = Math.min(entityA.getBounceFactor(), entityB.getBounceFactor());

						const impulseMag = (-(1 + restitution) * dotProduct) / totalInvMass;

						entityA.setVel({
							x: velA.x - (impulseMag * nx * invMassA),
							y: velA.y - (impulseMag * ny * invMassA)
						});
						entityB.setVel({
							x: velB.x + (impulseMag * nx * invMassB),
							y: velB.y + (impulseMag * ny * invMassB)
						});

						entityA.onCollision({ entity: entityB });
						entityB.onCollision({ entity: entityA });
					}
				}
				break;
			}
			case (entityA.getShape() === "rectangle" && entityB.getShape() === "rectangle"): {
				console.log("TODO! /src/phyics/defaultPhysics.ts", entityA.getShape(), entityB.getShape())
				break
			}
			case (entityA.getShape() === "circle" && entityB.getShape() === "rectangle"):
			case (entityA.getShape() === "rectangle" && entityB.getShape() === "circle"): {
				const circle = (entityA.getShape() === "circle" ? entityA : entityB) as IPhysicsCircle
				const rectangle = (entityA.getShape() === "rectangle" ? entityA : entityB) as IPhysicsRectangle
				const cPos = circle.getPos();
				const rPos = rectangle.getPos();
				const rBounds = rectangle.getBounds();
				const radius = circle.getBounds().radius;

				const closestX = Math.max(rPos.x, Math.min(cPos.x, rPos.x + rBounds.width));
				const closestY = Math.max(rPos.y, Math.min(cPos.y, rPos.y + rBounds.height));

				const dx = cPos.x - closestX;
				const dy = cPos.y - closestY;
				const distanceSq = dx * dx + dy * dy;

				if (distanceSq < radius * radius) {
					const distance = Math.sqrt(distanceSq);

					const nx = distance > 0 ? dx / distance : 0;
					const ny = distance > 0 ? dy / distance : -1;

					const overlap = radius - distance;
					circle.setPos({
						x: cPos.x + nx * (overlap + 0.01),
						y: cPos.y + ny * (overlap + 0.01)
					});

					const vel = circle.getVel();

					const dot = vel.x * nx + vel.y * ny;

					if (dot < 0) {
						const bounce = circle.getBounceFactor();

						circle.setVel({
							x: vel.x - (1 + bounce) * dot * nx,
							y: vel.y - (1 + bounce) * dot * ny
						});
					}

					circle.setPos(circle.getPos())
					circle.setVel(circle.getVel())
					rectangle.setPos(rectangle.getPos())
					rectangle.setVel(rectangle.getVel())

					circle.onCollision({ entity: rectangle })
					rectangle.onCollision({ entity: circle })
				}
			}
		}
	}

	public applyImpulse(entity: IPhysics, angle: number, power: number): void {
		const mass = entity.getMass();
		if (mass === Infinity) return;

		const radians = (angle * Math.PI) / 180;

		const force = {
			x: Math.cos(radians) * power,
			y: Math.sin(radians) * power
		};

		const currentVel = entity.getVel();

		entity.setVel({
			x: currentVel.x + (force.x / mass),
			y: currentVel.y + (force.y / mass)
		});
	}

	public getFriction(): number {
		return this.friction
	}

	public applyFriction(entity: IPhysics, dt: number): void {
		let { x: vx, y: vy } = entity.getVel();

		const f = Math.pow(this.friction, dt);
		vx *= f;
		vy *= f;

		const speed = Math.sqrt(vx * vx + vy * vy);
		if (speed > 0) {
			const newSpeed = Math.max(0, speed - (this.linearDrag * dt));
			const factor = newSpeed / speed;
			vx *= factor;
			vy *= factor;
		}

		if (Math.sqrt(vx * vx + vy * vy) < this.stopThreshold) {
			vx = 0;
			vy = 0;
		}

		entity.setVel({ x: vx, y: vy });
	}

	public printSettings(who?: string) {
		GameLogger.debug(who, "Set Physics to: ", { friction: this.friction, linearDrag: this.linearDrag, stopThreshold: this.stopThreshold }, new Error().stack)
	}

	/**
		 * Berechnet den Zielpunkt eines Schusses voraus, basierend auf Winkel und Kraft.
		 * Nützlich für die Flugbahn-Vorschau (Predictor).
		 * 
		 * @param startPos - Startkoordinate des Schusses.
		 * @param angle - Winkel in Grad (0-360).
		 * @param power - Die Schusskraft (initiale Geschwindigkeit).
		 * @returns {Vector2D} Der Punkt, an dem das Objekt theoretisch liegen bleibt.
		 */
	public calculateStopFromInput(
		startPos: Vector2D,
		angle: number,
		power: number
	): Vector2D {
		const radians = (angle * Math.PI) / 180;

		let vx = Math.cos(radians) * power;
		let vy = Math.sin(radians) * power;

		return this.calculateStop(startPos, { x: vx, y: vy });
	}

	/**
		 * Der mathematische Kern der Engine.
		 * Simuliert die Bewegung eines Objekts bis zum Stillstand in einer Schleife.
		 * 
		 * Die Dämpfung erfolgt in zwei Schritten:
		 * 1. Exponentiell: vx *= friction (simuliert Luftwiderstand/Gleiten).
		 * 2. Linear: speed - linearDrag (simuliert Bodenhaftung/Rollwiderstand).
		 * 
		 * @param startPos - Startposition.
		 * @param initialVel - Initiale Geschwindigkeit (Vektor).
		 * @returns {Vector2D} Die Endposition nach der Simulation (max. 2000 Iterationen).
		 */
	public calculateStop(startPos: Vector2D, initialVel: Vector2D): Vector2D {
		let x = startPos.x;
		let y = startPos.y;
		let vx = initialVel.x;
		let vy = initialVel.y;

		for (let i = 0; i < 2000; i++) {
			vx *= this.friction;
			vy *= this.friction;

			const speed = Math.sqrt(vx * vx + vy * vy);
			if (speed < this.stopThreshold || speed === 0) break;

			const newSpeed = Math.max(0, speed - this.linearDrag);
			const factor = newSpeed / speed;
			vx *= factor;
			vy *= factor;

			x += vx;
			y += vy;
		}
		return { x, y };
	}
}
