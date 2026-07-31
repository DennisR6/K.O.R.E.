import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Document Completed Game Systems (Documentation Verification)", () => {
	const agentsMdPath = resolve(process.cwd(), "AGENTS.md");
	const todoMdPath = resolve(process.cwd(), "TODO.md");

	test("AGENTS.md and TODO.md exist and do not reference deleted prototype files", () => {
		const agentsMd = readFileSync(agentsMdPath, "utf-8");
		const todoMd = readFileSync(todoMdPath, "utf-8");

		expect(agentsMd).not.toContain("`src/start.ts`");
		expect(agentsMd).not.toContain("`src/ui/Mouse.ts`");
		expect(todoMd).not.toContain("`src/start.ts`");
		expect(todoMd).not.toContain("`src/ui/Mouse.ts`");
	});

	test("AGENTS.md accurately reflects completed systems", () => {
		const agentsMd = readFileSync(agentsMdPath, "utf-8");

		// Should state that items, AI, rules, boundary elimination, touch, replays, etc. are implemented
		expect(agentsMd).toContain("Items, AI, winning and completed-round rules, out-of-bounds elimination");
		expect(agentsMd).toContain("fully implemented and verified");
	});

	test("TODO.md master inventory reflects completed features across all phases", () => {
		const todoMd = readFileSync(todoMdPath, "utf-8");

		// Check key completed markers
		expect(todoMd).toContain("- [x] Engine = deterministischer Simulator");
		expect(todoMd).toContain("- [x] Gameplay = Daten (JSON / Mods)");
		expect(todoMd).toContain("- [x] Item-Schema");
		expect(todoMd).toContain("- [x] Leicht - Zufallswinkel");
		expect(todoMd).toContain("- [x] Replays");
	});
});
