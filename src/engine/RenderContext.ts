/**
 * Der RenderContext stellt alle Zeichenbefehle bereit.
 * Er abstrahiert die Grafik-Library (z.B. p5.js), damit die Spiellogik 
 * unabhängig von der Anzeige bleibt.
 */
export interface RenderContext {
	WORLD_SIZE_X: number;
	WORLD_SIZE_Y: number;

	drawCircle(x: number, y: number, radius: number): void;
	drawRect(x: number, y: number, width: number, height: number): void;
	drawText(text: string, x: number, y: number, fontSize?: number): void;
	setFillColor(color: string): void;
	setStrokeColor(color: string): void;
	setStroke(weight: number): void;
	rotate(x: number): void;
	scale(x: number): void;
	translate(x: number, y: number): void;
	loadImage(url: string): void;
	drawImage(img: string, dx?: number, dy?: number, dWidth?: number, dHeight?: number, sx?: number, sy?: number, sWidth?: number, sHeight?: number): void;
	getScreenSize(): { width: number, height: number };
	clear(color?: string): void;
	// --- Zustandsspeicher (Wichtig für Junior!) ---
	/** Speichert die aktuellen Styles und Transformationen. */
	push(): void;
	/** Stellt den zuletzt gespeicherten Zustand wieder her. */
	pop(): void;

	line(x: number, y: number, x1: number, x2: number): void;
	resizeCanvas(x: number, y: number): void;
	setScaleFactor(x: number): void;
	getScaleFactor(): number;
	toWorld(val: number): number;
	toPixel(val: number): number;
	windowScale(): number;
	beginClip(): void;
	endClip(): void;

}

/** 
 * Der Taktgeber der Engine. 
 * Alles, was Logik, Bewegung oder Berechnungen verarbeitet, nutzt dieses Interface.
 */
export interface ITicker {
	/** 
	 * Ein Taktimpuls der Engine.
	 * @param deltatime - Die Zeitdifferenz seit dem letzten Takt (wichtig für flüssige Bewegung).
	 * @param globalfriction - Die Reibung, die aktuell auf alle Objekte im Takt wirkt.
	 */
	tick(deltatime: number, globalfriction: number): void;
}

/** 
 * Die Leinwand der Engine.
 * Alles, was für den Spieler sichtbar sein soll, nutzt dieses Interface.
 */
export interface IDrawer {
	/** 
	 * Zeichnet das Objekt auf die Leinwand.
	 * @param ctx - Der RenderContext (dein Pinsel), der die Zeichenbefehle ausführt.
	 */
	draw(ctx: RenderContext): void;
}

