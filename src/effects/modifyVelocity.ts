import type { IPhysics, SHAPE } from "@coffeemakerstudio/bean";
import { EffectType, type Effect, type EffectSettings } from "./types.js";

export class EffectModifyVelocity implements Effect {
    x: number;
    y: number;

    constructor({ typeValue }: { typeValue: { x: number, y: number } }) {
        this.x = typeValue.x;
        this.y = typeValue.y;
    }

    apply(entity: IPhysics<SHAPE>, override?: { x: number, y: number }): void {
        let velX = this.x;
        let velY = this.y;

        if (override) {
            velX = this.x === 0 ? override.x : velX;
            velY = this.y === 0 ? override.y : velY;
        }

        entity.setVel({ x: velX, y: velY });
    }

    getType(): EffectType { return EffectType.Velocity; }

    toSettings(): EffectSettings {
        return {
            schemaVersion: 1, type: EffectType.Velocity,
            typeValue: {
                x: this.x,
                y: this.y
            }
        };
    }
}
