import type { Vector2D } from "@coffeemakerstudio/bean";

export interface CameraBounds {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** A non-panning camera that keeps the complete configured world in view. */
export class FitWorldCamera {
	private worldSize: Vector2D;
	private viewport = { width: 1, height: 1 };
	private scale = 1;

	public constructor(worldSize: Vector2D) {
		this.worldSize = FitWorldCamera.validateSize(worldSize, "world");
	}

	public setWorldSize(worldSize: Vector2D): void {
		this.worldSize = FitWorldCamera.validateSize(worldSize, "world");
		this.updateScale();
	}

	public resize(width: number, height: number): void {
		if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("Camera viewport must have finite positive dimensions");
		this.viewport = { width, height };
		this.updateScale();
	}

	public getScaleFactor(): number { return this.scale; }
	public getWorldBounds(): CameraBounds { return { x: 0, y: 0, w: this.worldSize.x, h: this.worldSize.y }; }
	public getViewportSize(): { width: number, height: number } { return { ...this.viewport }; }
	/** Fit-world framing is fixed at the arena origin, so it cannot leave its limits. */
	public getPosition(): Vector2D { return { x: 0, y: 0 }; }

	public containsCircle(position: Vector2D, radius: number): boolean {
		const bounds = this.getWorldBounds();
		return Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(radius) && radius > 0 &&
			position.x - radius >= bounds.x && position.y - radius >= bounds.y &&
			position.x + radius <= bounds.x + bounds.w && position.y + radius <= bounds.y + bounds.h;
	}

	public worldToViewport(position: Vector2D): Vector2D {
		return { x: position.x * this.scale, y: position.y * this.scale };
	}

	public viewportToWorld(position: Vector2D): Vector2D {
		return { x: position.x / this.scale, y: position.y / this.scale };
	}

	private updateScale(): void {
		this.scale = Math.min(this.viewport.width / this.worldSize.x, this.viewport.height / this.worldSize.y);
		if (!Number.isFinite(this.scale) || this.scale <= 0) throw new Error("Camera transform is invalid");
	}

	private static validateSize(size: Vector2D, label: string): Vector2D {
		if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || size.x <= 0 || size.y <= 0) throw new Error(`Camera ${label} must have finite positive dimensions`);
		return { x: size.x, y: size.y };
	}
}
