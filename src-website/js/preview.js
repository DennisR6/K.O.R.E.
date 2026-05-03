// preview.js

export function initPreview() {
    // Popup-Button (wie bisher)
    document.getElementById("btn-preview-popup").addEventListener("click", () => {
        const popup = window.open("", "previewPopup", "width=900,height=700");
        popup.document.write("<h1>Slipstrike Preview</h1>");
    });

    // Live-Vorschau iframe initialisieren
    const previewFrame = document.getElementById("preview-frame");

    if (previewFrame) {
        // preview.html in das iframe laden
        previewFrame.src = "preview/preview.html";
    }
}

// Wird vom Editor aufgerufen, wenn JSON geändert wurde
export function updatePreview(jsonString) {
    const previewFrame = document.getElementById("preview-frame");

    if (!previewFrame || !previewFrame.contentWindow) {
        console.warn("Preview frame not ready");
        return;
    }

    try {
        previewFrame.contentWindow.updateArena(jsonString);
    } catch (e) {
        console.error("Fehler beim Senden an Preview:", e);
    }
}

