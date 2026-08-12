import { audio, AudioEmitter, type AudioCommand, type ISoundEmitter } from "@coffeemakerstudio/roast";
import { presentation, type AnimationSettings, type PresentationFrame, type PresentationOutputPort, type PresentationRuntimeSettings } from "@coffeemakerstudio/roast";
import { assertJsonValue, type JsonValue } from "@coffeemakerstudio/roast";
import type { IDrawer, ITicker, RenderContext } from "./runtime/RenderContext.js";

export enum KoreGameplayFeedbackType {
	Shot = "shot", Collision = "collision", Damage = "damage", Shield = "shield", Item = "item",
	Hazard = "hazard", Elimination = "elimination", Turn = "turn", Result = "result", Message = "message",
}

export type KoreGameplayFeedbackEvent = {
	schemaVersion: 1;
	sequence: number;
	turnNumber: number;
	type: KoreGameplayFeedbackType;
	actorId?: string;
	targetIds?: string[];
	data?: JsonValue;
};
export type KoreGameplayFeedbackTraceSettings = { schemaVersion: 1; sequence: number; events: KoreGameplayFeedbackEvent[] };

const TYPES = new Set(Object.values(KoreGameplayFeedbackType));
function clone<T>(value: T): T { return structuredClone(value); }
function validId(value: string): void { if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(value)) throw new Error("Invalid feedback ID"); }
function validateEvent(event: KoreGameplayFeedbackEvent): void {
	if (event.schemaVersion !== 1 || !Number.isSafeInteger(event.sequence) || event.sequence < 0 || !Number.isSafeInteger(event.turnNumber) || event.turnNumber < 0 || !TYPES.has(event.type)) throw new Error("Malformed gameplay feedback event");
	if (event.actorId !== undefined) validId(event.actorId);
	if (event.targetIds !== undefined) { if (!Array.isArray(event.targetIds)) throw new Error("Malformed feedback targets"); event.targetIds.forEach(validId); }
	if (event.data !== undefined) assertJsonValue(event.data);
}

/** Authoritative event history. It is deliberately not part of EngineSettings. */
export class GameplayFeedbackTrace {
	private readonly events: KoreGameplayFeedbackEvent[];
	private sequence: number;
	public constructor(settings: Partial<KoreGameplayFeedbackTraceSettings> = {}) {
		this.sequence = settings.sequence ?? 0; this.events = (settings.events ?? []).map(clone);
		this.events.forEach(validateEvent); if (this.events.some((event, index) => event.sequence !== index)) throw new Error("Feedback sequence must be contiguous");
		if (this.sequence < this.events.length) throw new Error("Invalid feedback sequence");
	}
	public record(type: KoreGameplayFeedbackType, turnNumber: number, details: Omit<KoreGameplayFeedbackEvent, "schemaVersion" | "sequence" | "turnNumber" | "type"> = {}): KoreGameplayFeedbackEvent {
		const event = { schemaVersion: 1 as const, sequence: this.sequence++, turnNumber, type, ...clone(details) };
		validateEvent(event); this.events.push(event); return clone(event);
	}
	public list(fromSequence = 0): KoreGameplayFeedbackEvent[] { return this.events.slice(fromSequence).map(clone); }
	public toSettings(): KoreGameplayFeedbackTraceSettings { return { schemaVersion: 1, sequence: this.sequence, events: this.list() }; }
}

const ANIMATION_TYPES = Object.values(KoreGameplayFeedbackType);
function animation(type: KoreGameplayFeedbackType): AnimationSettings {
	return presentation.createAnimation({ id: `kore.feedback.${type}`, channel: `feedback.${type}`, durationTicks: type === KoreGameplayFeedbackType.Result ? 12 : 6, priority: type === KoreGameplayFeedbackType.Result ? 100 : 20, interruption: "replace", tracks: [{ id: "opacity", keyframes: [{ tick: 0, value: 1 }, { tick: type === KoreGameplayFeedbackType.Result ? 8 : 3, value: 0 }] }] });
}

export const KORE_FEEDBACK_ANIMATIONS = ANIMATION_TYPES.map(animation);
export const KORE_FEEDBACK_AUDIO: Record<KoreGameplayFeedbackType, string> = {
	shot: "kore.game.shot", collision: "kore.game.collision", damage: "kore.game.damage", shield: "kore.game.shield",
	item: "kore.game.item", hazard: "kore.game.hazard", elimination: "kore.game.elimination", turn: "kore.game.turn", result: "kore.game.result", message: "kore.ui.message",
};

/** Renderer-independent adapter. Unsupported presentation/audio output is non-fatal. */
export class KoreGameplayFeedbackSurface implements ITicker, IDrawer, ISoundEmitter {
	private readonly runtime;
	private readonly sounds = new AudioEmitter("kore.feedback");
	private frame: PresentationFrame;
	private visible: KoreGameplayFeedbackEvent[] = [];
	public readonly soundSourceId = this.sounds.soundSourceId;
	public constructor(runtimeSettings?: PresentationRuntimeSettings, private readonly output?: PresentationOutputPort) {
		this.runtime = presentation.createRuntime("kore.feedback", { animations: KORE_FEEDBACK_ANIMATIONS, ...(runtimeSettings ?? {}) });
		this.frame = this.runtime.project();
	}
	public accept(event: KoreGameplayFeedbackEvent): void {
		validateEvent(event); this.visible.push(clone(event));
		this.runtime.emit(presentation.play(`feedback:${event.sequence}:${event.type}`, `kore.feedback.${event.type}`, event.data === undefined ? {} : { payload: event.data }));
		try { this.sounds.emit(audio.command.play({ sourceId: this.soundSourceId, soundId: KORE_FEEDBACK_AUDIO[event.type], bus: "effects", priority: event.type === KoreGameplayFeedbackType.Result ? 80 : 20, dedupeKey: `feedback:${event.sequence}` })); } catch { /* optional output */ }
	}
	public tick(_dt: number): void { this.frame = this.runtime.tick(); try { this.output?.apply(this.frame); } catch { /* unsupported renderer */ } }
	public draw(renderer: RenderContext): void {
		const last = this.visible[this.visible.length - 1]; if (!last) return;
		const animation = this.frame.animations.find(item => item.channel === `feedback.${last.type}`);
		if (!animation) { this.visible = []; return; }
		const opacity = animation.values.opacity;
		if (typeof opacity !== "number") return;
		renderer.push();
		renderer.setOpacity(opacity);
		renderer.setFillColor("white");
		if (last.type === KoreGameplayFeedbackType.Item) renderer.drawImage("public/items/placeholder.svg", renderer.WORLD_SIZE_X / 2 - 92, 8, 32, 32);
		renderer.drawText(feedbackLabel(last), renderer.WORLD_SIZE_X / 2 - 70, 32, 16);
		renderer.pop();
	}
	public drainSoundCommands(): AudioCommand[] { return this.sounds.drainSoundCommands(); }
	public getFrame(): PresentationFrame { return clone(this.frame); }
	public toPresentationSettings(): PresentationRuntimeSettings { return this.runtime.toSettings(); }
}

function feedbackLabel(event: KoreGameplayFeedbackEvent): string {
	if (event.type === KoreGameplayFeedbackType.Result) return "Match complete";
	if (event.type === KoreGameplayFeedbackType.Message && event.data && typeof event.data === "object" && !Array.isArray(event.data) && typeof event.data.message === "string") return event.data.message;
	if (event.type === KoreGameplayFeedbackType.Item && event.data && typeof event.data === "object" && !Array.isArray(event.data) && typeof event.data.itemId === "string") return `Item activated: ${event.data.itemId}`;
	if (event.type === KoreGameplayFeedbackType.Item && event.data && typeof event.data === "object" && !Array.isArray(event.data) && typeof event.data.rewardName === "string") return `Mystery Box: ${event.data.rewardName}`;
	return event.type[0]!.toUpperCase() + event.type.slice(1);
}
