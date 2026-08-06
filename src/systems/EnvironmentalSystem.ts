import type { ISerializableSystem, IGameContext } from "./types.js";
import type { EnvironmentalMechanic, EnvironmentalState, MovingStructure, TriggeredZone } from "../environment/environmental.js";

/** Deterministic, tick-driven map lifecycle. It never consults wall-clock time. */
export class EnvironmentalSystem implements ISerializableSystem {
	public readonly systemId = "core.environmental";
	private state: EnvironmentalState;
	constructor(private readonly mechanics: EnvironmentalMechanic[], state?: EnvironmentalState, private readonly structureIndexes: number[] = []) {
		this.state = state ? structuredClone(state) : { tick: 0, active: mechanics.map(mechanic => mechanic.type !== "triggered-zone"), triggerUntil: mechanics.map(() => 0), cooldownUntil: mechanics.map(() => 0), cyclePhase: mechanics.map(() => 0) };
		if (this.state.active.length !== mechanics.length || this.state.triggerUntil.length !== mechanics.length || this.state.cooldownUntil.length !== mechanics.length || this.state.cyclePhase.length !== mechanics.length) throw new Error("Malformed environmental state")
		if (!Number.isSafeInteger(this.state.tick) || !this.state.active.every(isBoolean) || !this.state.triggerUntil.every(Number.isSafeInteger) || !this.state.cooldownUntil.every(Number.isSafeInteger) || !this.state.cyclePhase.every(Number.isSafeInteger)) throw new Error("Malformed environmental lifecycle state")
	}
	public toSettings() { return { systemId: this.systemId, schemaVersion: 1 as const, state: { ...structuredClone(this.state), mechanics: structuredClone(this.mechanics), structureIndexes: [...this.structureIndexes] } as Record<string, unknown> }; }
	public ticker(ctx: IGameContext): void {
		this.state.tick++;
		for (let index = 0; index < this.mechanics.length; index++) {
			const mechanic = this.mechanics[index]!;
			let active = this.state.active[index]!;
			if (mechanic.type === "timed-hazard") active = this.state.tick >= mechanic.startTick && ((this.state.tick - mechanic.startTick) % mechanic.intervalTicks) < mechanic.durationTicks;
			else if (mechanic.type === "triggered-zone") active = this.updateTrigger(mechanic, index, ctx);
			else if (mechanic.type === "environmental-cycle") {
				const total = mechanic.phases.reduce((sum, phase) => sum + phase.durationTicks, 0);
				let offset = this.state.tick % total; let phase = 0;
				while (offset >= mechanic.phases[phase]!.durationTicks) offset -= mechanic.phases[phase]!.durationTicks, phase++;
				this.state.cyclePhase[index] = phase; active = mechanic.phases[phase]!.enabled;
			}
			this.state.active[index] = active;
			const structure = ctx.structures[this.structureIndexes[index]!];
			if (!structure) continue;
			if (mechanic.type === "moving-structure" && "getPos" in structure && "setPos" in structure) this.move(structure as unknown as { getPos(): { x: number; y: number }; setPos(pos: { x: number; y: number }): void }, mechanic);
			if ("setPhysicsEnabled" in structure) (structure as { setPhysicsEnabled(enabled: boolean): void }).setPhysicsEnabled(active);
		}
	}
	private updateTrigger(mechanic: TriggeredZone, index: number, ctx: IGameContext): boolean {
		if (this.state.triggerUntil[index]! > this.state.tick) return true;
		if (this.state.cooldownUntil[index]! > this.state.tick) return false;
		const entered = ctx.entities.getEntities().some(entity => {
			if (mechanic.ownerTeam !== undefined && !entity.getTeam().includes(mechanic.ownerTeam)) return false;
			const p = entity.getPos(); const dx = p.x - mechanic.triggerZone.x; const dy = p.y - mechanic.triggerZone.y;
			return dx * dx + dy * dy <= mechanic.triggerZone.r * mechanic.triggerZone.r;
		});
		if (entered) {
			this.state.triggerUntil[index] = this.state.tick + mechanic.durationTicks;
			this.state.cooldownUntil[index] = this.state.triggerUntil[index]! + (mechanic.cooldownTicks ?? 0);
		}
		return entered;
	}
	private move(structure: { getPos(): { x: number; y: number }; setPos(pos: { x: number; y: number }): void }, mechanic: MovingStructure): void {
		const origin = mechanic.structure; const progress = (this.state.tick % mechanic.periodTicks) / mechanic.periodTicks;
		const t = mechanic.loop === false && this.state.tick >= mechanic.periodTicks ? 1 : progress;
		const base = { x: origin.x, y: origin.y }; structure.setPos({ x: base.x + (mechanic.to.x - base.x) * t, y: base.y + (mechanic.to.y - base.y) * t });
	}
}

function isBoolean(value: unknown): value is boolean { return typeof value === "boolean" }
