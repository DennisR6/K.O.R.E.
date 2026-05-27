import type { RenderContext } from "../engine/RenderContext.js";
import type { SettingsBackground } from "../settings/settings.js";
import type { IBackground } from "./types.js";
import type { AssetList } from "../assetManager/assets/assetRegistry.js";


/**
 * Factory-Funktion zur Erstellung des passenden Hintergrund-Systems.
 * 
 * @param settings - Die Hintergrund-Konfiguration aus den Settings.
 * @returns {BackgroundColorSystem | BackgroundImageSystem} Ein System, das ITicker und IDrawer erfüllt.
 * 
 * @example
 * const bg = getBackgoundSystem({ type: "image", url: "/assets/arena.png" });
 */
export function getBackgoundSystem(settings?: SettingsBackground): BackgroundColorSystem | BackgroundImageSystem {
	switch (settings?.type) {
		case "color":
			return new BackgroundColorSystem(settings.color)
		case "image":
			return new BackgroundImageSystem(settings.url)
		default:
			return new BackgroundColorSystem("cyan")
	}
}

/**
 * Zeichnet ein statisches Bild über die gesamte Weltgröße.
 * Ideal für detaillierte Spielfelder (z.B. eine Eishockey-Fläche).
 */
export class BackgroundImageSystem implements IBackground {
	/** URL zum Bild-Asset. */
	private url: AssetList

	constructor(url: AssetList) {
		this.url = url
	}

	/** Statischer Hintergrund: Keine Logik-Updates nötig. */
	public tick(_deltatime: number, _globalfriction: number): void { }

	/**
		 * Rendert das Bild skaliert auf die Welt-Dimensionen.
		 * Nutzt push/pop, um sicherzustellen, dass Transformationen das restliche Rendering nicht beeinflussen.
		 */
	public draw(ctx: RenderContext) {
		ctx.push()
		ctx.drawImage(this.url, 0, 0, ctx.WORLD_SIZE_X, ctx.WORLD_SIZE_Y);
		ctx.pop()
	}
}

/**
 * Füllt den gesamten Hintergrund mit einer soliden Farbe.
 * Performance-optimiert und einfach für Debugging oder minimalistische Stile.
 */
export class BackgroundColorSystem implements IBackground {
	/** CSS-kompatibler Farbstring (z.B. "cyan", "#ff0000"). */
	private color: string
	constructor(color: string) { this.color = color }

	/** Keine Logik-Updates nötig. */
	public tick(_deltatime: number, _globalfriction: number): void { }

	/**
		 * Nutzt die ctx.clear Methode, um die gesamte Canvas-Fläche zu übermalen.
		 */
	public draw(ctx: RenderContext) { ctx.clear(this.color) }
	public getColor(): string { return this.color }
}
