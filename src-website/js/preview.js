export const PREVIEW_POPUP_NAME = "previewPopup";
export const PREVIEW_POPUP_FEATURES = "width=1920,height=1080";

export function getPreviewUrl(origin = globalThis.location?.origin) {
	if (!origin || origin === "null") {
		throw new Error("A preview origin is required");
	}

	return new URL("/", origin).href;
}
