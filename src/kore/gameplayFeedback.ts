import { audio, AudioEmitter, type AudioCommand, type ISoundEmitter } from "@coffeemakerstudio/roast";
import { presentation, type AnimationSettings, type PresentationFrame, type PresentationOutputPort, type PresentationRuntimeSettings } from "@coffeemakerstudio/roast";
import { assertJsonValue, type JsonValue } from "@coffeemakerstudio/roast";
import type { IDrawer, ITicker, RenderContext } from "./runtime/RenderContext.js";
import { AssetList, assetKeySource } from "../assetManager/assets/assetRegistry.js";
import { itemIconSource } from "../item/itemIcons.js";

export enum KoreGameplayFeedbackType {
	Shot = "shot", Collision = "collision", Damage = "damage", Shield = "shield", Item = "item",
	Hazard = "hazard", Elimination = "elimination", Turn = "turn", Charge = "charge", Result = "result", Message = "message",
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
	const result = type === KoreGameplayFeedbackType.Result;
	return presentation.createAnimation({ id: `kore.feedback.${type}`, channel: `feedback.${type}`, durationTicks: result ? 36 : 24, priority: result ? 100 : 20, interruption: "replace", tracks: [
		{ id: "opacity", keyframes: [{ tick: 0, value: 1 }, { tick: result ? 28 : 18, value: 0 }] },
		{ id: "scale", keyframes: [{ tick: 0, value: type === KoreGameplayFeedbackType.Shot ? 0.7 : 0.8 }, { tick: result ? 32 : 20, value: result ? 1.25 : 1.15 }] },
	] });
}

export const KORE_FEEDBACK_ANIMATIONS = ANIMATION_TYPES.map(animation);
export const KORE_FEEDBACK_AUDIO: Record<KoreGameplayFeedbackType, string> = {
	shot: "kore.game.shot", collision: "kore.game.collision", damage: "kore.game.damage", shield: "kore.game.shield",
	item: "kore.game.item", hazard: "kore.game.hazard", elimination: "kore.game.elimination", turn: "kore.game.turn", charge: "kore.game.charge", result: "kore.game.result", message: "kore.ui.message",
};

/** Renderer-independent adapter. Unsupported presentation/audio output is non-fatal. */
type WorldPoint = { x: number; y: number };
type FeedbackPositionResolver = (entityId: string) => WorldPoint | undefined;

export class KoreGameplayFeedbackSurface implements ITicker, IDrawer, ISoundEmitter {
	private readonly runtime;
	private readonly sounds = new AudioEmitter("kore.feedback");
	private frame: PresentationFrame;
	private visible: KoreGameplayFeedbackEvent[] = [];
	public readonly soundSourceId = this.sounds.soundSourceId;
	public constructor(runtimeSettings?: PresentationRuntimeSettings, private readonly output?: PresentationOutputPort, private readonly positionOf?: FeedbackPositionResolver) {
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
		const data = feedbackData(last);
		const scale = typeof animation.values.scale === "number" ? animation.values.scale : 1;
		const position = this.positionOf?.(last.actorId ?? last.targetIds?.[0] ?? "");
		if (last.type === KoreGameplayFeedbackType.Item) {
			const itemId = typeof data?.itemId === "string" ? data.itemId : "";
			const source = itemIconSource(itemId) ?? assetKeySource(AssetList.itemsPlaceholderSVG);
			renderer.drawImage(source, renderer.WORLD_SIZE_X / 2 - 92, 8, 32, 32);
		}
		if (position && [KoreGameplayFeedbackType.Shot, KoreGameplayFeedbackType.Charge, KoreGameplayFeedbackType.Collision, KoreGameplayFeedbackType.Shield, KoreGameplayFeedbackType.Item, KoreGameplayFeedbackType.Hazard, KoreGameplayFeedbackType.Damage, KoreGameplayFeedbackType.Elimination].includes(last.type)) this.drawWorldEffect(renderer, last, position, data, scale);
		if (last.type === KoreGameplayFeedbackType.Result) this.drawResultEffect(renderer, scale);
		if (last.type === KoreGameplayFeedbackType.Turn) this.drawTurnEffect(renderer, scale);
		if (last.type === KoreGameplayFeedbackType.Message && data?.kind === "ai-thinking") this.drawThinkingEffect(renderer, scale);
		renderer.drawText(feedbackLabel(last), renderer.WORLD_SIZE_X / 2 - 70, 32, 16);
		renderer.pop();
	}
	public drainSoundCommands(): AudioCommand[] { return this.sounds.drainSoundCommands(); }
	public getFrame(): PresentationFrame { return clone(this.frame); }
	public toPresentationSettings(): PresentationRuntimeSettings { return this.runtime.toSettings(); }

	private drawWorldEffect(renderer: RenderContext, event: KoreGameplayFeedbackEvent, position: WorldPoint, data: Record<string, JsonValue> | undefined, scale: number): void {
		const color = event.type === KoreGameplayFeedbackType.Damage || event.type === KoreGameplayFeedbackType.Elimination ? "#f87171" : event.type === KoreGameplayFeedbackType.Hazard ? "#fb923c" : event.type === KoreGameplayFeedbackType.Shield ? "#60a5fa" : event.type === KoreGameplayFeedbackType.Item ? "#c084fc" : event.type === KoreGameplayFeedbackType.Charge ? "#38bdf8" : "#fef08a";
		renderer.setStrokeColor(color); renderer.setStroke(3); renderer.setNoFill();
		if (event.type === KoreGameplayFeedbackType.Shot || event.type === KoreGameplayFeedbackType.Charge) {
			const angle = typeof data?.angle === "number" ? data.angle * Math.PI / 180 : 0;
			const power = typeof data?.power === "number" ? Math.max(0, Math.min(10, data.power)) : 5;
			const length = (event.type === KoreGameplayFeedbackType.Charge ? 18 + power * 6 : 24 + power * 7) * scale;
			renderer.line(position.x, position.y, position.x + Math.cos(angle) * length, position.y + Math.sin(angle) * length);
			if (event.type === KoreGameplayFeedbackType.Charge) renderer.drawCircle(position.x, position.y, (8 + power * 1.2) * scale);
		} else {
			const radius = (event.type === KoreGameplayFeedbackType.Elimination ? 24 : event.type === KoreGameplayFeedbackType.Shield ? 20 : 14) * scale;
			renderer.drawCircle(position.x, position.y, radius);
			// Procedural sparks use only the immutable feedback sequence, so the
			// burst is identical in live play, restore, and replay.
			const seedAngle = (event.sequence * 0.61803398875) % (Math.PI * 2);
			for (let index = 0; index < 6; index++) {
				const angle = seedAngle + index * Math.PI / 3;
				const inner = radius * 0.8;
				const outer = radius * (1.35 + (index % 2) * 0.25);
				renderer.line(position.x + Math.cos(angle) * inner, position.y + Math.sin(angle) * inner, position.x + Math.cos(angle) * outer, position.y + Math.sin(angle) * outer);
			}
			if (event.type === KoreGameplayFeedbackType.Elimination) {
				const arm = 12 * scale;
				renderer.line(position.x - arm, position.y - arm, position.x + arm, position.y + arm);
				renderer.line(position.x + arm, position.y - arm, position.x - arm, position.y + arm);
			}
			if (event.type === KoreGameplayFeedbackType.Item) renderer.drawCircle(position.x, position.y, 5 * scale);
		}
		renderer.setStroke(0);
	}

	private drawTurnEffect(renderer: RenderContext, scale: number): void {
		const x = renderer.WORLD_SIZE_X / 2;
		const y = renderer.WORLD_SIZE_Y / 2;
		renderer.setStrokeColor("#93c5fd"); renderer.setStroke(3); renderer.setNoFill();
		renderer.line(x - 46 * scale, y, x + 46 * scale, y);
		renderer.line(x + 46 * scale, y, x + 34 * scale, y - 10 * scale);
		renderer.line(x + 46 * scale, y, x + 34 * scale, y + 10 * scale);
		renderer.setStroke(0);
	}

	private drawThinkingEffect(renderer: RenderContext, scale: number): void {
		const x = renderer.WORLD_SIZE_X / 2 - 18;
		const y = renderer.WORLD_SIZE_Y / 2;
		renderer.setFillColor("#c4b5fd");
		for (let index = 0; index < 3; index++) renderer.drawCircle(x + index * 18, y, (4 + index * 2) * scale);
	}

	private drawResultEffect(renderer: RenderContext, scale: number): void {
		const x = renderer.WORLD_SIZE_X / 2;
		const y = renderer.WORLD_SIZE_Y / 2;
		renderer.setStrokeColor("#fef08a"); renderer.setStroke(4); renderer.setNoFill();
		renderer.drawCircle(x, y, 42 * scale); renderer.drawCircle(x, y, 58 * scale);
		renderer.setStroke(0);
	}
}

function feedbackData(event: KoreGameplayFeedbackEvent): Record<string, JsonValue> | undefined {
	return event.data && typeof event.data === "object" && !Array.isArray(event.data) ? event.data as Record<string, JsonValue> : undefined;
}

function feedbackLabel(event: KoreGameplayFeedbackEvent): string {
	if (event.type === KoreGameplayFeedbackType.Result) return "Match complete";
	if (event.type === KoreGameplayFeedbackType.Message && event.data && typeof event.data === "object" && !Array.isArray(event.data) && typeof event.data.message === "string") return event.data.message;
	if (event.type === KoreGameplayFeedbackType.Item && event.data && typeof event.data === "object" && !Array.isArray(event.data) && typeof event.data.itemId === "string") return `Item activated: ${event.data.itemId}`;
	if (event.type === KoreGameplayFeedbackType.Item && event.data && typeof event.data === "object" && !Array.isArray(event.data) && typeof event.data.rewardName === "string") return `Mystery Box: ${event.data.rewardName}`;
	return event.type[0]!.toUpperCase() + event.type.slice(1);
}
