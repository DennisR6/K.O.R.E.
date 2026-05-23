import type { IDrawer, ITicker, RenderContext } from "../engine/RenderContext.js";

/**
 * @deprecated
 * Diese UI-Implementierung stammt aus einer älteren Version der Engine und ist 
 * aktuell NICHT kompatibel mit dem neuen Render-System.
 * 
 * @reason
 * Die Klasse dient nur noch als Referenz-Archiv für:
 * 1. **Item-Slot-Logik**: Die mathematische Berechnung der zentrierten Slots am unteren Rand.
 * 2. **Drag & Drop**: Fragmente der alten Maus-Interaktion (auskommentiert).
 * 
 * @planned
 * Teile dieser Logik (insbesondere die Item-Visualisierung) werden in eine neue
 * `UIOverlaySystem` Komponente überführt. Nutze diese Klasse nicht für aktive Features!
 */
export interface UIStrategy extends IDrawer, ITicker {
	activeItem: number;
}

/**
 * @deprecated
 * Standard-UI der alten Version.
 * ⚠️ Achtung: Viele Methoden greifen auf veraltete Kontext-Strukturen zu.
 */
export class DefaultUI implements UIStrategy {
	private width: number;
	private height: number;
	private gap: number;
	private amnt: number;

	public activeItem: number = 0;
	public statusText: string = "Waiting...";
	public gameId: string = "No ID";
	public isMyTurn: boolean = false;

	constructor({ width, height, gap, amnt }: { width: number, height: number, gap: number, amnt: number }) {
		this.width = width || 50;
		this.height = height || 50;
		this.gap = gap || 10;
		this.amnt = amnt || 5;
	}
	tick(_deltatime: number, _globalfriction: number): void {

	}

	draw(ctx: RenderContext): void {
		const screenW = ctx.getScreenSize().width;
		const screenH = ctx.getScreenSize().height;
		const centerX = screenW / 2;

		// --- 1. Status Bar (Oben Links) ---
		ctx.setFillColor("rgba(0, 0, 0, 0.6)");
		ctx.drawRect(0, 0, 300, 40);
		ctx.setFillColor("white");
		// ctx.drawText(`ID: ${data.gameId}`, 15, 25, 14);

		// --- 2. Turn-Indikator (Oben Mitte) ---
		// const turnText = data.isMyTurn ? "DEIN ZUG" : "GEGNER ZIEHT...";
		// const turnColor = data.isMyTurn ? "#2ecc71" : "#e74c3c";
		// ctx.setFillColor(turnColor);
		ctx.drawRect(centerX - 75, 0, 150, 35);
		ctx.setFillColor("white");
		// ctx.drawText(turnText, centerX - 60, 23, 16);

		// --- 3. Item-Slots (Unten Mitte) ---
		const margin = 20; // Abstand vom unteren Bildschirmrand

		// Wichtig: Die exakte Gesamtbreite berechnen
		const totalBarWidth = (this.amnt * this.width) + ((this.amnt - 1) * this.gap);

		// Der Startpunkt liegt in der Mitte des Bildschirms minus der halben Bar-Breite
		const startingX = centerX - (totalBarWidth / 2);
		const bottomY = screenH - this.height - margin;

		for (let i = 0; i < this.amnt; i++) {
			const isSelected = (i === this.activeItem);

			// Jedes Item wird vom startingX aus versetzt
			const slotX = startingX + (i * (this.width + this.gap));
			const slotY = bottomY;

			// Slot Hintergrund
			ctx.setFillColor(isSelected ? "rgba(52, 152, 219, 0.9)" : "rgba(44, 62, 80, 0.8)");
			ctx.setStroke(isSelected ? 3 : 1);
			ctx.setStrokeColor(isSelected ? "white" : "black");

			ctx.drawRect(slotX, slotY, this.width, this.height);

			// Item Nummer
			ctx.setFillColor("white");
			// Kleiner Fix: Zentrieren der Zahl im Slot (vorausgesetzt Slot ist ca 50px breit)
			ctx.drawText(`${i + 1}`, slotX + (this.width / 2) - 5, slotY + (this.height / 2) + 7, 18);
		}

		ctx.setStroke(1);
	}


	// In main.ts im p.draw immer handler.updateMouse(p.mouseX, p.mouseY, scale) rufen
	// updateMouse(x: number, y: number, scale: number) {
	// this.dragCurrent = { x: x / scale, y: y / scale };
	// }
}
