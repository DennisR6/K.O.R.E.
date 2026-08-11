import { describe, expect, test } from "bun:test";
import { AssetPreloader, preloadRenderableAssets, type AssetPreloadSource } from "../src/assetManager/preloader.js";
import { EngineAssetManager } from "../src/assetManager/loader.js";
import { collectAssetReferences } from "@coffeemakerstudio/roast";

describe("render asset discovery", () => {
	test("collects explicit render fields and deduplicates them", () => {
		const image = "https://example.test/arena.png";
		expect(collectAssetReferences({
			background: { type: "image", url: image },
			players: [{ playericon: 3, hoop: image }, { playericon: 3 }],
			screens: [{ elements: [{ kind: "image", source: "ui.png" }, { kind: "label", text: image }] }],
			items: [{ id: "not-an-asset", effect: { image: "not-an-asset" } }],
		})).toEqual([image, 3, "ui.png"]);
	});
});

describe("asset preloader", () => {
	test("starts each unique missing reference once and reports failures", async () => {
		const calls: Array<string | number> = [];
		const states = new Map<string | number, "missing" | "loading" | "ready" | "failed">();
		const source: AssetPreloadSource = {
			getState(reference) { return states.get(reference) ?? "missing"; },
			async preload(reference) {
				calls.push(reference);
				states.set(reference, reference === "broken.png" ? "failed" : "ready");
			},
		};

		const summary = await preloadRenderableAssets({
			background: { type: "image", url: "arena.png" },
			players: [{ playericon: "arena.png" }],
			screens: [{ elements: [{ kind: "image", source: "broken.png" }] }],
		}, source);

		expect(calls).toEqual(["arena.png", "broken.png"]);
		expect(summary).toMatchObject({ references: 2, uniqueAssets: 2, started: 2, completed: 1, failed: 1 });
	});

	test("is one-shot for one scene lifecycle", async () => {
		let calls = 0;
		const source: AssetPreloadSource = {
			getState: () => "missing",
			preload: async () => { calls++; },
		};
		const preloader = new AssetPreloader();
		const first = preloader.warm({ background: { type: "image", url: "arena.png" } }, source);
		const second = preloader.warm({ background: { type: "image", url: "other.png" } }, source);
		expect(second).toBe(first);
		await first;
		expect(calls).toBe(1);
	});
});

describe("authoritative asset cache", () => {
	test("deduplicates concurrent loads and exposes ready state", async () => {
		let fetches = 0;
		const image = { src: "", decode: async () => undefined } as unknown as HTMLImageElement;
		const manager = new EngineAssetManager({
			fetchImpl: async () => { fetches++; return new Response(new Blob(["image"]), { status: 200 }); },
			imageFactory: () => image,
		});
		const first = manager.preload("sprite.png");
		const second = manager.preload("sprite.png");
		expect(second).toBe(first);
		await first;
		expect(fetches).toBe(1);
		expect(manager.getState("sprite.png")).toBe("ready");
		expect(manager.get("sprite.png")).toBe(image);
	});
});
