import type { IDrawer, RenderContext } from "../runtime/RenderContext.js";
import type { IMouse } from "../runtime/types.js";
import { LANGUAGE_KEYS, type LanguageCatalog } from "../../i18n/language.js";

export class KoreShareSurface implements IDrawer, IMouse {
	private url = "";
	private visible = false;
	private mouse = { x: 0, y: 0 };
	private status = "";
	public constructor(private readonly language: LanguageCatalog) { }
	public setUrl(url: string): void { this.url = url; this.visible = true; this.status = languageText(this.language, LANGUAGE_KEYS.ReplayLinkReady); }
	public updateMouse(x: number, y: number): void { this.mouse = { x, y }; }
	public handleMousePressed(): void {
		if (!this.handlesMousePress()) return;
		void Promise.resolve(navigator.clipboard?.writeText(this.url)).then(() => { this.status = languageText(this.language, LANGUAGE_KEYS.ReplayCopied); }).catch(() => { this.status = languageText(this.language, LANGUAGE_KEYS.ReplayCopyUnavailable); });
	}
	public handlesMousePress(): boolean { return this.visible && this.containsButton(); }
	public handleMouseReleased(): void { }
	public handleMouseWheel(_event: WheelEvent): void { }
	public draw(renderer: RenderContext): void {
		if (!this.visible) return;
		renderer.push();
		renderer.setFillColor("#0f172a");
		renderer.drawRect(120, 80, 560, 100);
		renderer.setFillColor("#f8fafc");
		renderer.drawText(this.status, 140, 108, 16);
		renderer.drawText(this.url, 140, 135, 12);
		renderer.setFillColor("#1d4ed8");
		renderer.drawRect(500, 145, 150, 26);
		renderer.setFillColor("#ffffff");
		renderer.drawText(languageText(this.language, LANGUAGE_KEYS.ReplayCopy), 510, 163, 12);
		renderer.pop();
	}
	private containsButton(): boolean { return this.mouse.x >= 500 && this.mouse.x <= 650 && this.mouse.y >= 145 && this.mouse.y <= 171; }
}

function languageText(language: LanguageCatalog, key: typeof LANGUAGE_KEYS[keyof typeof LANGUAGE_KEYS]): string { return language.strings[key]; }

export function createKoreShareSurface(language: LanguageCatalog): KoreShareSurface { return new KoreShareSurface(language); }
