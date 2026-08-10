import { MOD_JSON_MAX_BYTES } from "./importMod.js";
import type { ModError } from "./types.js";

export interface ModFileInputCallbacks {
	onText: (text: string, fileName: string) => void;
	onError: (error: ModError) => void;
}

/** Pure size guard shared by the DOM adapter and its tests. */
export function assertModFileSize(bytes: number): ModError | undefined {
	if (Number.isFinite(bytes) && bytes > MOD_JSON_MAX_BYTES) {
		return { category: "size", message: "The mod file is too large (limit 2 MB)." };
	}
	return undefined;
}

/**
 * Browser-only file adapter. Owns the hidden file input element and reads the
 * selected `.json` file; all platform I/O stays outside the KORE SDK.
 */
export function createModFileInput(callbacks: ModFileInputCallbacks): { open(): void; dispose(): void } {
	let input: HTMLInputElement | undefined;
	const open = (): void => {
		if (typeof document === "undefined") {
			callbacks.onError({ category: "io", message: "File selection is not available in this environment." });
			return;
		}
		if (input && input.parentElement) input.parentElement.removeChild(input);
		input = document.createElement("input");
		input.type = "file";
		input.accept = ".json,application/json";
		input.style.position = "fixed";
		input.style.opacity = "0";
		input.style.pointerEvents = "none";
		input.addEventListener("change", () => {
			const file = input?.files?.[0];
			if (input) input.value = "";
			if (!file) return;
			const sizeError = assertModFileSize(file.size);
			if (sizeError) {
				callbacks.onError(sizeError);
				return;
			}
			void file.text().then(
				text => callbacks.onText(text, file.name),
				() => callbacks.onError({ category: "io", message: "The mod file could not be read." }),
			);
		});
		document.body.appendChild(input);
		input.click();
	};
	const dispose = (): void => {
		if (input && input.parentElement) input.parentElement.removeChild(input);
		input = undefined;
	};
	return { open, dispose };
}
