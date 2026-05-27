import type { RenderContext } from "../engine/RenderContext";
import type { IGameContext } from "../systems/types";
import type { EffectParams, Frequency, IItem, ItemSettings, Spawn } from "./Items";

export class MinimalItem implements IItem {
	private id: string;
	private name: string;
	private effectType: string[];
	private trigger: string;
	private frequency: Frequency;
	private probability: number;
	private spawn: Spawn;
	private effectParams: EffectParams[];

	constructor(item: Partial<ItemSettings>) {
		this.effectParams = item.effectParams ?? [];
		this.effectType = item.effectType ?? [];
		this.frequency = item.frequency ?? {
			boostFactor: 0,
			healthThreshold: 0,
			intervalRounds: 0,
			killsInterval: 0,
			lastPlayersThreshold: 0,
			mode: ""
		};
		this.id = item.id ?? crypto.randomUUID();
		this.name = item.name ?? "MinimalItem";
		this.probability = item.probability ?? 1;
		this.spawn = item.spawn ?? { areas: [], points: [], type: "" };
		this.trigger = item.trigger ?? "";
	}

	// --- Getter & Setter ---
	setId(id: string): void { this.id = id; }
	getId(): string { return this.id; }

	setName(name: string): void { this.name = name; }
	getName(): string { return this.name; }

	setEffectype(effect: string[]): void { this.effectType = effect; }
	getEffectType(): string[] { return this.effectType; }

	setTrigger(trigger: string): void { this.trigger = trigger; }
	getTrigger(): string { return this.trigger; }

	setFrequency(freq: Frequency): void { this.frequency = freq; }
	getFrequency(): Frequency { return this.frequency; }

	setProbability(prob: number): void { this.probability = prob; }
	getProbability(): number { return this.probability; }

	setSpawn(spawn: Spawn): void { this.spawn = spawn; }
	getSpawn(): Spawn { return this.spawn; }

	setEffectParams(effectParams: EffectParams[]): void { this.effectParams = effectParams; }
	getEffectParams(): EffectParams[] { return this.effectParams; }

	// --- Game Logic Methods ---

	/**
	 * Wird in jedem Frame aufgerufen, um visuelle Elemente zu zeichnen.
	 */
	draw(_ctx: RenderContext): void {
		// Implementierung je nach Item-Typ (z.B. UI-Elemente oder Overlay)
	}

	/**
	 * Wird für physikalische Updates oder Animationen aufgerufen.
	 */
	tick(_deltatime: number, _globalfriction: number): void {
		// Logik für frame-basierte Zeitberechnungen
	}

	/**
	 * Wird für Logik-Updates basierend auf dem Spielzustand aufgerufen.
	 */
	ticker(_ctx: IGameContext, _dt: number, _friction: number): void {
		// Hier implementierst du, was das Item basierend auf ctx.state tun soll
	}
}
