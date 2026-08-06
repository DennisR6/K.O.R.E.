export type ContentQualificationStatus = "pass" | "skip" | "blocked";

export type ContentQualificationBoundary =
	| "determinism"
	| "ai"
	| "replay"
	| "restore"
	| "persistence"
	| "repository"
	| "reconnect-online"
	| "browser"
	| "desktop"
	| "package-validation"
	| "human-playtest";

export interface ContentArtifact {
	milestone: 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48;
	category: "item" | "interaction" | "presentation" | "feedback" | "map" | "mechanic" | "mode" | "package";
	id: string;	description: string;	evidence: string[];
}

export interface ContentQualificationCell {
	artifactId: string;
	boundary: ContentQualificationBoundary;
	status: ContentQualificationStatus;
	evidence: string;
	note?: string;
}

const itemIds = ["anker", "durchlaessigkeit", "magnet", "falltuer", "power-dash", "verzoegerte-mine", "mini-wall", "freeze-shot", "switch", "jaegermeister-elixier", "vodka-zero"] as const;
const mapIds = ["aurora-basin", "lantern-gates", "ember-crossing"] as const;
const mechanicTypes = ["timed-hazard", "triggered-zone", "force-field", "moving-structure", "environmental-cycle"] as const;

export const CONTENT_ARTIFACT_INVENTORY: readonly ContentArtifact[] = [
	...itemIds.map(id => ({ milestone: 41 as const, category: "item" as const, id: `item:${id}`, description: id, evidence: ["tests/item_gameplay_qualification.test.ts", "tests/sdk_item_runtime.test.ts"] })),
	{ milestone: 42, category: "interaction", id: "items:interaction-matrix", description: "stack, replace, reject, ordering, duration, cleanup, and invalid combinations", evidence: ["tests/item_interaction_qualification.test.ts", "tests/item_gameplay_qualification.test.ts"] },
	{ milestone: 43, category: "presentation", id: "presentation:animation-runtime", description: "versioned animations, event ordering, cancellation, interruption, and visual-only state", evidence: ["tests/presentation_sdk.test.ts"] },
	{ milestone: 44, category: "feedback", id: "feedback:kore-gameplay-pack", description: "shot, collision, damage, shield, item, hazard, elimination, turn, and result feedback", evidence: ["tests/gameplay_feedback_pack.test.ts", "tests/gameplay_feedback.test.ts"] },
	...mapIds.map(id => ({ milestone: 45 as const, category: "map" as const, id: `map:${id}`, description: id, evidence: ["tests/competitive_map_pack.test.ts", "tests/support/mapQualification.ts", "tests/browser/map_catalog.e2e.test.ts"] })),
	...mechanicTypes.map(type => ({ milestone: 46 as const, category: "mechanic" as const, id: `mechanic:${type}`, description: type, evidence: ["tests/environmental_mechanics.test.ts"] })),
	...(["quick-slip-v1", "power-rush-v1"] as const).map(id => ({ milestone: 47 as const, category: "mode" as const, id: `mode:${id}`, description: id, evidence: ["tests/milestone47_game_modes.test.ts", "tests/authoritative_ai.test.ts"] })),
	{ milestone: 48, category: "package", id: "package:version-1-fixture", description: "maps, items, modes, UI, audio, and presentation JSON package", evidence: ["tests/content_package.test.ts", "docs/content-package-format.md"] },
];

export const CONTENT_QUALIFICATION_BOUNDARIES: readonly ContentQualificationBoundary[] = ["determinism", "ai", "replay", "restore", "persistence", "repository", "reconnect-online", "browser", "desktop", "package-validation", "human-playtest"];

function statusFor(artifact: ContentArtifact, boundary: ContentQualificationBoundary): ContentQualificationCell {
	const evidence = artifact.evidence[0]!;
	if (boundary === "human-playtest") return { artifactId: artifact.id, boundary, status: "blocked", evidence: "docs/playtest-protocol.md", note: "Subjective evidence is not produced by automation." };
	if (artifact.category === "package" && ["ai", "replay", "restore", "persistence", "reconnect-online", "browser", "desktop"].includes(boundary)) return { artifactId: artifact.id, boundary, status: "skip", evidence, note: "Package declarations are validated before admission; package execution is out of scope." };
	if (boundary === "desktop" && artifact.category !== "package") return { artifactId: artifact.id, boundary, status: "skip", evidence: "tests/desktop_packaging.test.ts", note: "Desktop smoke validates the shared production bundle, not a separate content runtime." };
	if (boundary === "ai" && artifact.category === "presentation" || boundary === "ai" && artifact.category === "feedback") return { artifactId: artifact.id, boundary, status: "skip", evidence, note: "Visual/output declarations do not affect AI decisions." };
	if (boundary === "repository" && ["presentation", "feedback", "interaction"].includes(artifact.category)) return { artifactId: artifact.id, boundary, status: "skip", evidence, note: "Repository approval is a map/package boundary." };
	if (boundary === "reconnect-online" && ["presentation", "feedback", "package", "interaction"].includes(artifact.category)) return { artifactId: artifact.id, boundary, status: "skip", evidence, note: "No authoritative wire document is introduced by this artifact." };
	return { artifactId: artifact.id, boundary, status: "pass", evidence };
}

export const CONTENT_QUALIFICATION_MATRIX: readonly ContentQualificationCell[] = CONTENT_ARTIFACT_INVENTORY.flatMap(artifact => CONTENT_QUALIFICATION_BOUNDARIES.map(boundary => statusFor(artifact, boundary)));

export function canonicalContentJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalContentJson).join(",")}]`;
	if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalContentJson(entry)}`).join(",")}}`;
	return JSON.stringify(value);
}

/** Small deterministic fingerprint for test evidence; it is not a security hash. */
export function contentFingerprint(value: unknown): string {
	let hash = 2166136261;
	for (const byte of new TextEncoder().encode(canonicalContentJson(value))) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
	return hash.toString(16).padStart(8, "0");
}

export interface ContentAction { actorId: string; action: string; payload?: unknown; }

export function compareContentActionTraces(first: readonly ContentAction[], second: readonly ContentAction[]): boolean {
	return canonicalContentJson(first) === canonicalContentJson(second);
}
