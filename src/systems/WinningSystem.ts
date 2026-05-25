import type { IGameContext, ISystem } from "./types";

export class Winning implements ISystem {
	ticker(_ctx: IGameContext, _dt: number, _friction: number): void { }

}
