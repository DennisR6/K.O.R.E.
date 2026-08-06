import type p5Types from "p5";
import type { RenderContext } from "./RenderContext.js";
import { assetManager } from "../assetManager/loader.js";
import type { AssetKey } from "../assetManager/assets/assetRegistry.js";
import { calculateDesktopLayout } from "../ui/layout.js";
import { FitWorldCamera } from "../ui/FitWorldCamera.js";
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
	p5ctx: p5Types

	WORLD_SCALE_X: number = 1
	WORLD_SCALE_Y: number = 1
	public WORLD_SIZE_X: number = 16
	public WORLD_SIZE_Y: number = 9
	private renderScale = 1;
	private camera: FitWorldCamera;

	/** 
	 * @param p - Die p5Types.-Instanz.
	 * @param scale - Der Skalierungsfaktor (Pixel pro Welt-Einheit).
	 * @param worldWidth - Die gewünschte Breite der logischen Welt.
	 */
	constructor(p: p5Types, scale: number, worldWidth: number) {
		this.p5ctx = p

		this.renderScale = scale
		this.WORLD_SCALE_X = scale * 16
		this.WORLD_SCALE_Y = scale * 9
		this.WORLD_SIZE_X = worldWidth
		this.WORLD_SIZE_Y = worldWidth / 16 * 9
		this.camera = new FitWorldCamera({ x: this.WORLD_SIZE_X, y: this.WORLD_SIZE_Y });
	}
	setWorldSize(x: number, y: number) {
		this.WORLD_SIZE_X = x
		this.WORLD_SIZE_Y = y
		this.camera.setWorldSize({ x, y })
	}
	setScaleFactor(x: number) {
		this.p5ctx.resetMatrix()
		this.renderScale = x
	}
	getScaleFactor(): number {
		return this.renderScale
	}
	setFillColor(color: string, alpha?: number): void {
		if (color.trim().toLowerCase() === "transparent") {
			this.p5ctx.noFill()
			return
		}
		if (alpha === undefined) {
			this.p5ctx.fill(color)
			return
		}
		if (!Number.isFinite(alpha)) {
			console.error("Variable not Specified")
			return
		}
		const normalizedAlpha = Math.max(0, Math.min(1, alpha))
		if (normalizedAlpha === 0) {
			this.p5ctx.noFill()
			return
		}
		const parsedColor = this.p5ctx.color(color)
		parsedColor.setAlpha(normalizedAlpha * 255)
		this.p5ctx.fill(parsedColor)
	}
	setOpacity(alpha: number): void {
		if (!Number.isFinite(alpha)) {
			console.error("Variable not Specified")
			return
		}
		const context = this.p5ctx.drawingContext as CanvasRenderingContext2D
		context.globalAlpha = Math.max(0, Math.min(1, alpha))
	}
	setNoFill(): void {
		this.p5ctx.noFill()
	}
	setStrokeColor(color: string): void {
		this.p5ctx.stroke(color)
	}
	drawCircle(x: number, y: number, radius: number) {
		if (isNaN(x) || isNaN(y) || isNaN(radius)) {
			console.error("Variable not Specified")
			return
		}
		this.p5ctx.circle(this.toPixel(x), this.toPixel(y), this.toPixel(radius * 2))
	}
	drawRect(x: number, y: number, width: number, height: number, borderRadius = 0) {
		if (![x, y, width, height, borderRadius].every(Number.isFinite)) {
			console.error("Variable not Specified")
			return
		}

		const radius = Math.max(0, Math.min(borderRadius, width / 2, height / 2));
		this.p5ctx.rect(
			this.toPixel(x),
			this.toPixel(y),
			this.toPixel(width),
			this.toPixel(height),
			this.toPixel(radius)
		)
	}
	drawText(text: string, x: number, y: number, fontSize?: number) {
		if (isNaN(x) || isNaN(y)) {
			console.error("Variable not Specified")
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
	drawImage(key: AssetKey | string, dx: number = 0, dy: number = 0, dw: number = 0, dh: number = 0, sx?: number, sy?: number, sw?: number, sh?: number): void {
		const img = assetManager.get(key);
		if (!img) return;

		const targetW = dw === 0 ? this.WORLD_SIZE_X : dw;
		const targetH = dh === 0 ? this.WORLD_SIZE_Y : dh;

		const ctx = (this.p5ctx as any).drawingContext as CanvasRenderingContext2D;

		if (sx !== undefined && sy !== undefined && sw !== undefined && sh !== undefined) {
			ctx.drawImage(
				img,
				sx, sy, sw, sh,
				this.toPixel(dx), this.toPixel(dy),
				this.toPixel(targetW), this.toPixel(targetH)
			);
		} else {
			ctx.drawImage(
				img,
				this.toPixel(dx), this.toPixel(dy),
				this.toPixel(targetW), this.toPixel(targetH)
			);
		}
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
			console.error("Variable not Specified")
			return
		}
		this.p5ctx.rotate(x)
	}
	scale(x: number): void {
		if (isNaN(x)) {
			console.error("Variable not Specified")
			return
		}
		this.p5ctx.scale(x)
	}
	translate(x: number, y: number): void {
		if (Number.isNaN(x) || Number.isNaN(y)) {
			console.error("Variable not Specified")
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
	mouseWheel(func: (e: WheelEvent) => void) {
		//@ts-ignore
		this.p5ctx.mouseWheel = func
	}
	resizeCanvas(x: number, y: number): void {
		const layout = calculateDesktopLayout(x, y, this.WORLD_SIZE_X, this.WORLD_SIZE_Y);
		this.camera.resize(this.WORLD_SIZE_X * layout.scaleFactor, this.WORLD_SIZE_Y * layout.scaleFactor);
		const finalScale = this.camera.getScaleFactor();

		// Setze die Skalierung
		this.setScaleFactor(finalScale);

		// Berechne die finalen Canvas-Dimensionen basierend auf der Weltgröße
		const finalWidth = this.WORLD_SIZE_X * finalScale;
		const finalHeight = this.WORLD_SIZE_Y * finalScale;

		this.p5ctx.resizeCanvas(finalWidth, finalHeight);
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

	public noStroke(): void {
  	this.p5ctx.noStroke();
	}
	public getTextWidth(text: string, size: number): number {
		this.p5ctx.textSize(size);
		return this.p5ctx.textWidth(text);
	}
}
