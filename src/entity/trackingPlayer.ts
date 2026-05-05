import { Player } from "./entity";

export class TrackerPlayer extends Player {
	private trackingActive: boolean = false;

	constructor(config?: any) {
		super();
		if (config) this.new(config);
	}

	public setTracking(state: boolean) {
		this.trackingActive = state;
	}

	override setPos(pos: { x: number, y: number }): void {
		if (this.trackingActive) {
			console.log(`[TRACKER] setPos auf Entity ${this.getId().toString()}:`, pos);
			console.trace();
		}
		super.setPos(pos);
	}

	override setVel(vel: { x: number, y: number }): void {
		if (this.trackingActive) {
			console.log(`[TRACKER] setVel auf Entity ${this.getId().toString()}:`, vel);
			console.trace();
		}
		super.setVel(vel);
	}

	override update(dt: number, friction: number): void {
		const oldPos = { ...this.getPos() };
		super.update(dt, friction);

		if (this.trackingActive && oldPos.x === 0 && oldPos.y === 0 && this.getPos().x !== 0) {
			console.warn(`[TRACKER] Entity ${this.getId().toString()} bewegt sich vom Nullpunkt weg!`);
		}
	}
}
