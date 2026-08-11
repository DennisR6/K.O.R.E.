import { presentation } from "@coffeemakerstudio/roast";

/** Renderer-neutral deterministic presentation: only semantic output crosses the adapter boundary. */
export function run(): { tick: number; values: Record<string, unknown>; eventTypes: string[] } {
	const runtime = presentation.createRuntime("example-presentation", { animations: [presentation.createAnimation({ id: "pulse", channel: "hud", durationTicks: 4, priority: 10, interruption: "replace", tracks: [{ id: "scale", keyframes: [{ tick: 0, value: 1 }, { tick: 2, value: 1.2 }, { tick: 4, value: 1 }] }] })] });
	runtime.emit(presentation.play("shot-1", "pulse"));
	const frame = runtime.tick();
	return { tick: frame.tick, values: frame.animations[0]?.values ?? {}, eventTypes: frame.events.map(event => event.type) };
}
