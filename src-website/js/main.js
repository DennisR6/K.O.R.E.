import { mapData } from "./state.js";

import { initSidebar, initNewMapButton, initDownload, initImport } from "./ui.js";
import { initMapEditor } from "./editor-map.js";
import { initItemsEditor } from "./editor-items.js";
import { initHazardsEditor } from "./editor-hazards.js";
import { initModesEditor } from "./editor-modes.js";
import { initAIEditor } from "./editor-ai.js";

document.getElementById("btn-preview-popup").addEventListener("click", () => {
    const popup = window.open(
        "http://localhost:5173/",
        "previewPopup",
        "width=1920,height=1080"
    );

    if (popup) popup.focus();
});


window.addEventListener("DOMContentLoaded", () => {
	initSidebar();
	initNewMapButton();
	initDownload();
	initImport();
    

    initMapEditor(mapData);
    initItemsEditor(mapData);
    initHazardsEditor(mapData);
    initModesEditor(mapData);
    initAIEditor(mapData);

	console.log("Slipstrike Editor vollständig initialisiert");
});
