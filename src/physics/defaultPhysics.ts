import type { EntityManager } from "../entity/EntityManager.js";
import type { FrictionSettings } from "../settings/settings.js";
import { forwardVectorFromRotation, getShapeName, SHAPE, type IPhysics, type PhysicsStrategy, type Vector2D } from "./physics.js";

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

	public checkCollision(entityA: IPhysics<SHAPE>, entityB: IPhysics<SHAPE>): boolean {
		switch (true) {
			case entityA.getShape() == SHAPE.CIRCLE && entityB.getShape() == SHAPE.CIRCLE:
				return this.checkCollisionCircles(entityA as IPhysics<SHAPE.CIRCLE>, entityB as IPhysics<SHAPE.CIRCLE>)
			case entityA.getShape() == SHAPE.RECTANGLE && entityB.getShape() == SHAPE.RECTANGLE:
				return this.checkCollisionRects(entityA as IPhysics<SHAPE.RECTANGLE>, entityB as IPhysics<SHAPE.RECTANGLE>)
			case entityA.getShape() == SHAPE.CIRCLE && entityB.getShape() == SHAPE.RECTANGLE:
				return this.checkCollisionCircleRect(entityA as IPhysics<SHAPE.CIRCLE>, entityB as IPhysics<SHAPE.RECTANGLE>)
			case entityA.getShape() == SHAPE.CIRCLE && entityB.getShape() == SHAPE.LINE:
				return this.checkCollisionCircleLine(entityA as IPhysics<SHAPE.CIRCLE>, entityB as IPhysics<SHAPE.LINE>)
			case entityA.getShape() == SHAPE.LINE && entityB.getShape() == SHAPE.CIRCLE:
				return this.checkCollisionCircleLine(entityB as IPhysics<SHAPE.CIRCLE>, entityA as IPhysics<SHAPE.LINE>)
			default:
				console.log(`Collision not implemented for ${getShapeName(entityA.getShape())} ${getShapeName(entityB.getShape())}`)
		}
		return false
	}

	public checkCollisionCircles(entityA: IPhysics<SHAPE.CIRCLE>, entityB: IPhysics<SHAPE.CIRCLE>): boolean {
		const d2 = this.distSq(entityA.getPos(), entityB.getPos());
		const rSum = entityA.getBounds().x + entityB.getBounds().x;

		return d2 <= (rSum * rSum);
	}

	public checkCollisionRects(entityA: IPhysics<SHAPE.RECTANGLE>, entityB: IPhysics<SHAPE.RECTANGLE>): boolean {
		const { x: Ax, y: Ay } = entityA.getPos()
		const { x: Bx, y: By } = entityB.getPos()
		return Ax <= Bx + entityB.getBounds().x &&
			Ax + entityA.getBounds().x >= Bx &&
			Ay <= By + entityB.getBounds().y &&
			Ay + entityA.getBounds().y >= By;
	}

	public checkCollisionCircleRect(entityA: IPhysics<SHAPE.CIRCLE>, entityB: IPhysics<SHAPE.RECTANGLE>): boolean {
		const { x: Ax, y: Ay } = entityA.getPos()
		const { x: Bx, y: By } = entityB.getPos()
		const closest = {
			x: this.clamp(Ax, Bx, Bx + entityB.getBounds().x),
			y: this.clamp(Ay, By, By + entityB.getBounds().y)
		};
		const d2 = this.distSq(entityA.getPos(), closest);
		return d2 <= (entityA.getBounds().x * entityA.getBounds().x);
	}

	public checkCollisionCircleLine(circle: IPhysics<SHAPE.CIRCLE>, line: IPhysics<SHAPE.LINE>): boolean {
		const start = line.getPos();
		const end = line.getBounds();
		const segment = { x: end.x - start.x, y: end.y - start.y };
		const lengthSq = this.magSq(segment);
		const center = circle.getPos();
		const factor = lengthSq === 0 ? 0 : this.clamp(this.dot(this.sub(center, start), segment) / lengthSq, 0, 1);
		const closest = this.add(start, this.mult(segment, factor));
		return this.distSq(center, closest) <= circle.getBounds().x ** 2;
	}

	public handleCollision(entityA: IPhysics<SHAPE>, entityB: IPhysics<SHAPE>): void {
		const posA = { ...entityA.getPos() };
		const posB = { ...entityB.getPos() };
		const dist = this.dist(posA, posB);

		if (dist === 0) return;

		switch (true) {
			case (entityA.getShape() === SHAPE.CIRCLE && entityB.getShape() === SHAPE.CIRCLE): {
				const radiusA = entityA.getBounds().x;
				const radiusB = entityB.getBounds().x;
				const combinedRadius = radiusA + radiusB;

				if (dist < combinedRadius) {
					const overlap = combinedRadius - dist;
					// 1. Vektor normalisieren
					const nx = (posB.x - posA.x) / dist;
					const ny = (posB.y - posA.y) / dist;

					const invMassA = 1 / entityA.getMass();
					const invMassB = 1 / entityB.getMass();
					const totalInvMass = invMassA + invMassB;

					// --- POSITIONSKORREKTUR (Depenetration) ---
					const slop = 0.05;
					const percent = 0.2;
					const moveMagnitude = (Math.max(overlap - slop, 0) / totalInvMass) * percent;

					const moveA = moveMagnitude * invMassA;
					const moveB = moveMagnitude * invMassB;

					// Wende Korrektur an
					entityA.setPos({ x: posA.x - nx * moveA, y: posA.y - ny * moveA });
					entityB.setPos({ x: posB.x + nx * moveB, y: posB.y + ny * moveB });

					// --- IMPULS-ANTWORT (Auf Basis der URSPRÜNGLICHEN Positionen!) ---
					// WICHTIG: Nutze die ursprünglichen Variablen velA/velB, 
					// aber berechne den Impuls basierend auf den Vektoren, 
					// OHNE die veränderten Positionen erneut abzurufen.
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
					}
				}

				entityA.onCollision({ entity: entityB as IPhysics<SHAPE.CIRCLE> });
				entityB.onCollision({ entity: entityA as IPhysics<SHAPE.CIRCLE> });
				break;
			}
			case (entityA.getShape() === SHAPE.RECTANGLE && entityB.getShape() === SHAPE.RECTANGLE): {
				console.error("TODO! /src/phyics/defaultPhysics.ts", entityA.getShape(), entityB.getShape())
				break
			}
			case (entityA.getShape() === SHAPE.CIRCLE && entityB.getShape() === SHAPE.RECTANGLE):
			case (entityA.getShape() === SHAPE.RECTANGLE && entityB.getShape() === SHAPE.CIRCLE): {
				const circle = (entityA.getShape() === SHAPE.CIRCLE ? entityA : entityB) as IPhysics<SHAPE.CIRCLE>;
				const rectangle = (entityA.getShape() === SHAPE.RECTANGLE ? entityA : entityB) as IPhysics<SHAPE.RECTANGLE>;

				const cPos = circle.getPos();
				const rPos = rectangle.getPos();
				const rBounds = rectangle.getBounds();
				const radius = circle.getBounds().x;

				// Finde den nächsten Punkt auf dem Rechteck zum Kreiszentrum
				const closestX = Math.max(rPos.x, Math.min(cPos.x, rPos.x + rBounds.x));
				const closestY = Math.max(rPos.y, Math.min(cPos.y, rPos.y + rBounds.y));

				const dx = cPos.x - closestX;
				const dy = cPos.y - closestY;
				const distanceSq = dx * dx + dy * dy;

				if (distanceSq < radius * radius) {
					const distance = Math.sqrt(distanceSq);

					// Normale berechnen (Richtung der Kollision)
					const nx = distance > 0 ? dx / distance : 0;
					const ny = distance > 0 ? dy / distance : -1;

					const overlap = radius - distance;

					// Massen abrufen
					const m1 = circle.getMass();    // z.B. 1
					const m2 = rectangle.getMass(); // z.B. Infinity oder 9000

					// Inverse Massen für die Berechnung (1/Infinity = 0)
					const invM1 = 1 / m1;
					const invM2 = 1 / m2;
					const invMassSum = invM1 + invM2;
					// 1. Positionskorrektur (Depenetration)
					// Verhindert das Ineinandersteckenbleiben proportional zur Masse
					const totalMove = Math.min(overlap + 0.01, 2.0); // Sicherheits-Clamp

					const EPSILON = 0.05;
					const correction = totalMove + EPSILON;

					// circle.setPos({
					// 	x: cPos.x + nx * totalMove * (invM1 / invMassSum),
					// 	y: cPos.y + ny * totalMove * (invM1 / invMassSum)
					// });
					circle.setPos({
						x: cPos.x + nx * correction,
						y: cPos.y + ny * correction
					});



					if (m2 === Infinity) {
						// Wenn Rechteck unendlich schwer: Schiebe NUR den Kreis aus der Wand
						circle.setPos({
							x: cPos.x + nx * totalMove,
							y: cPos.y + ny * totalMove
						});
					} else {
						// Wenn Rechteck beweglich: Teile den Impuls wie gehabt
						const invM1 = 1 / m1;
						const invM2 = 1 / m2;
						const invMassSum = invM1 + invM2;

						circle.setPos({
							x: cPos.x + nx * totalMove * (invM1 / invMassSum),
							y: cPos.y + ny * totalMove * (invM1 / invMassSum)
						});
						rectangle.setPos({
							x: rPos.x - nx * totalMove * (invM2 / invMassSum),
							y: rPos.y - ny * totalMove * (invM2 / invMassSum)
						});
					}

					// 2. Impuls-Antwort (Geschwindigkeit)
					const v1 = circle.getVel();
					const v2 = rectangle.getVel();

					// Relative Geschwindigkeit in Richtung der Normalen
					const relativeVelX = v1.x - v2.x;
					const relativeVelY = v1.y - v2.y;
					const dot = relativeVelX * nx + relativeVelY * ny;

					// Nur berechnen, wenn die Objekte sich aufeinander zubewegen
					if (dot < 0) {
						// Kombinierter Bounce-Faktor (Durchschnitt oder Minimum beider Partner)
						const bounce = Math.min(circle.getBounceFactor(), rectangle.getBounceFactor());

						// Der Impuls-Skalar (J)
						// Setze ein hartes Limit für den Impuls
						const maxImpulse = 50;
						const j = Math.max(Math.min(-(1 + bounce) * dot / invMassSum, maxImpulse), -maxImpulse);

						// Neue Geschwindigkeiten anwenden
						circle.setVel({
							x: v1.x + (j * nx) * invM1,
							y: v1.y + (j * ny) * invM1
						});

						if (m2 !== Infinity) {
							rectangle.setVel({
								x: v2.x - (j * nx) * invM2,
								y: v2.y - (j * ny) * invM2
							});
						}
					}

					// Event-Trigger und Sync
					circle.setPos(circle.getPos());
					circle.setVel(circle.getVel());
					rectangle.setPos(rectangle.getPos());
					rectangle.setVel(rectangle.getVel());

					circle.onCollision({ entity: rectangle });
					rectangle.onCollision({ entity: circle });
				}
				break;
			}
		}
	}

	public applyImpulse(entity: IPhysics<SHAPE>, angle: number, power: number): void {
		const mass = entity.getMass();
		if (mass === Infinity) return;

		const direction = forwardVectorFromRotation(angle);
		const force = this.mult(direction, power);

		const currentVel = entity.getVel();
		entity.setVel({
			x: currentVel.x + (force.x / mass),
			y: currentVel.y + (force.y / mass)
		});
	}

	public getFriction(): number {
		return this.friction
	}
	public getStopThreshold(): number { return this.stopThreshold }

	public applyFriction(entity: IPhysics<SHAPE>, dt: number): void {
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
		console.info(who, "Set Physics to: ", { friction: this.friction, linearDrag: this.linearDrag, stopThreshold: this.stopThreshold })
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
		const direction = forwardVectorFromRotation(angle);
		return this.calculateStop(startPos, this.mult(direction, power));
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
	toSettings(): FrictionSettings {
		return {
			friction: this.friction,
			linearDrag: this.linearDrag,
			stopThreshold: this.stopThreshold
		}
	}


	public isStatic(entities: EntityManager): boolean {
		// Epsilon ist unser Toleranzwert. 
		// Alles unter 0.1 Pixel/Sekunde gilt als "stehend".
		const epsilon = 0.1;

		return entities.getEntities().every(e => {
			const vel = e.getVel();
			return Math.abs(vel.x) < epsilon && Math.abs(vel.y) < epsilon;
		});
	}

}
