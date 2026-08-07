import type { IMouse } from "../../engine/types.js";
import type { IDrawer, RenderContext } from "../../engine/RenderContext.js";
import { ui, UiRuntime, type UiRenderer } from "../../engine/ui-sdk/index.js";
import { LANGUAGE_KEYS, type LanguageCatalog } from "../../i18n/language.js";
import { KoreStatusCommand, KoreStatusElement, KoreStatusId, KoreStatusScreen, KoreStatusStyle } from "./statusVocabulary.js";

export class KoreStatusSurface implements IMouse, IDrawer {
	private readonly runtime: UiRuntime;
	private mouse = { x: 0, y: 0 };
	private failed = false;

	public constructor(
		language: LanguageCatalog,
		private readonly onRetry: () => void,
		private readonly onBack: () => void,
	) {
		const composition = ui.createMenu({ id: KoreStatusId.Runtime, size: { width: 800, height: 450 } }).addScreen(ui.screen({
			id: KoreStatusScreen.Main,
			layout: ui.layout.absolute(),
			elements: [
				ui.text({ id: KoreStatusElement.Title, text: language.strings[LANGUAGE_KEYS.LoadingJoining], rect: { x: 160, y: 145, width: 480, height: 42 }, style: KoreStatusStyle.Title }),
				ui.text({ id: KoreStatusElement.Message, text: language.strings[LANGUAGE_KEYS.LoadingConnecting], rect: { x: 100, y: 205, width: 600, height: 36 }, style: KoreStatusStyle.Message }),
				ui.button({ id: KoreStatusElement.Retry, text: language.strings[LANGUAGE_KEYS.LoadingRetry], rect: { x: 250, y: 280, width: 140, height: 42 }, style: KoreStatusStyle.Retry, visible: false, action: ui.action.emit(KoreStatusCommand.Retry) }),
				ui.button({ id: KoreStatusElement.Back, text: language.strings[LANGUAGE_KEYS.LoadingBack], rect: { x: 410, y: 280, width: 140, height: 42 }, style: KoreStatusStyle.Back, visible: false, action: ui.action.emit(KoreStatusCommand.Back) }),
			],
		})).build();
		this.runtime = UiRuntime.fromSettings(composition);
	}
	public getRuntime(): UiRuntime { return this.runtime; }

	public setMessage(message: string): void { this.runtime.dispatch({ type: "setText", target: KoreStatusElement.Message, text: message }); }
	public fail(message: string): void {
		this.failed = true;
		this.setMessage(message);
		this.runtime.setElementVisible(KoreStatusElement.Retry, true);
		this.runtime.setElementVisible(KoreStatusElement.Back, true);
	}
	public updateMouse(x: number, y: number): void { this.mouse = { x, y }; }
	public handleMousePressed(): void {
		if (!this.failed) return;
		this.runtime.tick({ pointer: { ...this.mouse, pressed: true, justPressed: true } });
		for (const command of this.runtime.drainCommands()) {
			if (command.command === KoreStatusCommand.Retry) this.onRetry();
			if (command.command === KoreStatusCommand.Back) this.onBack();
		}
	}
	public handleMouseReleased(): void { }
	public handleMouseWheel(_event: WheelEvent): void { }
	public tick(): void { this.runtime.tick({ pointer: { ...this.mouse } }); }
	public draw(renderer: RenderContext): void { this.runtime.draw(new StatusRenderer(renderer)); }
}

class StatusRenderer implements UiRenderer {
	public constructor(private readonly renderer: RenderContext) { }
	public drawText(element: Parameters<UiRenderer["drawText"]>[0]): void {
		this.renderer.setFillColor("#f8fafc");
		this.renderer.drawText(element.text ?? "", element.rect.x, element.rect.y + (element.id === KoreStatusElement.Title ? 32 : 22), element.id === KoreStatusElement.Title ? 32 : 18);
	}
	public drawButton(element: Parameters<UiRenderer["drawButton"]>[0]): void {
		this.renderer.setFillColor(element.style === KoreStatusStyle.Back ? "#0f172a" : "#1d4ed8");
		this.renderer.drawRect(element.rect.x, element.rect.y, element.rect.width, element.rect.height);
		this.renderer.setFillColor("#ffffff");
		this.renderer.drawText(element.text ?? "", element.rect.x + 12, element.rect.y + 27, 16);
	}
	public drawTextInput(element: Parameters<UiRenderer["drawTextInput"]>[0]): void { this.drawButton(element); }
	public drawImage(element: Parameters<UiRenderer["drawImage"]>[0]): void { if (element.source) this.renderer.drawImage(element.source, element.rect.x, element.rect.y, element.rect.width, element.rect.height); }
}

export function createKoreStatusSurface(language: LanguageCatalog, onRetry: () => void, onBack: () => void): KoreStatusSurface {
	return new KoreStatusSurface(language, onRetry, onBack);
}
