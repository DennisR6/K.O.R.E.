import type { GameStateType, TurnPacket } from "../engine/types";
import type { EntityManager } from "../entity/EntityManager";
import type { Settings } from "../settings/settings";
import type { Structure } from "../structures/structures";

export interface IPlayback extends ISystem {
	play(packet: TurnPacket): void;
	stop(): void;
	isLooping(): boolean;
}

export interface IGameContext {
	entities: EntityManager;
	structures: Structure[];
	state: GameStateType;
	settings: Settings;
}

export interface ISystem {
	update(ctx: IGameContext, dt: number, friction: number): void;
}
