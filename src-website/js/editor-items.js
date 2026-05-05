// ---------------------------------------------------------
//  IMPORTS
// ---------------------------------------------------------

import { mapData } from "./state.js";


// ---------------------------------------------------------
//  INITIALISIERUNG
// ---------------------------------------------------------

export function initItemsEditor() {

    if (!mapData.items) mapData.items = [];

    setupTabs();
    setupAccordion();
    setupAddItemButton();
    setupPlayerFrequencyMode();
    setupSpawnButtons();
    setupAutoSave();
    setupSaveButton();
    setupEffectParams();

    renderItemsOverview();   // Übersicht zuerst anzeigen

    console.log("Items-Editor initialisiert");
}



// ---------------------------------------------------------
//  ÜBERSICHT / EDITOR UMSCHALTEN
// ---------------------------------------------------------

function showOverview() {
    document.getElementById("items-overview").classList.add("active");
    document.getElementById("item-editor-form").classList.remove("active");
}

function showEditor() {
    document.getElementById("items-overview").classList.remove("active");
    document.getElementById("item-editor-form").classList.add("active");
}



// ---------------------------------------------------------
//  TABS (Frequency + Spawn)
// ---------------------------------------------------------

function setupTabs() {
    document.querySelectorAll(".tab-bar button").forEach(btn => {
        btn.addEventListener("click", () => {
            const group = btn.parentElement;
            const tab = btn.dataset.tab;

            group.querySelectorAll("button").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const container = group.parentElement;
            container.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

            document.getElementById(tab).classList.add("active");
        });
    });
}



// ---------------------------------------------------------
//  ACCORDION (Spawnbereiche)
// ---------------------------------------------------------

function setupAccordion() {
    document.addEventListener("click", e => {
        if (e.target.classList.contains("area-header")) {
            const content = e.target.nextElementSibling;
            content.classList.toggle("active");
        }
    });
}



// ---------------------------------------------------------
//  SIDEBAR – ITEMS RENDERN
// ---------------------------------------------------------

function renderItemSidebar() {
    const list = document.getElementById("sidebar-item-list");
    list.innerHTML = "";

    const sorted = [...mapData.items].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
    );

    sorted.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item.name || "(Unbenannt)";
        li.dataset.id = item.id;

        li.addEventListener("click", () => {
            selectSidebarItem(li);
            openItemEditor(item);
        });

        list.appendChild(li);
    });
}



// ---------------------------------------------------------
//  SIDEBAR – AKTIVES ITEM MARKIEREN
// ---------------------------------------------------------

function selectSidebarItem(li) {
    document.querySelectorAll("#sidebar-item-list li").forEach(el =>
        el.classList.remove("active")
    );
    li.classList.add("active");
}



// ---------------------------------------------------------
//  ITEM IN EDITOR LADEN
// ---------------------------------------------------------

function loadItemIntoEditor(item) {

    // Identity
    document.getElementById("item-id").value = item.id;
    document.getElementById("item-name").value = item.name;

    // Behavior
    document.getElementById("item-effect-type").value = item.effectType;
    document.getElementById("item-trigger").value = item.trigger;

    // Frequency
    document.getElementById("freq-rounds-interval").value = item.frequency.intervalRounds;
    document.getElementById("freq-player-kills").value = item.frequency.killsInterval;
    document.getElementById("freq-player-last").value = item.frequency.lastPlayersThreshold;
    document.getElementById("freq-dyn-health").value = item.frequency.healthThreshold;
    document.getElementById("freq-dyn-boost").value = item.frequency.boostFactor;

    // Probability
    document.getElementById("item-probability").value = item.probability;

    // Spielerbasiert: Modus setzen
    if (item.frequency.killsInterval > 0) {
        document.querySelector("input[name='player-mode'][value='kills']").checked = true;
        document.getElementById("field-player-kills").style.display = "block";
        document.getElementById("field-player-last").style.display = "none";
    } else {
        document.querySelector("input[name='player-mode'][value='last']").checked = true;
        document.getElementById("field-player-kills").style.display = "none";
        document.getElementById("field-player-last").style.display = "block";
    }

        document.getElementById("item-effect-type").value = item.effectType;
        renderEffectParams();

        // gespeicherte Werte einsetzen
            if (item.effectParams) {
                Object.entries(item.effectParams).forEach(([key, val]) => {
                    const el = document.getElementById("effect-param-" + key);
                    if (el) el.value = val;
    });
}


    // Spawn
    renderSpawnPoints(item.spawn.points);
    renderSpawnAreas(item.spawn.areas);
}



// ---------------------------------------------------------
//  NEUES ITEM ANLEGEN
// ---------------------------------------------------------

function setupAddItemButton() {
    document.getElementById("btn-create-item").addEventListener("click", () => {

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

        renderItemSidebar();
        renderItemsOverview();

        openItemEditor(newItem);
    });
}

function setupSaveButton() {
    const btn = document.getElementById("btn-save-item");
    btn.addEventListener("click", () => {
        saveCurrentItem();      // Speichert ins aktive Item
        renderItemSidebar();    // Sidebar aktualisieren
        renderItemsOverview();  // Tabelle aktualisieren
        console.log("Item gespeichert:", getCurrentItem());
    });
}


// ---------------------------------------------------------
//  ITEM ÜBERSICHT
// ---------------------------------------------------------

function renderItemsOverview() {
    const tbody = document.getElementById("item-table-body");
    tbody.innerHTML = "";

    mapData.items.forEach(item => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${item.name || "(Unbenannt)"}</td>
            <td>${item.effectType}</td>
            <td>${item.trigger}</td>
            <td>${item.spawn.type}</td>
            <td>${item.probability}%</td>
        `;

        tr.addEventListener("click", () => {
            openItemEditor(item);
        });

        tbody.appendChild(tr);
    });
}

function openItemEditor(item) {
    showEditor();
    loadItemIntoEditor(item);

    const li = document.querySelector(`#sidebar-item-list li[data-id="${item.id}"]`);
    if (li) selectSidebarItem(li);
}



// ---------------------------------------------------------
//  GET CURRENT ITEM
// ---------------------------------------------------------

function getCurrentItem() {
    const activeLi = document.querySelector("#sidebar-item-list li.active");
    if (!activeLi) return null;
    const id = activeLi.dataset.id;
    return mapData.items.find(i => i.id === id);
}



// ---------------------------------------------------------
//  SPAWN – PUNKTE
// ---------------------------------------------------------

function renderSpawnPoints(points) {
    const list = document.getElementById("spawnpoint-list");
    list.innerHTML = "";

    points.forEach((p, index) => {
        const li = document.createElement("li");

        li.innerHTML = `
            <div class="editor-grid">
                <div class="field">
                    <label>X</label>
                    <input type="number" class="sp-x" value="${p.x}">
                </div>
                <div class="field">
                    <label>Y</label>
                    <input type="number" class="sp-y" value="${p.y}">
                </div>
                <button class="small-btn btn-delete-point">Löschen</button>
            </div>
        `;

        li.querySelector(".sp-x").addEventListener("input", e => p.x = Number(e.target.value));
        li.querySelector(".sp-y").addEventListener("input", e => p.y = Number(e.target.value));

        li.querySelector(".btn-delete-point").addEventListener("click", () => {
            points.splice(index, 1);
            renderSpawnPoints(points);
        });

        list.appendChild(li);
    });
}



// ---------------------------------------------------------
//  SPAWN – BEREICHE
// ---------------------------------------------------------

function renderSpawnAreas(areas) {
    const container = document.getElementById("area-list");
    container.innerHTML = "";

    areas.forEach((area, index) => {
        const block = document.createElement("div");
        block.classList.add("area-block");

        block.innerHTML = `
            <div class="area-header">Bereich ${index + 1}</div>
            <div class="area-content active">
                <div class="editor-grid">
                    <div class="field">
                        <label>Shape</label>
                        <select class="area-shape">
                            <option value="circle" ${area.shape === "circle" ? "selected" : ""}>Circle</option>
                            <option value="rect" ${area.shape === "rect" ? "selected" : ""}>Rect</option>
                        </select>
                    </div>
                    <div class="field">
                        <label>X</label>
                        <input type="number" class="area-x" value="${area.x}">
                    </div>
                    <div class="field">
                        <label>Y</label>
                        <input type="number" class="area-y" value="${area.y}">
                    </div>
                    <div class="field field-radius" style="${area.shape === "circle" ? "" : "display:none;"}">
                        <label>Radius</label>
                        <input type="number" class="area-radius" value="${area.radius || 100}">
                    </div>
                    <div class="field field-width" style="${area.shape === "rect" ? "" : "display:none;"}">
                        <label>Width</label>
                        <input type="number" class="area-width" value="${area.width || 200}">
                    </div>
                    <div class="field field-height" style="${area.shape === "rect" ? "" : "display:none;"}">
                        <label>Height</label>
                        <input type="number" class="area-height" value="${area.height || 200}">
                    </div>
                </div>
                <button class="small-btn btn-delete-area">Bereich löschen</button>
            </div>
        `;

        block.querySelector(".area-shape").addEventListener("change", e => {
            area.shape = e.target.value;
            renderSpawnAreas(areas);
        });

        block.querySelector(".area-x").addEventListener("input", e => area.x = Number(e.target.value));
        block.querySelector(".area-y").addEventListener("input", e => area.y = Number(e.target.value));
        block.querySelector(".area-radius").addEventListener("input", e => area.radius = Number(e.target.value));
        block.querySelector(".area-width").addEventListener("input", e => area.width = Number(e.target.value));
        block.querySelector(".area-height").addEventListener("input", e => area.height = Number(e.target.value));

        block.querySelector(".btn-delete-area").addEventListener("click", () => {
            areas.splice(index, 1);
            renderSpawnAreas(areas);
        });

        container.appendChild(block);
    });
}



// ---------------------------------------------------------
//  FREQUENCY MODE
// ---------------------------------------------------------

function setupPlayerFrequencyMode() {
    const killsField = document.getElementById("field-player-kills");
    const lastField = document.getElementById("field-player-last");

    document.querySelectorAll("input[name='player-mode']").forEach(radio => {
        radio.addEventListener("change", () => {
            if (radio.value === "kills") {
                killsField.style.display = "block";
                lastField.style.display = "none";
            } else {
                killsField.style.display = "none";
                lastField.style.display = "block";
            }
        });
    });
}



// ---------------------------------------------------------
//  SPAWN BUTTONS
// ---------------------------------------------------------

function setupSpawnButtons() {
    const btnAddPoint = document.getElementById("btn-add-spawnpoint");
    const btnAddArea = document.getElementById("btn-add-area");

    btnAddPoint.addEventListener("click", () => {
        const current = getCurrentItem();
        if (!current) return;

        current.spawn.points.push({ x: 0, y: 0 });
        renderSpawnPoints(current.spawn.points);
    });

    btnAddArea.addEventListener("click", () => {
        const current = getCurrentItem();
        if (!current) return;

        if (current.spawn.areas.length >= 4) return;

        current.spawn.areas.push({
            shape: "circle",
            x: 0,
            y: 0,
            radius: 100,
            width: 200,
            height: 200
        });

        renderSpawnAreas(current.spawn.areas);
    });
}



// ---------------------------------------------------------
//  AUTOSAVE
// ---------------------------------------------------------

function setupAutoSave() {
    const inputs = document.querySelectorAll("#editor-items input, #editor-items select");

    inputs.forEach(input => {
        input.addEventListener("input", saveCurrentItem);
    });
}

function saveCurrentItem() {
    const item = getCurrentItem();
    if (!item) return;

    item.id = document.getElementById("item-id").value;
    item.name = document.getElementById("item-name").value;

    item.effectType = document.getElementById("item-effect-type").value;
    item.trigger = document.getElementById("item-trigger").value;

    item.frequency.intervalRounds = Number(document.getElementById("freq-rounds-interval").value);
    item.frequency.killsInterval = Number(document.getElementById("freq-player-kills").value);
    item.frequency.lastPlayersThreshold = Number(document.getElementById("freq-player-last").value);
    item.frequency.healthThreshold = Number(document.getElementById("freq-dyn-health").value);
    item.frequency.boostFactor = Number(document.getElementById("freq-dyn-boost").value);

    const mode = document.querySelector("input[name='player-mode']:checked").value;
    if (mode === "kills") {
        item.frequency.lastPlayersThreshold = 0;
    } else {
        item.frequency.killsInterval = 0;
    }

    item.probability = Number(document.getElementById("item-probability").value);

    item.effectType = document.getElementById("item-effect-type").value;

                        // Parameter speichern
                        item.effectParams = {};
                        const params = EFFECT_PARAMS[item.effectType] || [];

                        params.forEach(p => {
                            const el = document.getElementById("effect-param-" + p.id);
                            if (el) item.effectParams[p.id] = Number(el.value);
});


}

document.addEventListener("items-overview-update", () => {
    renderItemsOverview();
});

document.addEventListener("open-item-editor", (e) => {
    const item = e.detail;
    openItemEditor(item);
});

const EFFECT_PARAMS = {
    push: [
        { id: "force", label: "Kraft", type: "number", default: 500 }
    ],
    pull: [
        { id: "force", label: "Kraft", type: "number", default: 500 }
    ],
    knockback: [
        { id: "strength", label: "Stärke", type: "number", default: 800 }
    ],

    boost_speed: [
        { id: "amount", label: "Speed Boost", type: "number", default: 1.5 },
        { id: "duration", label: "Dauer (ms)", type: "number", default: 2000 }
    ],
    boost_jump: [
        { id: "amount", label: "Jump Boost", type: "number", default: 2.0 },
        { id: "duration", label: "Dauer (ms)", type: "number", default: 2000 }
    ],
    modify_friction: [
        { id: "value", label: "Reibung", type: "number", default: 0.5 },
        { id: "duration", label: "Dauer (ms)", type: "number", default: 2000 }
    ],
    modify_mass: [
        { id: "value", label: "Masse", type: "number", default: 2.0 },
        { id: "duration", label: "Dauer (ms)", type: "number", default: 2000 }
    ],

    teleport: [
        { id: "distance", label: "Distanz", type: "number", default: 150 }
    ],
    blink: [
        { id: "distance", label: "Distanz", type: "number", default: 100 }
    ],
    move_offset: [
        { id: "x", label: "Offset X", type: "number", default: 0 },
        { id: "y", label: "Offset Y", type: "number", default: 0 }
    ],

    affect_nearby_players: [
        { id: "radius", label: "Radius", type: "number", default: 200 }
    ],
    swap_positions: [],
    stagger: [
        { id: "strength", label: "Stagger Stärke", type: "number", default: 300 }
    ],

    spawn_wall: [
        { id: "width", label: "Breite", type: "number", default: 100 },
        { id: "height", label: "Höhe", type: "number", default: 20 },
        { id: "duration", label: "Dauer (ms)", type: "number", default: 3000 }
    ],
    spawn_zone: [
        { id: "radius", label: "Radius", type: "number", default: 200 },
        { id: "duration", label: "Dauer (ms)", type: "number", default: 3000 }
    ],
    spawn_projectile: [
        { id: "speed", label: "Projektilgeschwindigkeit", type: "number", default: 500 }
    ]
};

function setupEffectParams() {
    const select = document.getElementById("item-effect-type");
    select.addEventListener("change", renderEffectParams);
}

function renderEffectParams() {
    const effect = document.getElementById("item-effect-type").value;
    const container = document.getElementById("effect-params");
    container.innerHTML = "";

    const params = EFFECT_PARAMS[effect] || [];

    params.forEach(p => {
        const div = document.createElement("div");
        div.classList.add("field");

        div.innerHTML = `
            <label>${p.label}</label>
            <input type="${p.type}" id="effect-param-${p.id}" value="${p.default}">
        `;

        container.appendChild(div);
    });
}

