import { mapData } from "./state.js";

export function restoreMapFields() {

    // MAP NAME
    document.getElementById("map-name").value = mapData.name || "";

    // FRICTION
    document.getElementById("map-friction").value = mapData.friction ?? 1.0;
    document.getElementById("friction-value").textContent = Number(mapData.friction).toFixed(2);

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

    // FRICTION SLIDER
    const frictionSlider = document.getElementById("map-friction");
    const frictionValue = document.getElementById("friction-value");

    frictionSlider.addEventListener("input", () => {
        const val = Math.max(0, Number(frictionSlider.value));
        frictionValue.textContent = val.toFixed(2);
        mapData.friction = val;
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
    container.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "editor-grid";

    mapData.mapBoundarys.forEach((wall, index) => {
        const field = document.createElement("div");
        field.className = "field";

        field.innerHTML = `
            <h4>Wand ${index + 1}</h4>

            <label>X: <span>${wall.x}</span></label>
            <input type="range" min="0" max="2000" value="${wall.x}" data-field="x">

            <label>Y: <span>${wall.y}</span></label>
            <input type="range" min="0" max="2000" value="${wall.y}" data-field="y">

            <label>Breite: <span>${wall.w}</span></label>
            <input type="range" min="1" max="2000" value="${wall.w}" data-field="w">

            <label>Höhe: <span>${wall.h}</span></label>
            <input type="range" min="1" max="2000" value="${wall.h}" data-field="h">

            <label>Farbe</label>
            <input type="color" value="${wall.color}" data-field="color">

            <button class="delete-wall">Löschen</button>
        `;

        field.querySelectorAll("input").forEach(input => {
            input.addEventListener("input", e => {
                const f = e.target.dataset.field;
                wall[f] = f === "color" ? e.target.value : Number(e.target.value);
                renderWalls();
            });
        });

        field.querySelector(".delete-wall").addEventListener("click", () => {
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
    container.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "editor-grid";

    mapData.holes.forEach((hole, index) => {
        const field = document.createElement("div");
        field.className = "field";

        field.innerHTML = `
            <h4>Loch ${index + 1}</h4>

            <label>X: <span>${hole.x}</span></label>
            <input type="range" min="0" max="2000" value="${hole.x}" data-field="x">

            <label>Y: <span>${hole.y}</span></label>
            <input type="range" min="0" max="2000" value="${hole.y}" data-field="y">

            <label>Radius: <span>${hole.r}</span></label>
            <input type="range" min="1" max="500" value="${hole.r}" data-field="r">

            <label>Farbe</label>
            <input type="color" value="${hole.color}" data-field="color">

            <button class="delete-hole">Löschen</button>
        `;

        field.querySelectorAll("input").forEach(input => {
            input.addEventListener("input", e => {
                const f = e.target.dataset.field;
                hole[f] = f === "color" ? e.target.value : Number(e.target.value);
                renderHoles();
            });
        });

        field.querySelector(".delete-hole").addEventListener("click", () => {
            mapData.holes.splice(index, 1);
            renderHoles();
        });

        grid.appendChild(field);
    });

    container.appendChild(grid);
}

export function renderPlayers() {
    const container = document.getElementById("player-list");
    container.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "editor-grid";

    mapData.players.forEach((player, index) => {
        const field = document.createElement("div");
        field.className = "player-field";

        field.innerHTML = `
            <h4>Spieler ${index + 1}</h4>

            <label>X: <span>${player.x}</span></label>
            <input type="range" min="0" max="2000" value="${player.x}" data-field="x">

            <label>Y: <span>${player.y}</span></label>
            <input type="range" min="0" max="2000" value="${player.y}" data-field="y">

            <label>Farbe</label>
            <input type="color" value="${player.color}" data-field="color">

            <label>Team</label>
            <select data-field="team">
                <option value="0" ${player.team == 0 ? "selected" : ""}>Team 0</option>
                <option value="1" ${player.team == 1 ? "selected" : ""}>Team 1</option>
            </select>

            <button class="delete-player">Löschen</button>
        `;

        field.querySelectorAll("input, select").forEach(input => {
            input.addEventListener("input", e => {
                const f = e.target.dataset.field;
                player[f] = f === "color" ? e.target.value : Number(e.target.value);
                renderPlayers();
            });
        });

        field.querySelector(".delete-player").addEventListener("click", () => {
            mapData.players.splice(index, 1);
            renderPlayers();
        });

        grid.appendChild(field);
    });

    container.appendChild(grid);
}




