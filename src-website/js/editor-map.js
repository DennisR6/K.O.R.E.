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

            <div class="editor-row">
                <label>X: <span class="val-x">${wall.x}</span></label>
                <div class="editor-inputs">
                    <input type="range" min="0" max="2000" value="${wall.x}" class="wall-x-slider">
                    <input type="number" value="${wall.x}" class="wall-x-num">
                </div>
            </div>

            <div class="editor-row">
                <label>Y: <span class="val-y">${wall.y}</span></label>
                <div class="editor-inputs">
                    <input type="range" min="0" max="2000" value="${wall.y}" class="wall-y-slider">
                    <input type="number" value="${wall.y}" class="wall-y-num">
                </div>
            </div>

            <div class="editor-row">
                <label>Breite: <span class="val-w">${wall.w}</span></label>
                <div class="editor-inputs">
                    <input type="range" min="1" max="2000" value="${wall.w}" class="wall-w-slider">
                    <input type="number" value="${wall.w}" class="wall-w-num">
                </div>
            </div>

            <div class="editor-row">
                <label>Höhe: <span class="val-h">${wall.h}</span></label>
                <div class="editor-inputs">
                    <input type="range" min="1" max="2000" value="${wall.h}" class="wall-h-slider">
                    <input type="number" value="${wall.h}" class="wall-h-num">
                </div>
            </div>

            <div class="editor-row">
                <label>Farbe</label>
                <input type="color" value="${wall.color}" class="wall-color">
            </div>

            <button class="delete-wall">Löschen</button>
        `;

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

        bind(field.querySelector(".wall-x-slider"), field.querySelector(".wall-x-num"), field.querySelector(".val-x"), "x");
        bind(field.querySelector(".wall-y-slider"), field.querySelector(".wall-y-num"), field.querySelector(".val-y"), "y");
        bind(field.querySelector(".wall-w-slider"), field.querySelector(".wall-w-num"), field.querySelector(".val-w"), "w");
        bind(field.querySelector(".wall-h-slider"), field.querySelector(".wall-h-num"), field.querySelector(".val-h"), "h");

        field.querySelector(".wall-color").addEventListener("input", e => {
            wall.color = e.target.value;
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

            <div class="editor-row">
                <label>X: <span class="val-x">${hole.x}</span></label>
                <div class="editor-inputs">
                    <input type="range" min="0" max="2000" value="${hole.x}" class="hole-x-slider">
                    <input type="number" value="${hole.x}" class="hole-x-num">
                </div>
            </div>

            <div class="editor-row">
                <label>Y: <span class="val-y">${hole.y}</span></label>
                <div class="editor-inputs">
                    <input type="range" min="0" max="2000" value="${hole.y}" class="hole-y-slider">
                    <input type="number" value="${hole.y}" class="hole-y-num">
                </div>
            </div>

            <div class="editor-row">
                <label>Radius: <span class="val-r">${hole.r}</span></label>
                <div class="editor-inputs">
                    <input type="range" min="1" max="500" value="${hole.r}" class="hole-r-slider">
                    <input type="number" value="${hole.r}" class="hole-r-num">
                </div>
            </div>

            <div class="editor-row">
                <label>Farbe</label>
                <input type="color" value="${hole.color}" class="hole-color">
            </div>

            <button class="delete-hole">Löschen</button>
        `;

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

        bind(field.querySelector(".hole-x-slider"), field.querySelector(".hole-x-num"), field.querySelector(".val-x"), "x");
        bind(field.querySelector(".hole-y-slider"), field.querySelector(".hole-y-num"), field.querySelector(".val-y"), "y");
        bind(field.querySelector(".hole-r-slider"), field.querySelector(".hole-r-num"), field.querySelector(".val-r"), "r");

        field.querySelector(".hole-color").addEventListener("input", e => {
            hole.color = e.target.value;
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
        field.className = "field";

        field.innerHTML = `
            <h4>Spieler ${index + 1}</h4>

            <div class="editor-row">
                <label>X: <span class="val-x">${player.x}</span></label>
                <div class="editor-inputs">
                    <input type="range" min="0" max="2000" value="${player.x}" class="player-x-slider">
                    <input type="number" value="${player.x}" class="player-x-num">
                </div>
            </div>

            <div class="editor-row">
                <label>Y: <span class="val-y">${player.y}</span></label>
                <div class="editor-inputs">
                    <input type="range" min="0" max="2000" value="${player.y}" class="player-y-slider">
                    <input type="number" value="${player.y}" class="player-y-num">
                </div>
            </div>

            <div class="editor-row">
                <label>Farbe</label>
                <input type="color" value="${player.color}" class="player-color">
            </div>

            <div class="editor-row">
                <label>Team</label>
                <select class="player-team">
                    <option value="1" ${player.team == 1 ? "selected" : ""}>Team 1</option>
                    <option value="2" ${player.team == 2 ? "selected" : ""}>Team 2</option>
                    <option value="3" ${player.team == 3 ? "selected" : ""}>Team 3</option>
                    <option value="4" ${player.team == 4 ? "selected" : ""}>Team 4</option>
                </select>
            </div>

            <button class="delete-player">Löschen</button>
        `;

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

        bind(field.querySelector(".player-x-slider"), field.querySelector(".player-x-num"), field.querySelector(".val-x"), "x");
        bind(field.querySelector(".player-y-slider"), field.querySelector(".player-y-num"), field.querySelector(".val-y"), "y");

        field.querySelector(".player-color").addEventListener("input", e => {
            player.color = e.target.value;
        });

        field.querySelector(".player-team").addEventListener("change", e => {
            player.team = Number(e.target.value);
        });

        field.querySelector(".delete-player").addEventListener("click", () => {
            mapData.players.splice(index, 1);
            renderPlayers();
        });

        grid.appendChild(field);
    });

    container.appendChild(grid);
}





