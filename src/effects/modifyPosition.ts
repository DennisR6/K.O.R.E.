import type { IPhysics, SHAPE } from "../physics/physics.js";
import { EffectType, type Effect, type EffectSettings } from "./types.js";

export class EffectModifyPosition implements Effect {
    x: number;
    y: number;

    constructor({ typeValue }: { typeValue: { x: number, y: number } }) {
        this.x = typeValue.x;
        this.y = typeValue.y;
    }

    apply(entity: IPhysics<SHAPE>, override?: { x: number, y: number }): void {
        let posX = this.x;
        let posY = this.y;

        if (override) {
            posX = this.x === 0 ? override.x : posX;
            posY = this.y === 0 ? override.y : posY;
        }

        // Hier übergeben wir die Koordinaten als ein einzelnes Vector2D-Objekt
        entity.setPos({ x: posX, y: posY });
    }

    getType(): EffectType { return EffectType.Position; }

    toSettings(): EffectSettings {
        return {
            type: EffectType.Position,
            typeValue: {
                x: this.x,
                y: this.y
            }
        };
    }
}
