import type { IPhysics, SHAPE } from "../physics/physics.js";
import { EffectType, type Effect, type EffectSettings } from "./types.js";

interface IResizable {
    setSize(size: number): void;
}

export class EffectModifySize implements Effect {
    size: number;

    constructor({ typeValue }: { typeValue: { size: number } }) {
        this.size = typeValue.size;
    }

    private isResizable(entity: any): entity is IResizable {
        return (
            entity !== null &&
            typeof entity === 'object' &&
            'setSize' in entity &&
            typeof entity.setSize === 'function'
        );
    }

    apply(entity: IPhysics<SHAPE>, override?: { size: number }): void {
        let size = this.size;
        if (override) {
            size = this.size === 0 ? override.size : size;
        }

        if (this.isResizable(entity)) {
            entity.setSize(size);
        } else {
            console.warn("Dieses Objekt besitzt keine veränderbare Größe.");
        }
    }

    getType(): EffectType { return EffectType.ModifySize; }

    toSettings(): EffectSettings {
        return {
            schemaVersion: 1, type: EffectType.ModifySize,
            typeValue: {
                size: this.size
            }
        };
    }
}
