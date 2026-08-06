import { describe, expect, test } from "bun:test";
import { AiBattleSystem } from "../src/ai/AiBattleSystem.js";
import { KoreGameHudSurface } from "../src/kore/ui/KoreGameHudSurface.js";
import { LocalMatchSceneRouter } from "../src/scenes/LocalMatchSceneRouter.js";

describe("KI-vs-KI menu match input surface", () => {
	test("keeps the AI engine HUD-free without changing player matches", () => {
		const router = new LocalMatchSceneRouter(undefined, () => 1234);

		expect(router.startAiBattle()).toBe(true);
		expect(router.getHandler().getMouseHandler()).toBeInstanceOf(AiBattleSystem);
		expect(router.getHandler().getMouseHandler()).not.toBeInstanceOf(KoreGameHudSurface);

		const localRouter = new LocalMatchSceneRouter();
		expect(localRouter.startLocalMatch()).toBe(true);
		expect(localRouter.getHandler().getMouseHandler()).toBeInstanceOf(KoreGameHudSurface);
	});
});
