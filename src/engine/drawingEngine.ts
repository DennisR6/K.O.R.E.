import p5 from "p5";
import type { RenderContext } from "./RenderContext";
import { GameLogger } from "../utils/log";

/**
 * P5Renderer - Der konkrete Grafik-Adapter für p5.js.
 * 
 * Er kümmert sich um:
 * 1. Die Skalierung von Welt-Einheiten in Pixel (toPixel / toWorld).
 * 2. Das Asset-Management (Bilder laden und zwischenspeichern).
 * 3. Das Mapping von Engine-Befehlen auf p5.js-Befehle.
 */
export class P5Renderer implements RenderContext {
	/** Die originale p5-Instanz (das Zeichen-API). */
	p5ctx: p5

	/** Cache für Bilder, damit sie nicht bei jedem Frame neu geladen werden. */
	assets: Map<string, p5.Image>

	WORLD_SCALE_X: number = 1
	WORLD_SCALE_Y: number = 1
	public WORLD_SIZE_X: number = 16
	public WORLD_SIZE_Y: number = 9
	private renderScale = 1;

	/** 
	 * @param p - Die p5-Instanz.
	 * @param scale - Der Skalierungsfaktor (Pixel pro Welt-Einheit).
	 * @param worldWidth - Die gewünschte Breite der logischen Welt.
	 */
	constructor(p: p5, scale: number, worldWidth: number) {
		this.p5ctx = p
		this.assets = new Map<string, p5.Image>()
		this.p5ctx.rectMode(p5.CENTER)

		this.renderScale = scale
		this.WORLD_SCALE_X = scale * 16
		this.WORLD_SCALE_Y = scale * 9
		this.WORLD_SIZE_X = worldWidth
		this.WORLD_SIZE_Y = worldWidth / 16 * 9
	}
	setWorldSize(x: number, y: number) {
		this.WORLD_SIZE_X = x
		this.WORLD_SIZE_Y = y
	}
	setScaleFactor(x: number) {
		this.p5ctx.resetMatrix()
		this.renderScale = x
	}
	getScaleFactor(): number {
		return this.renderScale
	}
	setFillColor(color: string): void {
		this.p5ctx.fill(color)
	}
	setStrokeColor(color: string): void {
		this.p5ctx.stroke(color)
	}
	drawCircle(x: number, y: number, radius: number) {
		if (isNaN(x) || isNaN(y) || isNaN(radius)) {
			GameLogger.error("Variable not Specified")
			return
		}
		this.p5ctx.circle(this.toPixel(x), this.toPixel(y), radius)
	}
	drawRect(x: number, y: number, width: number, height: number) {
		this.p5ctx.rect(this.toPixel(x), this.toPixel(y), this.toPixel(width), this.toPixel(height))
	}
	drawText(text: string, x: number, y: number, fontSize?: number) {
		if (isNaN(x) || isNaN(y)) {
			GameLogger.error("Variable not Specified")
			return
		}
		this.p5ctx.textSize(fontSize || 12)
		this.p5ctx.text(text, this.toPixel(x), this.toPixel(y))
	}
	line(x: number, y: number, x1: number, y1: number) {
		this.p5ctx.line(this.toPixel(x), this.toPixel(y), this.toPixel(x1), this.toPixel(y1))
	}
	clear(color?: string): void {
		this.p5ctx.clear();

		if (color) {
			this.p5ctx.push();
			this.p5ctx.rectMode(this.p5ctx.CORNER);
			this.setFillColor(color);
			this.p5ctx.noStroke();

			this.p5ctx.rect(0, 0, this.p5ctx.width, this.p5ctx.height);
			this.p5ctx.pop();
		}
	}
	loadImage(url: string): void {
		if (!this.assets.has(url)) {
			this.assets.set(url, new p5.Image(10, 10))
			this.p5ctx.loadImage(
				url,
				(img: p5.Image) => {
					this.assets.get(url)!.resize(img.width, img.height);
					this.assets.get(url)!.copy(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height)
				},
				() => { console.error("Error Loading from URL: " + url) }
			)
		}
	}
	drawImage(url: string, dx: number = 0, dy: number = 0, dw: number = 0, dh: number = 0): void {
		const img = this.assets.get(url);
		if (!img) { this.loadImage(url); return; }

		this.p5ctx.imageMode(this.p5ctx.CORNER);
		if (dw == 0) dw = this.WORLD_SIZE_X
		if (dh == 0) dh = this.WORLD_SIZE_Y
		this.p5ctx.image(img, this.toPixel(dx), this.toPixel(dy), this.toPixel(dw), this.toPixel(dh));
	}
	beginClip() {
		this.p5ctx.beginClip()
	}
	endClip() {
		this.p5ctx.endClip()
	}
	getScreenSize(): { width: number, height: number } {
		return {
			width: this.p5ctx.width,
			height: this.p5ctx.height
		}
	}
	setStroke(weight: number): void {
		this.p5ctx.stroke(weight)
	}
	rotate(x: number): void {
		if (Number.isNaN(x)) {
			GameLogger.error("Variable not Specified")
			return
		}
		this.p5ctx.rotate(x)
	}
	scale(x: number): void {
		if (isNaN(x)) {
			GameLogger.error("Variable not Specified")
			return
		}
		this.p5ctx.scale(x)
	}
	translate(x: number, y: number): void {
		if (Number.isNaN(x) || Number.isNaN(y)) {
			GameLogger.error("Variable not Specified")
			return
		}
		this.p5ctx.translate(x, y)
	}
	push(): void {
		this.p5ctx.push()
	}
	pop(): void {
		this.p5ctx.pop()
	}
	mouseWheel(func: (e: MouseEvent) => void) {
		//@ts-ignore
		this.p5ctx.mouseWheel = func
	}
	resizeCanvas(x: number, y: number): void {
		this.p5ctx.resizeCanvas(x * .9, y * .9)
		this.setScaleFactor(x / this.WORLD_SIZE_X)
	}
	// --- KOORDINATEN-LOGIK ---

	/** 
	 * Verwandelt einen Welt-Wert in echte Bildschirm-Pixel.
	 * Ohne diese Funktion wäre das Spiel auf einem 4K-Monitor winzig.
	 */
	toPixel(val: number): number { return val * this.renderScale; }

	/** 
	 * Verwandelt einen Pixel-Wert (z.B. Mausposition) zurück in Welt-Koordinaten.
	 */
	toWorld(val: number) { return val / this.renderScale; }

	windowScale = () => (window.window.innerWidth * 0.9) / 16
}
