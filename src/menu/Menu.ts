import type { RenderContext } from "../engine/RenderContext.js";
import { AssetList } from "../assetManager/assets/assetRegistry.js";
import type { IMenu, IMenuPage } from "./MenuTypes.js";


const TimeFactorInSeconds = 60
const MaxTimerSeconds = 10


export const enum Pages {
	LandingPage,
	MainMenu,
	Settings,
	Choose_Server,
	Choose_GameMode,
	Choose_Items,
}
type MiniMouseImplementation = { pressed: boolean, x: number, y: number, released: boolean }
export class MainMenu implements IMenu {
	private mouse: MiniMouseImplementation = { released: false, pressed: false, x: 0, y: 0 }
	private pages: IMenu[] = [
		new LandingPage((page: Pages) => this.activePage = page),
		new MainMenuPage((page: Pages) => this.activePage = page),
	]
	constructor() { }
	private activePage: number = 0;
	tick(deltatime: number, globalfriction: number): void { this.pages[this.activePage].tick(deltatime, globalfriction) }
	handleMousePressed(): void {
		this.mouse.pressed = true;
		this.pages[this.activePage].handleMousePressed()
	}
	handleMouseReleased(): void {
		this.mouse.pressed = false
		this.pages[this.activePage].handleMouseReleased()
	}
	handleMouseWheel(event: WheelEvent): void { this.pages[this.activePage].handleMouseWheel(event) }
	updateMouse(mouseX: number, mouseY: number): void {
		this.mouse.x = mouseX;
		this.mouse.y = mouseY;
		this.pages[this.activePage].updateMouse(mouseX, mouseY)
	}
	draw(ctx: RenderContext): void { this.pages[this.activePage].draw(ctx) }
}

export class LandingPage implements IMenuPage {
	private mouse: MiniMouseImplementation = { released: false, pressed: false, x: 0, y: 0 }
	private timer = 0
	private cb: (page: Pages) => void
	constructor(pageSwitcher: (page: Pages) => void) { this.cb = pageSwitcher }
	draw(ctx: RenderContext): void {
		ctx.push()
		ctx.drawImage(AssetList.slipstrikeTitelbildschirmPNG)
		ctx.setFillColor("blue")
		if (this.timer > TimeFactorInSeconds * 5) {
			ctx.drawText("drücke um zu starten", 200, 200, 48)
		}
		ctx.pop()
	}

	handleMousePressed(): void { this.switchSite(Pages.MainMenu) }
	handleMouseReleased(): void { }
	handleMouseWheel(_event: WheelEvent): void { }

	tick(_deltatime: number, _globalfriction: number): void {
		if (this.timer > (MaxTimerSeconds * TimeFactorInSeconds)) return;
		this.timer += 1
	}
	updateMouse(x: number, y: number): void { this.mouse = { ...this.mouse, x, y } }
	switchSite(page: Pages) { this.cb(page) }
}

export class MainMenuPage implements IMenuPage {
	private mouse: MiniMouseImplementation = { released: false, pressed: false, x: 0, y: 0 }
	private timer = 0
	private cb: (page: Pages) => void
	constructor(pageSwitcher: (page: Pages) => void) { this.cb = pageSwitcher }
	draw(ctx: RenderContext): void {
		ctx.push()
		ctx.drawImage(AssetList.slipstrikeTitelbildschirmPNG)
		ctx.setFillColor("blue")
		if (this.timer > TimeFactorInSeconds * 5) ctx.drawText("drücke um zu starten", 200, 200, 48)
		ctx.pop()
	}

	handleMousePressed(): void { }
	handleMouseReleased(): void { }
	handleMouseWheel(_event: WheelEvent): void { }

	tick(_deltatime: number, _globalfriction: number): void {
		if (this.timer > (MaxTimerSeconds * TimeFactorInSeconds)) return;
		this.timer += 1
	}
	updateMouse(x: number, y: number): void { this.mouse = { ...this.mouse, x, y } }
	switchSite(page: Pages) { this.cb(page) }
}
