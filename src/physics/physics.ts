export interface Vector2D {
	x: number;
	y: number;
}
export interface PhysicsStrategy {
	calculateBounce(vel: Vector2D, normal: Vector2D): Vector2D;
	add(a: Vector2D, b: Vector2D): Vector2D
	sub(a: Vector2D, b: Vector2D): Vector2D
	mult(a: Vector2D, b: number): Vector2D
	dot(a: Vector2D, b: Vector2D): number
	magSq(v: Vector2D): number
	mag(v: Vector2D): number
	normalize(v: Vector2D): Vector2D
	dist(a: Vector2D, b: Vector2D): number;
	distSq(a: Vector2D, b: Vector2D): number;
	clamp(val: number, min: number, max: number): number
	//Collisions
	checkCollisionCircles(entityA: IPhysicsCircle, entityB: IPhysicsCircle): boolean;
	checkCollisionRects(entityA: IPhysicsRectangle, entityB: IPhysicsRectangle): boolean;
	checkCollision(entityA: IPhysics, entityB: IPhysics): boolean
	checkCollisionCircleRect(entityA: IPhysicsCircle, entityB: IPhysicsRectangle): boolean;
	handleCollision(entityA: IPhysics, entityB: IPhysics): void
	getFriction(): number
	applyImpulse(entity: IPhysics, angle: number, power: number): void;
	applyFriction(entity: IPhysics, dt: number): void
	calculateStop(startPos: Vector2D, initialVel: Vector2D): Vector2D;
	calculateStopFromInput(startPos: Vector2D, angle: number, power: number): Vector2D;

	//DEBUG
	printSettings(who?: string): void;
}
export type IPhysics = IPhysicsCircle | IPhysicsRectangle
export interface IdefaultPhysics {
	setVel(vel: Vector2D): void;
	setMass(mass: number): void;
	setPos(pos: Vector2D): void
	getPos(): Vector2D;
	getFriction(): number | undefined;
	setFriction(friction: number): void;
	getMass(): number
	getVel(): Vector2D;
	onCollision({ entity }: { entity: IPhysics }): void
	getBounceFactor(): number;
}
export interface IPhysicsCircle extends IdefaultPhysics {
	getShape(): "circle"
	getBounds(): { radius: number }
}
export interface IPhysicsRectangle extends IdefaultPhysics {
	getShape(): "rectangle"
	getBounds(): { width: number, height: number }
}
