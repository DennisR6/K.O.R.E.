export function initModesEditor() {

    const select = document.getElementById("mode-select");
    const lms = document.getElementById("mode-lms");
    const ko = document.getElementById("mode-ko");

    function updateModeUI() {
        const mode = select.value;

        if (mode === "last_man_standing") {
            lms.style.display = "block";
            ko.style.display = "none";
        } else {
            lms.style.display = "none";
            ko.style.display = "block";
        }
    }

    select.addEventListener("change", updateModeUI);
    updateModeUI();

    // SPEICHERN
    document.getElementById("btn-save-mode").addEventListener("click", () => {

        const mode = select.value;

        if (mode === "last_man_standing") {
            mapData.mode = {
                type: "last_man_standing",
                params: {
                    itemsEnabled: document.getElementById("lms-items").checked,
                    hazardsEnabled: document.getElementById("lms-hazards").checked,
                    allowTies: document.getElementById("lms-ties").checked
                }
            };
        }

        if (mode === "knockout_race") {
            mapData.mode = {
                type: "knockout_race",
                params: {
                    pointsToWin: Number(document.getElementById("ko-points").value),
                    respawn: document.getElementById("ko-respawn").checked,
                    respawnDelay: Number(document.getElementById("ko-delay").value),
                    maxRespawnsPerRound: Number(document.getElementById("ko-maxrespawn").value),
                    itemsEnabled: document.getElementById("ko-items").checked,
                    hazardsEnabled: document.getElementById("ko-hazards").checked
                }
            };
        }

        console.log("Modus gespeichert:", mapData.mode);
    });
}

