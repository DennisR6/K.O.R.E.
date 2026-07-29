import { SHAPE, type IPhysics } from "../physics/physics.js";

type MapStructure = IPhysics<SHAPE>;
type ContainmentBoundary = IPhysics<SHAPE.CIRCLE> | IPhysics<SHAPE.RECTANGLE>;

/** Returns enclosing circle or rectangle structures; line segments are obstacles only. */
export function getOuterContainmentBoundaries(structures: MapStructure[]): ContainmentBoundary[] {
	return structures.filter((candidate): candidate is ContainmentBoundary => {
		if (candidate.getShape() === SHAPE.LINE) return false;
		const boundary = candidate as ContainmentBoundary;
		const enclosedStructures = structures.filter(structure => structure !== candidate && structure.getShape() !== SHAPE.LINE);
		return enclosedStructures.length > 0 && enclosedStructures.every(structure => containsPoint(boundary, structure.getPos()));
	});
}

/** Returns whether a full player circle remains inside a containment boundary. */
export function containsCircle(boundary: ContainmentBoundary, circle: IPhysics<SHAPE.CIRCLE>): boolean {
	const center = circle.getPos();
	const radius = circle.getBounds().x;
	if (boundary.getShape() === SHAPE.CIRCLE) {
		const outerRadius = boundary.getBounds().x - radius;
		const outerCenter = boundary.getPos();
		return outerRadius >= 0 && (center.x - outerCenter.x) ** 2 + (center.y - outerCenter.y) ** 2 <= outerRadius ** 2;
	}
	const position = boundary.getPos();
	const bounds = boundary.getBounds();
	return center.x - radius >= position.x && center.x + radius <= position.x + bounds.x &&
		center.y - radius >= position.y && center.y + radius <= position.y + bounds.y;
}

function containsPoint(boundary: ContainmentBoundary, point: { x: number, y: number }): boolean {
	if (boundary.getShape() === SHAPE.CIRCLE) {
		const center = boundary.getPos();
		return (point.x - center.x) ** 2 + (point.y - center.y) ** 2 <= boundary.getBounds().x ** 2;
	}
	const position = boundary.getPos();
	const bounds = boundary.getBounds();
	return point.x >= position.x && point.x <= position.x + bounds.x && point.y >= position.y && point.y <= position.y + bounds.y;
}
