// editor-ai.js

export function initAIEditor(mapData) {

    const difficultySelect = document.getElementById("ai-difficulty");

    const sliders = {
        aggressiveness: document.getElementById("ai-aggressiveness"),
        riskTaking: document.getElementById("ai-risk"),
        itemPriority: document.getElementById("ai-item"),
        hazardAwareness: document.getElementById("ai-hazard"),
        errorRate: document.getElementById("ai-error")
    };

    const numbers = {
        aggressiveness: document.getElementById("ai-aggressiveness-num"),
        riskTaking: document.getElementById("ai-risk-num"),
        itemPriority: document.getElementById("ai-item-num"),
        hazardAwareness: document.getElementById("ai-hazard-num"),
        errorRate: document.getElementById("ai-error-num")
    };

    const presets = {
        easy:    { aggressiveness:20, riskTaking:10, itemPriority:30, hazardAwareness:20, errorRate:40 },
        normal:  { aggressiveness:50, riskTaking:40, itemPriority:50, hazardAwareness:60, errorRate:20 },
        hard:    { aggressiveness:75, riskTaking:60, itemPriority:70, hazardAwareness:80, errorRate:10 },
        insane:  { aggressiveness:95, riskTaking:90, itemPriority:90, hazardAwareness:95, errorRate:2 }
    };

    function applyPreset(name) {
        const preset = presets[name];
        for (const key in preset) {
            sliders[key].value = preset[key];
            numbers[key].value = preset[key];
        }
    }

    function linkSlider(key) {
        const slider = sliders[key];
        const number = numbers[key];

        slider.addEventListener("input", () => {
            number.value = slider.value;
            detectCustom();
        });

        number.addEventListener("input", () => {
            let val = Number(number.value);
            if (isNaN(val)) val = 0;
            if (val < 0) val = 0;
            if (val > 100) val = 100;
            number.value = val;
            slider.value = val;
            detectCustom();
        });
    }

    function detectCustom() {
        const current = difficultySelect.value;
        if (current === "custom") return;

        const preset = presets[current];
        for (const key in preset) {
            if (Number(sliders[key].value) !== preset[key]) {
                difficultySelect.value = "custom";
                return;
            }
        }
    }

    difficultySelect.addEventListener("change", () => {
        const diff = difficultySelect.value;
        if (diff !== "custom") {
            applyPreset(diff);
        }
    });

    for (const key in sliders) {
        linkSlider(key);
    }

    // Initial: Normal-Preset setzen oder aus mapData laden
    if (!mapData.ai) {
        mapData.ai = {
            difficulty: "normal",
            aggressiveness: presets.normal.aggressiveness,
            riskTaking: presets.normal.riskTaking,
            itemPriority: presets.normal.itemPriority,
            hazardAwareness: presets.normal.hazardAwareness,
            errorRate: presets.normal.errorRate
        };
    }

    // UI aus mapData initialisieren
    if (presets[mapData.ai.difficulty]) {
        difficultySelect.value = mapData.ai.difficulty;
        applyPreset(mapData.ai.difficulty);
    } else {
        difficultySelect.value = "custom";
        sliders.aggressiveness.value = mapData.ai.aggressiveness;
        sliders.riskTaking.value = mapData.ai.riskTaking;
        sliders.itemPriority.value = mapData.ai.itemPriority;
        sliders.hazardAwareness.value = mapData.ai.hazardAwareness;
        sliders.errorRate.value = mapData.ai.errorRate;

        numbers.aggressiveness.value = mapData.ai.aggressiveness;
        numbers.riskTaking.value = mapData.ai.riskTaking;
        numbers.itemPriority.value = mapData.ai.itemPriority;
        numbers.hazardAwareness.value = mapData.ai.hazardAwareness;
        numbers.errorRate.value = mapData.ai.errorRate;
    }

    document.getElementById("btn-save-ai").addEventListener("click", () => {

        const diff = difficultySelect.value;

        mapData.ai = {
            difficulty: diff,
            aggressiveness: Number(sliders.aggressiveness.value),
            riskTaking: Number(sliders.riskTaking.value),
            itemPriority: Number(sliders.itemPriority.value),
            hazardAwareness: Number(sliders.hazardAwareness.value),
            errorRate: Number(sliders.errorRate.value)
        };

        console.log("AI gespeichert:", mapData.ai);
    });
}


