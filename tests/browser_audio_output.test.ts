import { expect, test } from "bun:test";
import { BrowserAudioOutput } from "../src/audio/BrowserAudioOutput.ts";
import { type AudioCommandBatch, type ResolvedAudioCommand } from "../src/engine/audio-sdk/index.ts";
import { AudioManager, type BrowserAudioElement } from "../src/menu/AudioManager.ts";

class FakeAudio implements BrowserAudioElement {
	public volume = 1; public loop = false; public onended: ((event: Event) => unknown) | null = null; public pauses = 0; public plays = 0;
	public constructor(public src: string) { }
	public play(): Promise<void> { this.plays++; return Promise.resolve(); }
	public pause(): void { this.pauses++; }
}

function command(value: Omit<ResolvedAudioCommand, "runtimeId" | "globalSourceId" | "sequence">): ResolvedAudioCommand { return { ...value, runtimeId: "runtime", globalSourceId: `runtime:${value.sourceId ?? "system"}`, sequence: 1 } as ResolvedAudioCommand; }
function batch(commands: ResolvedAudioCommand[]): AudioCommandBatch { return { schemaVersion: 1, runtimeId: "runtime", sequence: 1, commands, diagnostics: { collected: commands.length, rejected: 0, deduplicated: 0, droppedByPriority: 0, activePersistentSources: [], outputStatus: "ready", sequence: 1 } }; }

test("browser audio adapter buffers persistent intent while locked and discards transient one-shots", async () => {
	const created: FakeAudio[] = [];
	const manager = new AudioManager(0, url => { const element = new FakeAudio(url); created.push(element); return element; }, id => id === "music" ? "/music.mp3" : id === "click" ? "/click.mp3" : undefined);
	const output = new BrowserAudioOutput(manager);
	output.apply(batch([
		command({ type: "playSound", sourceId: "button", soundId: "click", bus: "ui" }),
		command({ type: "playMusic", sourceId: "menu", soundId: "music", bus: "music", replacementPolicy: "replace-current" }),
	]));
	expect(created).toHaveLength(0);
	expect(manager.getStatus()).toBe("locked");
	await manager.unlock();
	expect(created).toHaveLength(1);
	expect(created[0]!.src).toBe("/music.mp3");
	expect(created[0]!.loop).toBe(true);
	expect(created[0]!.plays).toBe(1);
});

test("browser audio adapter translates bus and source controls into managed media resources", async () => {
	const created: FakeAudio[] = [];
	const manager = new AudioManager(0, url => { const element = new FakeAudio(url); created.push(element); return element; }, () => "/sound.mp3");
	await manager.unlock();
	manager.applyAudioBatch(batch([command({ type: "startLoop", sourceId: "wind", soundId: "wind", bus: "ambience", volume: 0.5 })]));
	expect(created).toHaveLength(1);
	manager.applyAudioBatch(batch([command({ type: "setBusVolume", sourceId: "settings", bus: "ambience", volume: 0.4, muted: false })]));
	expect(created[0]!.volume).toBeCloseTo(0.2);
	manager.applyAudioBatch(batch([command({ type: "stopSource", sourceId: "wind" })]));
	expect(created[0]!.pauses).toBe(1);
});
