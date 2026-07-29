import { mapData } from "./state.js";
import { createElement } from "./dom.js";

export function restoreMapFields() {

    // MAP NAME
    document.getElementById("map-name").value = mapData.name || "";

    // FRICTION
    document.getElementById("map-friction").value = mapData.friction?.friction ?? 0.995;
    document.getElementById("map-linear-drag").value = mapData.friction?.linearDrag ?? 0.01;
    document.getElementById("map-stop-threshold").value = mapData.friction?.stopThreshold ?? 0.1;

    // DRIFT
    document.getElementById("map-drift").value = mapData.drift ?? 0.0;
    document.getElementById("drift-value").textContent = Number(mapData.drift).toFixed(2);

    // BACKGROUND (nur URL, kein File-Objekt)
    if (mapData.background?.url) {
        console.log("Hintergrundbild URL:", mapData.background.url);
    }
}


export function initMapEditor() {

    // PLAYER GRID EIN/AUS
        document.getElementById("toggle-players").addEventListener("click", () => {
        document.getElementById("player-list").classList.toggle("grid-hidden");
    });

    // SPIELER HINZUFÜGEN
        document.getElementById("btn-add-player").addEventListener("click", () => {
            const player = {
                x: 0,
                y: 0,
                color: "#00ff00",
                team: 0
    };

        mapData.players.push(player);
        renderPlayers();
    });

    // GRID EIN/AUS für Wände
        document.getElementById("toggle-walls").addEventListener("click", () => {
        document.getElementById("wall-list").classList.toggle("grid-hidden");
    });

    // GRID EIN/AUS für Löcher
        document.getElementById("toggle-holes").addEventListener("click", () => {
        document.getElementById("hole-list").classList.toggle("grid-hidden");
    });

    // MAP NAME
    document.getElementById("map-name").addEventListener("input", e => {
        mapData.name = e.target.value;
    });

    // BACKGROUND IMAGE
    document.getElementById("map-image").addEventListener("change", e => {
        const file = e.target.files[0];
        console.log(file)
        const url = URL.createObjectURL(file)
        console.log(url)
        if (!file) return;
        mapData.background = { type: "image", url: file.name };
    });

    // ENGINE FRICTION SETTINGS
    const frictionInputs = [
        ["map-friction", "friction"],
        ["map-linear-drag", "linearDrag"],
        ["map-stop-threshold", "stopThreshold"],
    ];
    frictionInputs.forEach(([id, key]) => {
        const input = document.getElementById(id);
        input.addEventListener("input", () => {
            mapData.friction[key] = Math.max(0, Number(input.value));
        });
    });

    // DRIFT SLIDER
    const driftSlider = document.getElementById("map-drift");
    const driftValue = document.getElementById("drift-value");

    driftSlider.addEventListener("input", () => {
        const val = Math.max(0, Number(driftSlider.value));
        driftValue.textContent = val.toFixed(2);
        mapData.drift = val;
    });

    // -----------------------------
    // WÄNDE HINZUFÜGEN
    // -----------------------------
    document.getElementById("btn-add-wall").addEventListener("click", () => {
        const wall = {
            type: "rectangle",
            x: 0,
            y: 0,
            w: 100,
            h: 20,
            color: "#4da3ff"
        };

        mapData.mapBoundarys.push(wall);
        renderWalls();
    });

    // -----------------------------
    // LÖCHER HINZUFÜGEN
    // -----------------------------
    document.getElementById("btn-add-hole").addEventListener("click", () => {
        if (mapData.holes.length >= 6) {
            alert("Maximal 6 Löcher erlaubt!");
            return;
        }

        const hole = {
            type: "circle",
            x: 0,
            y: 0,
            r: 30,
            color: "#ff4444"
        };

        mapData.holes.push(hole);
        renderHoles();
    });

    renderWalls();
    renderHoles();
    renderPlayers();
}

// --------------------------------------------------
// WÄNDE RENDERN
// --------------------------------------------------
export function renderWalls() {
    const container = document.getElementById("wall-list");
    container.replaceChildren();

    const grid = document.createElement("div");
    grid.className = "editor-grid";

    mapData.mapBoundarys.forEach((wall, index) => {
        const field = createElement("div", { className: "field" });
        field.appendChild(createElement("h4", { text: `Wand ${index + 1}` }));
        const x = createNumberRow("X", wall.x, "wall-x-slider", "wall-x-num", 0, 2000);
        const y = createNumberRow("Y", wall.y, "wall-y-slider", "wall-y-num", 0, 2000);
        const w = createNumberRow("Breite", wall.w, "wall-w-slider", "wall-w-num", 1, 2000);
        const h = createNumberRow("Höhe", wall.h, "wall-h-slider", "wall-h-num", 1, 2000);
        const color = createColorRow("wall-color", wall.color);
        const remove = createElement("button", { className: "delete-wall", text: "Löschen" });
        field.append(x.row, y.row, w.row, h.row, color.row, remove);

        const bind = (slider, num, label, key) => {
            slider.addEventListener("input", () => {
                wall[key] = Number(slider.value);
                num.value = slider.value;
                label.textContent = slider.value;
            });
            num.addEventListener("input", () => {
                wall[key] = Number(num.value);
                slider.value = num.value;
                label.textContent = num.value;
            });
        };

        bind(x.slider, x.number, x.label, "x");
        bind(y.slider, y.number, y.label, "y");
        bind(w.slider, w.number, w.label, "w");
        bind(h.slider, h.number, h.label, "h");

        color.input.addEventListener("input", e => {
            wall.color = e.target.value;
        });

        remove.addEventListener("click", () => {
            mapData.mapBoundarys.splice(index, 1);
            renderWalls();
        });

        grid.appendChild(field);
    });

    container.appendChild(grid);
}

// --------------------------------------------------
// LÖCHER RENDERN
// --------------------------------------------------
export function renderHoles() {
    const container = document.getElementById("hole-list");
    container.replaceChildren();

    const grid = document.createElement("div");
    grid.className = "editor-grid";

    mapData.holes.forEach((hole, index) => {
        const field = createElement("div", { className: "field" });
        field.appendChild(createElement("h4", { text: `Loch ${index + 1}` }));
        const x = createNumberRow("X", hole.x, "hole-x-slider", "hole-x-num", 0, 2000);
        const y = createNumberRow("Y", hole.y, "hole-y-slider", "hole-y-num", 0, 2000);
        const radius = createNumberRow("Radius", hole.r, "hole-r-slider", "hole-r-num", 1, 500);
        const color = createColorRow("hole-color", hole.color);
        const remove = createElement("button", { className: "delete-hole", text: "Löschen" });
        field.append(x.row, y.row, radius.row, color.row, remove);

        const bind = (slider, num, label, key) => {
            slider.addEventListener("input", () => {
                hole[key] = Number(slider.value);
                num.value = slider.value;
                label.textContent = slider.value;
            });
            num.addEventListener("input", () => {
                hole[key] = Number(num.value);
                slider.value = num.value;
                label.textContent = num.value;
            });
        };

        bind(x.slider, x.number, x.label, "x");
        bind(y.slider, y.number, y.label, "y");
        bind(radius.slider, radius.number, radius.label, "r");

        color.input.addEventListener("input", e => {
            hole.color = e.target.value;
        });

        remove.addEventListener("click", () => {
            mapData.holes.splice(index, 1);
            renderHoles();
        });

        grid.appendChild(field);
    });

    container.appendChild(grid);
}

export function renderPlayers() {
    const container = document.getElementById("player-list");
    container.replaceChildren();

    const grid = document.createElement("div");
    grid.className = "editor-grid";

    mapData.players.forEach((player, index) => {
        const field = createElement("div", { className: "field" });
        field.appendChild(createElement("h4", { text: `Spieler ${index + 1}` }));
        const x = createNumberRow("X", player.x, "player-x-slider", "player-x-num", 0, 2000);
        const y = createNumberRow("Y", player.y, "player-y-slider", "player-y-num", 0, 2000);
        const color = createColorRow("player-color", player.color);
        const team = createTeamRow(player.team);
        const remove = createElement("button", { className: "delete-player", text: "Löschen" });
        field.append(x.row, y.row, color.row, team.row, remove);

        const bind = (slider, num, label, key) => {
            slider.addEventListener("input", () => {
                player[key] = Number(slider.value);
                num.value = slider.value;
                label.textContent = slider.value;
            });
            num.addEventListener("input", () => {
                player[key] = Number(num.value);
                slider.value = num.value;
                label.textContent = num.value;
            });
        };

        bind(x.slider, x.number, x.label, "x");
        bind(y.slider, y.number, y.label, "y");

        color.input.addEventListener("input", e => {
            player.color = e.target.value;
        });

        team.select.addEventListener("change", e => {
            player.team = Number(e.target.value);
        });

        remove.addEventListener("click", () => {
            mapData.players.splice(index, 1);
            renderPlayers();
        });

        grid.appendChild(field);
    });

    container.appendChild(grid);
}

function createNumberRow(labelText, value, sliderClass, numberClass, min, max) {
    const row = createElement("div", { className: "editor-row" });
    const label = createElement("label", { text: `${labelText}: ` });
    const displayedValue = createElement("span", { className: "val", text: value });
    label.appendChild(displayedValue);
    const inputs = createElement("div", { className: "editor-inputs" });
    const slider = createElement("input", { className: sliderClass, type: "range", min, max, value });
    const number = createElement("input", { className: numberClass, type: "number", value });
    inputs.append(slider, number);
    row.append(label, inputs);
    return { row, slider, number, label: displayedValue };
}

function createColorRow(className, value) {
    const row = createElement("div", { className: "editor-row" });
    const input = createElement("input", { className, type: "color", value });
    row.append(createElement("label", { text: "Farbe" }), input);
    return { row, input };
}

function createTeamRow(value) {
    const row = createElement("div", { className: "editor-row" });
    const select = createElement("select", { className: "player-team", value });
    for (let team = 1; team <= 4; team++) {
        select.appendChild(createElement("option", { value: team, text: `Team ${team}` }));
    }
    select.value = String(value);
    row.append(createElement("label", { text: "Team" }), select);
    return { row, select };
}



