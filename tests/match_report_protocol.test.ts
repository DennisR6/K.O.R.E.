import { expect, test } from "bun:test";
import { GameSettings } from "../src/settings/settings.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";

test.serial("reports bind the authenticated member to their current match and reject invalid or duplicate payloads", () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database);
	const users = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
	registry.create(GameSettings, users);
	const first = registry.submitMatchReport(users[0], "conduct", "Unsporting conduct");
	expect(first.ok).toBe(true);
	if (!first.ok) throw new Error(first.error);
	expect(first.reportId).toMatch(/^[0-9a-f-]{36}$/);
	expect(registry.submitMatchReport(users[0], "conduct", "again")).toEqual({ ok: false, error: "Report already submitted" });
	expect(registry.submitMatchReport(users[1], "unknown", "text")).toEqual({ ok: false, error: "Invalid report category" });
	expect(registry.submitMatchReport(users[1], "other", "")).toEqual({ ok: false, error: "Invalid report text" });
	database.close();
});
