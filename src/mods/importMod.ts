import { kore } from "../kore/sdk/index.js";
import { classifyModError } from "./errors.js";
import { createEmptyModState, type ModDocumentState, type ModError, type ModSource } from "./types.js";

/** Upper bound for imported mod JSON text. */
export const MOD_JSON_MAX_BYTES = 2 * 1024 * 1024;

export type ParseModResult = { ok: true; value: unknown } | { ok: false; error: ModError };

/** Parses raw JSON text safely with size limits and structured parse errors. */
export function parseModJson(text: string): ParseModResult {
	if (typeof text !== "string") return { ok: false, error: { category: "parse", message: "Expected JSON text input." } };
	if (new TextEncoder().encode(text).length > MOD_JSON_MAX_BYTES) {
		return { ok: false, error: { category: "size", message: "The mod document is too large (limit 2 MB)." } };
	}
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		const position = detail.match(/position (\d+)/)?.[1];
		return {
			ok: false,
			error: {
				category: "parse",
				message: position !== undefined
					? `The document is not valid JSON (syntax error at position ${position}).`
					: "The document is not valid JSON. Check brackets, commas, and quotes.",
				detail,
			},
		};
	}
}

export type ValidateModResult = { ok: true; package: ReturnType<typeof kore.contentPackage.load> } | { ok: false; error: ModError };

/**
 * Validates parsed JSON exclusively through the public KORE content-package
 * boundary. Returns detached SDK documents; the input value is never mutated.
 */
export function validateModJson(value: unknown): ValidateModResult {
	try {
		return { ok: true, package: kore.contentPackage.load(value) };
	} catch (error) {
		return { ok: false, error: classifyModError(error) };
	}
}

/** Full import pipeline: parse, validate, and produce a mod document state. */
export function importModText(text: string, source: ModSource): ModDocumentState {
	const parsed = parseModJson(text);
	if (!parsed.ok) {
		return { ...createEmptyModState(), status: "invalid", source, rawText: text, error: parsed.error };
	}
	const validated = validateModJson(parsed.value);
	if (!validated.ok) {
		return { ...createEmptyModState(), status: "invalid", source, rawText: text, error: validated.error };
	}
	return {
		status: "valid",
		source,
		rawText: text,
		package: validated.package,
		hash: validated.package.hash,
		error: undefined,
	};
}
