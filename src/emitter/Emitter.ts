export type IInput = { actorId: string | number, angle: number, power: number }

export { CombiEmitter, LogEmitter } from "./InputEmitter.ts"
export { SocketEmitter } from "./SocketEmitter.ts"
export { ObjectEmitter } from "./ObjectEmitter"
export { GameEmitter } from "./EngineEmitter"

export function calcMousePositionFromInput(
	origin: { x: number, y: number },
	vec: { angle: number, power: number }
): { x: number, y: number } {
	const rad = vec.angle * (Math.PI / 180);
	return { x: origin.x + Math.cos(rad) * vec.power, y: origin.y + Math.sin(rad) * vec.power };
}

