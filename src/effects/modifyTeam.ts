import type { IPhysics, SHAPE } from "@coffeemakerstudio/bean";
import { EffectType, type Effect, type EffectSettings } from "./types.js";

// Lokales Interface, das genau matcht, was eure Player-Klasse anbietet
interface ITeamable {
    setTeam(team: number[]): void;
}

export class EffectModifyTeam implements Effect {
    team: number[];

    constructor({ typeValue }: { typeValue: { team: number[] } }) {
        this.team = typeValue.team;
    }

    // Type Guard: Prüft, ob das Physik-Objekt ein Team setzen kann
    private hasTeam(entity: any): entity is ITeamable {
        return (
            entity !== null &&
            typeof entity === 'object' &&
            'setTeam' in entity &&
            typeof entity.setTeam === 'function'
        );
    }

    apply(entity: IPhysics<SHAPE>, override?: { team: number[] }): void {
        let newTeam = this.team;

        if (override) {
            newTeam = this.team.length === 0 ? override.team : newTeam;
        }

        if (this.hasTeam(entity)) {
            entity.setTeam(newTeam);
        } else {
            console.warn("Dieses Objekt unterstützt keine Team-Zugehörigkeit.");
        }
    }

    getType(): EffectType { return EffectType.Team; }

    toSettings(): EffectSettings {
        return {
            schemaVersion: 1, type: EffectType.Team,
            typeValue: {
                team: this.team
            }
        };
    }
}
