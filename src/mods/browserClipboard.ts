import type { ModError } from "./types.js";

export type ReadClipboardResult = { ok: true; text: string } | { ok: false; error: ModError };

/** Pure clipboard-error classifier shared by the DOM adapter and its tests. */
export function clipboardErrorFor(error: unknown): ModError {
	const name = typeof DOMException !== "undefined" && error instanceof DOMException ? error.name : undefined;
	if (name === "NotAllowedError" || name === "SecurityError") {
		return {
			category: "io",
			message: "Clipboard access was denied. Click the paste button again or grant clipboard permission.",
			detail: name,
		};
	}
	return { category: "io", message: "The clipboard could not be read.", detail: error instanceof Error ? error.message : String(error) };
}

/**
 * Browser-only clipboard adapter. Reads text through the user-gesture-scoped
 * Clipboard API; permission and availability failures map to ModError values.
 */
export async function readClipboardText(): Promise<ReadClipboardResult> {
	if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
		return { ok: false, error: { category: "io", message: "Clipboard access is not available in this browser." } };
	}
	try {
		const text = await navigator.clipboard.readText();
		return { ok: true, text };
	} catch (error) {
		return { ok: false, error: clipboardErrorFor(error) };
	}
}
