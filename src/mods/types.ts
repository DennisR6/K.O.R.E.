import type { LoadedContentPackage } from "../kore/sdk/index.js";

/** Where the imported JSON came from; browser adapters fill these kinds. */
export type ModSource =
	| { kind: "file"; fileName: string }
	| { kind: "paste" };

export type ModErrorCategory =
	| "parse"
	| "size"
	| "schema"
	| "content"
	| "reference"
	| "security"
	| "io";

/** Actionable, user-facing error information; never a raw exception object. */
export interface ModError {
	category: ModErrorCategory;
	/** User-facing message with a fix hint where known. */
	message: string;
	/** Raw validator/parser detail for operators and debug surfaces. */
	detail?: string;
}

export type ModStatus = "empty" | "invalid" | "valid";

/**
 * Owns the imported mod document. Only validated, detached SDK data is kept;
 * the original document is never stored by reference and never mutated.
 */
export interface ModDocumentState {
	status: ModStatus;
	source: ModSource | undefined;
	/** The last imported raw text (defensive copy for display). */
	rawText: string;
	/** Detached validated package, present only when status is "valid". */
	package: LoadedContentPackage | undefined;
	/** Canonical content hash from the public SDK. */
	hash: string | undefined;
	error: ModError | undefined;
}

export function createEmptyModState(): ModDocumentState {
	return { status: "empty", source: undefined, rawText: "", package: undefined, hash: undefined, error: undefined };
}
