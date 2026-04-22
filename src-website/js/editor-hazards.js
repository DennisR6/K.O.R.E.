// editor-hazards.js

export function initHazardsEditor(mapData) {

    const listEl = document.getElementById("hazard-list");
    const addBtn = document.getElementById("btn-add-hazard");
    const deleteBtn = document.getElementById("btn-delete-hazard");

    const typeSelect = document.getElementById("hazard-type");
    const posXInput = document.getElementById("haz-pos-x");
    const posYInput = document.getElementById("haz-pos-y");
    const sizeWInput = document.getElementById("haz-size-w");
    const sizeHInput = document.getElementById("haz-size-h");
    const paramsContainer = document.getElementById("hazard-params");

    let selectedIndex = -1;

    if (!mapData.effects) {
        mapData.effects = [];
    }

    function createDefaultHazard() {
        return {
            id: crypto.randomUUID(),
            type: "push_zone",
            position: { x: 0, y: 0 },
            size: { w: 2, h: 2 },
            params: { direction: 0, force: 1 }
        };
    }

    function renderList() {
        listEl.innerHTML = "";

        mapData.effects.forEach((haz, index) => {
            const li = document.createElement("li");
            li.className = "editor-list-item";
            if (index === selectedIndex) li.classList.add("active");

            li.textContent = `${index + 1}: ${formatHazardLabel(haz)}`;
            li.addEventListener("click", () => {
                saveCurrentHazard();
                selectedIndex = index;
                renderList();
                loadSelectedHazard();
            });

            listEl.appendChild(li);
        });
    }

    function formatHazardLabel(haz) {
        switch (haz.type) {
            case "push_zone": return "Push Zone";
            case "slide_zone": return "Slide Zone";
            case "sticky_zone": return "Sticky Zone";
            case "kill_zone": return "Kill Zone";
            default: return haz.type;
        }
    }

    function loadSelectedHazard() {
        if (selectedIndex < 0 || selectedIndex >= mapData.effects.length) {
            clearDetail();
            return;
        }

        const haz = mapData.effects[selectedIndex];

        typeSelect.value = haz.type;
        posXInput.value = haz.position.x;
        posYInput.value = haz.position.y;
        sizeWInput.value = haz.size.w;
        sizeHInput.value = haz.size.h;

        renderParamsUI(haz.type, haz.params);
    }

    function clearDetail() {
        typeSelect.value = "push_zone";
        posXInput.value = "";
        posYInput.value = "";
        sizeWInput.value = "";
        sizeHInput.value = "";
        paramsContainer.innerHTML = "<p>Kein Hazard ausgewählt.</p>";
    }

    function renderParamsUI(type, params) {
        paramsContainer.innerHTML = "";

        if (type === "push_zone") {
            paramsContainer.innerHTML = `
                <div class="field">
                    <label>Richtung</label>
                    <div class="hazard-slider-row">
                        <input type="range" id="haz-dir" min="0" max="360">
                        <input type="number" id="haz-dir-num" min="0" max="360">
                    </div>
                </div>

                <div class="field">
                    <label>Force</label>
                    <div class="hazard-slider-row">
                        <input type="range" id="haz-force" min="0" max="5" step="0.1">
                        <input type="number" id="haz-force-num" min="0" max="5" step="0.1">
                    </div>
                </div>
            `;

            linkSlider("haz-dir", "haz-dir-num", params.direction ?? 0);
            linkSlider("haz-force", "haz-force-num", params.force ?? 1);
        }

        if (type === "slide_zone") {
            paramsContainer.innerHTML = `
                <div class="field">
                    <label>Slide Faktor</label>
                    <div class="hazard-slider-row">
                        <input type="range" id="haz-slide" min="0" max="2" step="0.1">
                        <input type="number" id="haz-slide-num" min="0" max="2" step="0.1">
                    </div>
                </div>
            `;

            linkSlider("haz-slide", "haz-slide-num", params.slideFactor ?? 1);
        }

        if (type === "sticky_zone") {
            paramsContainer.innerHTML = `
                <div class="field">
                    <label>Stick Faktor</label>
                    <div class="hazard-slider-row">
                        <input type="range" id="haz-stick" min="0" max="1" step="0.1">
                        <input type="number" id="haz-stick-num" min="0" max="1" step="0.1">
                    </div>
                </div>
            `;

            linkSlider("haz-stick", "haz-stick-num", params.stickFactor ?? 0.5);
        }

        if (type === "kill_zone") {
            paramsContainer.innerHTML = `
                <div class="field">
                    <label>Kill on Touch</label>
                    <input type="checkbox" id="haz-kill">
                </div>
            `;

            document.getElementById("haz-kill").checked = params.killOnTouch ?? true;
        }
    }

    function linkSlider(sliderId, numberId, value) {
        const slider = document.getElementById(sliderId);
        const number = document.getElementById(numberId);

        slider.value = value;
        number.value = value;

        slider.addEventListener("input", () => number.value = slider.value);
        number.addEventListener("input", () => slider.value = number.value);
    }

    function readParamsFromUI(type) {
        const params = {};

        if (type === "push_zone") {
            params.direction = Number(document.getElementById("haz-dir").value);
            params.force = Number(document.getElementById("haz-force").value);
        }

        if (type === "slide_zone") {
            params.slideFactor = Number(document.getElementById("haz-slide").value);
        }

        if (type === "sticky_zone") {
            params.stickFactor = Number(document.getElementById("haz-stick").value);
        }

        if (type === "kill_zone") {
            params.killOnTouch = document.getElementById("haz-kill").checked;
        }

        return params;
    }

    function saveCurrentHazard() {
        if (selectedIndex < 0 || selectedIndex >= mapData.effects.length) return;

        const haz = mapData.effects[selectedIndex];

        haz.type = typeSelect.value;
        haz.position.x = Number(posXInput.value);
        haz.position.y = Number(posYInput.value);
        haz.size.w = Number(sizeWInput.value);
        haz.size.h = Number(sizeHInput.value);
        haz.params = readParamsFromUI(haz.type);
    }

    typeSelect.addEventListener("change", () => {
        if (selectedIndex < 0) return;

        const haz = mapData.effects[selectedIndex];
        haz.type = typeSelect.value;
        haz.params = getDefaultParamsForType(haz.type);

        renderParamsUI(haz.type, haz.params);
        renderList();
    });

    function getDefaultParamsForType(type) {
        switch (type) {
            case "push_zone": return { direction: 0, force: 1 };
            case "slide_zone": return { slideFactor: 1 };
            case "sticky_zone": return { stickFactor: 0.5 };
            case "kill_zone": return { killOnTouch: true };
            default: return {};
        }
    }

    addBtn.addEventListener("click", () => {
        saveCurrentHazard();

        const newHaz = createDefaultHazard();
        mapData.effects.push(newHaz);
        selectedIndex = mapData.effects.length - 1;

        renderList();
        loadSelectedHazard();
    });

    deleteBtn.addEventListener("click", () => {
        if (selectedIndex < 0) return;

        mapData.effects.splice(selectedIndex, 1);
        selectedIndex = Math.min(selectedIndex, mapData.effects.length - 1);

        renderList();
        loadSelectedHazard();
    });

    if (mapData.effects.length === 0) {
        mapData.effects.push(createDefaultHazard());
        selectedIndex = 0;
    } else {
        selectedIndex = 0;
    }

    renderList();
    loadSelectedHazard();
}
