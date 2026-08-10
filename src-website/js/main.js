import { mapData } from "./state.js";

import { initSidebar, initNewMapButton, initDownload, initImport } from "./ui.js";
import { initMapEditor, restoreMapFields } from "./editor-map.js";
import { initItemsEditor } from "./editor-items.js";
import { initHazardsEditor } from "./editor-hazards.js";
import { initModesEditor } from "./editor-modes.js";
import { initAIEditor } from "./editor-ai.js";
import { restoreEditorDraft, saveEditorDraft } from "./editor-draft.js";
import { getPreviewUrl, PREVIEW_POPUP_FEATURES, PREVIEW_POPUP_NAME } from "./preview.js";

async function loadDebugMap() {
	const response = await fetch(new URL("/public/map.json", window.location.origin), { cache: "no-store" });
	if (!response.ok) throw new Error(`Debug map could not be loaded (${response.status})`);
	const debugMap = await response.json();
	Object.keys(mapData).forEach(key => delete mapData[key]);
	Object.assign(mapData, debugMap);
}

const previewUrl = getPreviewUrl(window.location.origin);
document.getElementById("preview-frame").src = previewUrl;
document.getElementById("btn-preview-popup").addEventListener("click", () => {
	const popup = window.open(
		previewUrl,
		PREVIEW_POPUP_NAME,
		PREVIEW_POPUP_FEATURES
	);

    if (popup) popup.focus();
});


window.addEventListener("DOMContentLoaded", async () => {
	try {
		await loadDebugMap();
	} catch (error) {
		console.warn("Debug map unavailable, using editor defaults", error);
	}
	restoreEditorDraft(mapData);
	initSidebar();
	initNewMapButton();
	initDownload();
	initImport();
	document.getElementById("btn-temp-save").addEventListener("click", () => {
		try {
			if (!saveEditorDraft(mapData)) alert("Temporärer Entwurf konnte nicht gespeichert werden.");
		} catch {
			alert("Die Map enthält ungültige Daten und wurde nicht gespeichert.");
		}
	});
    

    initMapEditor(mapData);
    initItemsEditor(mapData);
    initHazardsEditor(mapData);
    initModesEditor(mapData);
    initAIEditor(mapData);
	restoreMapFields();

	console.log("Slipstrike Editor vollständig initialisiert");
});
