import { EntityManager } from "../entity/EntityManager";
import type { EntitySnapshot } from "../entity/types";
import type { PhysicsStrategy } from "../physics/physics";
import type { Structure } from "../structures/structures";
import type { PhysicsSystem } from "../systems/PhysicsSystem";
import type { IGameContext, ISystem } from "../systems/types";

export interface TurnPacket {
	actorId: string | number;
	input: { angle: number; power: number };
	durationFrames: number;
	finalState: EntitySnapshot[];
}

export interface ISimulator {
	step(physics: PhysicsSystem, dt: number, entities: EntityManager, structures: Structure[]): void;
	isStatic(entities: EntityManager): boolean;
}

export interface IInputEmitter {
	sendShot(actorId: string | number, angle: number, power: number): void;
}
export const createDefaultContext = (overrides: Partial<IGameContext> = {}): IGameContext => {
	return {
		state: GameState.YOUR_TURN,
		entities: new EntityManager([]),
		structures: [],
		settings: { id: "", screenResolution: { x: 16, y: 9 } },
		...overrides
	};
}
export const GameState = {
	WAITING_FOR_PLAYERS: "WAITING_FOR_PLAYERS",
	STARTING: "STARTING",
	YOUR_TURN: "YOUR_TURN",
	OPPONENTS_TURN: "OPPONENTS_TURN",
	SIMULATING: "SIMULATING",
	SIMULATING_DONE: "SIMULATING_DONE",
	PLAYING: "PLAYING",
	PLAYING_DONE: "PLAYING_DONE",
	GOAL_SCORED: "GOAL_SCORED",
	TURN_DONE: "TURN_DONE",
	GAME_OVER: "GAME_OVER",
} as const;
export type GameStateType = keyof typeof GameState;
export interface IMouse {
	handleMousePressed(mouseX: number, mouseY: number): void;
	updateMouse(mouseX: number, mouseY: number): void;
	handleMouseReleased(): void;
}

export type HandlerDependencies = {
	context: IGameContext;
	entityManager: EntityManager;
	physicsStrategy: PhysicsStrategy;
	inputEmitter: IInputEmitter;
	systems: ISystem[]
};
export type IInput = { actorId: string | number, angle: number, power: number }
