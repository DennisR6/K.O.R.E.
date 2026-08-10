import type { ModError, ModErrorCategory } from "./types.js";

/** Maps validator/parser failures to actionable user-facing messages. */
export function classifyModError(error: unknown, fallbackCategory: ModErrorCategory = "content"): ModError {
	const detail = error instanceof Error ? error.message : String(error ?? "Unknown error");
	const message = classifyMessage(detail) ?? detail;
	return { category: classifyCategory(detail, fallbackCategory), message, detail };
}

function classifyMessage(detail: string): string | undefined {
	if (detail.includes("Unsupported content package schema version")) {
		return "Unsupported content package schema version. This build of KORE expects schemaVersion 1.";
	}
	if (detail.includes("Malformed content package manifest")) {
		return "Malformed package manifest. The manifest needs a valid id, name, and semver version.";
	}
	if (detail.includes("Duplicate or invalid") && detail.includes("ID")) {
		return "The package contains duplicate or invalid IDs. Every map, item, and mode needs a unique valid id.";
	}
	if (detail.includes("references an unknown item")) {
		return "A game mode references an item that is not declared in the package. Declare the item or fix the reference.";
	}
	if (detail.includes("references an unknown animation")) {
		return "A presentation event references an animation that is not declared in the package.";
	}
	if (detail.includes("Executable or module field")) {
		return "The package contains executable or module fields, which are not allowed.";
	}
	if (detail.includes("Unknown") && detail.includes("field")) {
		return "The package contains unknown fields. Remove unsupported keys or check the field name.";
	}
	if (detail.includes("Malformed JSON")) {
		return "The document is not valid JSON. Check brackets, commas, and quotes.";
	}
	if (detail.includes("too many documents")) {
		return "The package contains too many documents (limit 256).";
	}
	if (detail.includes("too many dependencies")) {
		return "The package declares too many dependencies (limit 32).";
	}
	return undefined;
}

function classifyCategory(detail: string, fallback: ModErrorCategory): ModErrorCategory {
	if (detail.includes("schema version")) return "schema";
	if (detail.includes("references an unknown")) return "reference";
	if (detail.includes("Executable or module field")) return "security";
	if (detail.includes("Malformed JSON")) return "parse";
	return fallback;
}
