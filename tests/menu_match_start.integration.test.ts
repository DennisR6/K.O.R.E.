import { expect, test } from "bun:test";
import { LocalMatchSceneRouter } from "../src/scenes/LocalMatchSceneRouter.ts";
import { createCanonicalPlayableMatchHandler } from "../src/settings/canonicalPlayableMatch.ts";

test("menu route creates one canonical local match and preserves menu on factory failure", () => {
	let created = 0;
	const router = new LocalMatchSceneRouter(() => { created++; return createCanonicalPlayableMatchHandler(); });
	const menu = router.getHandler();
	expect(router.startLocalMatch()).toBe(true);
	expect(router.startLocalMatch()).toBe(false);
	expect(created).toBe(1);
	expect(router.getHandler()).not.toBe(menu);
	expect(router.getHandler().getSettings()?.gameMode?.id).toBe("local-ice-duel-v1");

	const failed = new LocalMatchSceneRouter(() => { throw new Error("bad settings"); });
	const failedMenu = failed.getHandler();
	expect(failed.startLocalMatch()).toBe(false);
	expect(failed.getHandler()).toBe(failedMenu);
	expect(failed.getError()).toBe("bad settings");
});
