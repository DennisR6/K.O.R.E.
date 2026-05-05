export interface EntitySnapshot {
	id: string | number;
	x: number;
	y: number;
	vx: number;
	vy: number;

	rotation?: number;
	isStatic?: boolean;
}
