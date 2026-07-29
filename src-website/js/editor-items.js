// ---------------------------------------------------------
//  IMPORTS
// ---------------------------------------------------------

import { mapData } from "./state.js";
import { createElement } from "./dom.js";


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

    refreshItemsUI();
}

function showEditor() {
    document.getElementById("items-overview").classList.remove("active");
    document.getElementById("item-editor-form").classList.add("active");

    refreshItemsUI();
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

export function renderItemSidebar() {
    const list = document.getElementById("sidebar-item-list");
    list.replaceChildren();

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

        refreshItemsUI();

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

export function renderItemsOverview() {
    const tbody = document.getElementById("item-table-body");
    tbody.replaceChildren();

    mapData.items.forEach(item => {
        const tr = createElement("tr");
        tr.append(
            createElement("td", { text: item.name || "(Unbenannt)" }),
            createElement("td", { text: item.effectType }),
            createElement("td", { text: item.trigger }),
            createElement("td", { text: item.spawn.type }),
            createElement("td", { text: `${item.probability}%` })
        );

        tr.addEventListener("click", () => {
            openItemEditor(item);
        });

        tbody.appendChild(tr);
    });
}

export function openItemEditor(item) {
    showEditor();
    loadItemIntoEditor(item);

    const li = [...document.querySelectorAll("#sidebar-item-list li")]
        .find(candidate => candidate.dataset.id === item.id);
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
    list.replaceChildren();

    points.forEach((p, index) => {
        const li = createElement("li");
        const grid = createElement("div", { className: "editor-grid" });
        const x = createNumberField("X", "sp-x", p.x);
        const y = createNumberField("Y", "sp-y", p.y);
        const remove = createElement("button", { className: "small-btn btn-delete-point", text: "Löschen" });
        grid.append(x.field, y.field, remove);
        li.appendChild(grid);

        x.input.addEventListener("input", e => p.x = Number(e.target.value));
        y.input.addEventListener("input", e => p.y = Number(e.target.value));

        remove.addEventListener("click", () => {
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
    container.replaceChildren();

    areas.forEach((area, index) => {
        const block = createElement("div", { className: "area-block" });
        const header = createElement("div", { className: "area-header", text: `Bereich ${index + 1}` });
        const content = createElement("div", { className: "area-content active" });
        const grid = createElement("div", { className: "editor-grid" });
        const shape = createElement("select", { className: "area-shape", value: area.shape });
        shape.append(
            createElement("option", { value: "circle", text: "Circle" }),
            createElement("option", { value: "rect", text: "Rect" })
        );
        shape.value = area.shape;
        const shapeField = createField("Shape", shape);
        const x = createNumberField("X", "area-x", area.x);
        const y = createNumberField("Y", "area-y", area.y);
        const radius = createNumberField("Radius", "area-radius", area.radius || 100, "field field-radius");
        const width = createNumberField("Width", "area-width", area.width || 200, "field field-width");
        const height = createNumberField("Height", "area-height", area.height || 200, "field field-height");
        radius.field.style.display = area.shape === "circle" ? "" : "none";
        width.field.style.display = area.shape === "rect" ? "" : "none";
        height.field.style.display = area.shape === "rect" ? "" : "none";
        const remove = createElement("button", { className: "small-btn btn-delete-area", text: "Bereich löschen" });
        grid.append(shapeField, x.field, y.field, radius.field, width.field, height.field);
        content.append(grid, remove);
        block.append(header, content);

        shape.addEventListener("change", e => {
            area.shape = e.target.value;
            renderSpawnAreas(areas);
        });

        x.input.addEventListener("input", e => area.x = Number(e.target.value));
        y.input.addEventListener("input", e => area.y = Number(e.target.value));
        radius.input.addEventListener("input", e => area.radius = Number(e.target.value));
        width.input.addEventListener("input", e => area.width = Number(e.target.value));
        height.input.addEventListener("input", e => area.height = Number(e.target.value));

        remove.addEventListener("click", () => {
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

    refreshItemsUI();
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
    container.replaceChildren();

    const params = EFFECT_PARAMS[effect] || [];

    params.forEach(p => {
        const input = createElement("input", { type: p.type, id: `effect-param-${p.id}`, value: p.default });
        const div = createField(p.label, input);

        container.appendChild(div);
    });
}

function createNumberField(label, className, value, fieldClassName = "field") {
    const input = createElement("input", { className, type: "number", value });
    return { field: createField(label, input, fieldClassName), input };
}

function createField(label, input, className = "field") {
    const field = createElement("div", { className });
    field.append(createElement("label", { text: label }), input);
    return field;
}

export function refreshItemsUI(openFirst = false) {

    // Sidebar aktualisieren
    renderItemSidebar();

    // Tabelle aktualisieren
    renderItemsOverview();

    // Erstes Item automatisch öffnen
    if (openFirst && mapData.items.length > 0) {
        openItemEditor(mapData.items[0]);
    }
}
