import { expect, test } from "bun:test";
import { createCanonicalPlayableMatchSettings, validateReferenceMapSettings } from "../src/settings/canonicalPlayableMatch.ts";

function invalid(mutator: (settings: ReturnType<typeof createCanonicalPlayableMatchSettings>) => void) {
	const settings = createCanonicalPlayableMatchSettings();
	mutator(settings);
	expect(() => validateReferenceMapSettings(settings)).toThrow();
}

test("reference arena has one explicit containment and safe visible spawns", () => {
	const settings = createCanonicalPlayableMatchSettings();
	expect(() => validateReferenceMapSettings(settings)).not.toThrow();
	expect(settings.mapBoundarys.filter(boundary => boundary.role === "containment")).toHaveLength(1);
	expect(settings.mapBoundarys.filter(boundary => boundary.role === "solid").every(boundary => !!boundary.color)).toBe(true);
});

test("reference arena rejects ambiguous containment, invalid structures, and unsafe spawns", () => {
	invalid(settings => { settings.mapBoundarys[1]!.role = "containment"; });
	invalid(settings => { settings.mapBoundarys[0]!.role = "both"; });
	invalid(settings => { const wall = settings.mapBoundarys[1]!; if (wall.type === 2) wall.w = 0; });
	invalid(settings => { settings.players[0]!.position.x = -1; });
	invalid(settings => { settings.players[1]!.position = { ...settings.players[0]!.position }; });
});
