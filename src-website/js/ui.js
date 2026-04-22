import { mapData, resetMapData } from "./state.js";
import {
	renderWalls,
	renderHoles,
	renderPlayers,
	restoreMapFields
} from "./editor-map.js";


// ---------------------------------------------------------
// SIDEBAR NAVIGATION
// ---------------------------------------------------------
export function initSidebar() {

<<<<<<< HEAD
    document.querySelectorAll(".sidebar li[data-target]").forEach(li => {
=======
	// Nur echte Navigationseinträge (mit data-target)
	document.querySelectorAll(".sidebar li[data-target]").forEach(li => {
>>>>>>> a1cded1ecef2d1a08c918766c100d408632e3ea1

		li.addEventListener("click", () => {

			// Navigation markieren
			document.querySelectorAll(".sidebar li[data-target]").forEach(x =>
				x.classList.remove("active")
			);
			li.classList.add("active");

			const target = li.getAttribute("data-target");
			if (!target) return;

			// Alle Editor-Sektionen ausblenden
			document.querySelectorAll(".editor-section").forEach(sec =>
				sec.classList.remove("active")
			);

<<<<<<< HEAD
            // Spezialfall: Items
            if (target === "editor-items") {

                const editor = document.getElementById("editor-items");
                const overview = document.getElementById("items-overview");
                const form = document.getElementById("item-editor-form");

                editor.classList.add("active");
                overview.classList.add("active");
                form.classList.remove("active");
=======
			// Spezialfall: Items → Übersicht anzeigen
			if (target === "editor-items") {

				// Items-Container aktivieren
				document.getElementById("editor-items").classList.add("active");

				// Übersicht aktivieren
				document.getElementById("items-overview").classList.add("active");
				document.getElementById("item-editor-form").classList.remove("active");
>>>>>>> a1cded1ecef2d1a08c918766c100d408632e3ea1

				return;
			}

<<<<<<< HEAD
            // Standard
            const section = document.getElementById(target);
            if (section) section.classList.add("active");
        });
    });



    // -----------------------------------------------------
    // NEUES ITEM AUS DER NAVIGATION
    // -----------------------------------------------------
    document.getElementById("btn-add-item").addEventListener("click", () => {
=======
			// Standard: Ziel anzeigen
			const section = document.getElementById(target);
			if (section) section.classList.add("active");
		});
	});


	// -----------------------------------------------------
	// NEUES ITEM AUS DER NAVIGATION
	// -----------------------------------------------------
	document.getElementById("btn-add-item").addEventListener("click", () => {
>>>>>>> a1cded1ecef2d1a08c918766c100d408632e3ea1

		const newItem = {
			id: "item_" + Math.random().toString(36).substr(2, 6),
			name: "",
			effectType: "impulse",
			trigger: "onUse",
			frequency: {
				mode: "rundenbasiert",
				intervalRounds: 3,
				killsInterval: 3,
				lastPlayersThreshold: 4,
				healthThreshold: 20,
				boostFactor: 5
			},
			probability: 25,
			spawn: {
				type: "points",
				points: [],
				areas: []
			}
		};

		mapData.items.push(newItem);

<<<<<<< HEAD
        /* Sidebar aktualisieren
        const event = new CustomEvent("items-updated");
        document.dispatchEvent(event);*/
=======
		// // Sidebar aktualisieren
		// const event = new CustomEvent("items-updated");
		// document.dispatchEvent(event);
>>>>>>> a1cded1ecef2d1a08c918766c100d408632e3ea1

		// Übersicht aktualisieren
		const overviewEvent = new CustomEvent("items-overview-update");
		document.dispatchEvent(overviewEvent);

		// Editor öffnen
		const openEvent = new CustomEvent("open-item-editor", { detail: newItem });
		document.dispatchEvent(openEvent);
	});
}



// ---------------------------------------------------------
// NEW MAP
// ---------------------------------------------------------
export function initNewMapButton() {
	document.getElementById("btn-new-map").addEventListener("click", () => {

		resetMapData();

		restoreMapFields();

		mapData.background = null;
		document.getElementById("map-image").value = "";
		document.getElementById("preview-canvas").style.backgroundImage = "";
		document.getElementById("preview-canvas").innerHTML = "";

		document.getElementById("wall-list").innerHTML = "";
		document.getElementById("hole-list").innerHTML = "";
		document.getElementById("player-list").innerHTML = "";

		console.log("Neue Map erstellt:", mapData);
	});
}



// ---------------------------------------------------------
// JSON DOWNLOAD
// ---------------------------------------------------------
export function initDownload() {
	document.getElementById("btn-download").addEventListener("click", () => {
		const json = JSON.stringify(mapData, null, 2);
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = url;
		a.download = `${mapData.name || "map"}.json`;
		a.click();
	});
}



// ---------------------------------------------------------
// JSON IMPORT
// ---------------------------------------------------------
export function initImport() {
	const fileInput = document.getElementById("file-import");

	document.getElementById("btn-import").addEventListener("click", () => {
		fileInput.click();
	});

	fileInput.addEventListener("change", async () => {
		const file = fileInput.files[0];
		if (!file) return;

		const text = await file.text();
		const json = JSON.parse(text);

		Object.assign(mapData, json);

		restoreMapFields();

		document.getElementById("map-image").value = "";

		if (mapData.background?.url) {
			document.getElementById("preview-canvas").style.backgroundImage =
				`url(${mapData.background.url})`;
			document.getElementById("preview-canvas").style.backgroundSize = "contain";
			document.getElementById("preview-canvas").style.backgroundRepeat = "no-repeat";
			document.getElementById("preview-canvas").style.backgroundPosition = "center";
		} else {
			document.getElementById("preview-canvas").style.backgroundImage = "";
		}

		renderWalls();
		renderHoles();
		renderPlayers();

		console.log("Map erfolgreich geladen:", mapData);
	});
}

// Sidebar aktualisieren
document.addEventListener("items-updated", () => {
	renderItemSidebar();
});

// Tabelle aktualisieren
document.addEventListener("items-overview-update", () => {
	renderItemsOverview();
});

// Editor öffnen
document.addEventListener("open-item-editor", (e) => {
	openItemEditor(e.detail);
});
