import type { RenderContext } from "../engine/RenderContext.js";
import { AssetList } from "../assetManager/assets/assetRegistry.js";
import type { IMenu, IMenuPage } from "./MenuTypes.js";
import { MAP_CATALOG, type MapCatalogEntry } from "../content/mapCatalog.js";
import { buildOnlineJoinUrl } from "../utils/onlineConfig.js";


const TimeFactorInSeconds = 60
const MaxTimerSeconds = 10
// Four stacked menu actions: KI vs KI, Play Online, Play Local Game, Choose Map.
const kiButton = { x: 270, y: 176, w: 260, h: 58 }
const onlineButton = { x: 270, y: 240, w: 260, h: 58 }
const playButton = { x: 270, y: 304, w: 260, h: 58 }
const chooseMapButton = { x: 270, y: 368, w: 260, h: 58 }


export const enum Pages {
	LandingPage,
	MainMenu,
	ChooseMap,
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
	/** Which mode consumes the next map selection on the Choose Map page. */
	private pendingMapAction: "local" | "battle" | null = null
	private readonly mapPage: MapSelectionPage
	constructor(
		onPlayLocal?: () => void,
		onSelectMap?: (mapId: string) => void,
		private readonly getStartError?: () => string | undefined,
		onPlayOnline?: () => void,
		onPlayAiBattle?: (mapId: string) => void,
	) {
		this.mapPage = new MapSelectionPage(
			(page: Pages) => {
				// Leaving the map page without picking a map discards the
				// pending local/battle intent.
				if (page === Pages.MainMenu) this.pendingMapAction = null
				this.activePage = page
			},
			(mapId: string) => {
				const action = this.pendingMapAction
				this.pendingMapAction = null
				if (action === "battle") {
					onPlayAiBattle?.(mapId)
					return
				}
				onSelectMap?.(mapId)
			},
		)
		this.pages = [
			new LandingPage((page: Pages) => this.activePage = page),
			new MainMenuPage((page: Pages) => this.activePage = page, onPlayLocal, () => this.openMapSelection("local"), onPlayOnline, () => this.openMapSelection("battle")),
			this.mapPage,
		]
	}
	/** Opens the map selection page for a pending local match or KI battle. */
	private openMapSelection(action: "local" | "battle"): void {
		this.mapPage.setSelectionMode(action)
		this.pendingMapAction = action
		this.activePage = Pages.ChooseMap
	}
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
	draw(ctx: RenderContext): void {
		this.pages[this.activePage].draw(ctx)
		const error = this.getStartError?.()
		if (error) {
			ctx.setFillColor("#b91c1c")
			ctx.drawText(error, 80, 390, 18)
		}
	}
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
	constructor(
		pageSwitcher: (page: Pages) => void,
		private readonly onPlayLocal?: () => void,
		private readonly onChooseMap?: () => void,
		private readonly onPlayOnline?: () => void,
		private readonly onPlayAiBattle?: () => void,
	) { this.cb = pageSwitcher }
	draw(ctx: RenderContext): void {
		ctx.push()
		ctx.drawImage(AssetList.slipstrikeTitelbildschirmPNG)
		ctx.setFillColor("#102a43")
		ctx.drawRect(kiButton.x, kiButton.y, kiButton.w, kiButton.h)
		ctx.drawRect(onlineButton.x, onlineButton.y, onlineButton.w, onlineButton.h)
		ctx.drawRect(playButton.x, playButton.y, playButton.w, playButton.h)
		ctx.drawRect(chooseMapButton.x, chooseMapButton.y, chooseMapButton.w, chooseMapButton.h)
		ctx.setFillColor("white")
		ctx.drawText("KI vs KI", kiButton.x + 28, kiButton.y + 38, 28)
		ctx.drawText("Play Online", onlineButton.x + 28, onlineButton.y + 38, 28)
		ctx.drawText("Play Local Game", playButton.x + 28, playButton.y + 38, 28)
		ctx.drawText("Choose Map", chooseMapButton.x + 28, chooseMapButton.y + 38, 28)
		ctx.pop()
	}

	handleMousePressed(): void {
		const { x, y } = this.mouse
		if (x >= kiButton.x && x <= kiButton.x + kiButton.w && y >= kiButton.y && y <= kiButton.y + kiButton.h) {
			this.onPlayAiBattle?.()
			return
		}
		if (x >= onlineButton.x && x <= onlineButton.x + onlineButton.w && y >= onlineButton.y && y <= onlineButton.y + onlineButton.h) {
			if (this.onPlayOnline) {
				this.onPlayOnline()
				return
			}
			void buildOnlineJoinUrl(window.location.href)
				.then(url => { window.location.assign(url) })
				.catch(error => console.warn("Online join failed", error))
			return
		}
		if (x >= playButton.x && x <= playButton.x + playButton.w && y >= playButton.y && y <= playButton.y + playButton.h) {
			if (this.onPlayLocal) {
				this.onPlayLocal()
				return
			}
			const url = new URL(window.location.href)
			url.searchParams.set("skipmenu", "1")
			url.searchParams.delete("url")
			window.location.assign(url.toString())
			return
		}
		if (x >= chooseMapButton.x && x <= chooseMapButton.x + chooseMapButton.w && y >= chooseMapButton.y && y <= chooseMapButton.y + chooseMapButton.h) {
			this.onChooseMap?.()
			return
		}
	}
	handleMouseReleased(): void { }
	handleMouseWheel(_event: WheelEvent): void { }

	tick(_deltatime: number, _globalfriction: number): void {
		if (this.timer > (MaxTimerSeconds * TimeFactorInSeconds)) return;
		this.timer += 1
	}
	updateMouse(x: number, y: number): void { this.mouse = { ...this.mouse, x, y } }
	switchSite(page: Pages) { this.cb(page) }
}

/** Browser-visible map selection for every `browserAvailable` catalog map. */
export class MapSelectionPage implements IMenuPage {
	private mouse: MiniMouseImplementation = { released: false, pressed: false, x: 0, y: 0 }
	private cb: (page: Pages) => void
	private mode: "local" | "battle" = "local"
	private readonly allMaps: readonly MapCatalogEntry[]
	constructor(pageSwitcher: (page: Pages) => void, private readonly onSelectMap: (mapId: string) => void) {
		this.cb = pageSwitcher
		this.allMaps = MAP_CATALOG.filter(entry => entry.browserAvailable)
	}
	/**
	 * Restricts the shown rows to maps whose autonomous KI battle terminates
	 * (`battleAvailable`); local matches keep the full browser-visible list.
	 */
	setSelectionMode(mode: "local" | "battle"): void { this.mode = mode }
	private get maps(): readonly MapCatalogEntry[] {
		return this.mode === "battle" ? this.allMaps.filter(entry => entry.battleAvailable) : this.allMaps
	}
	private rowRect(index: number) { return { x: 150, y: 80 + index * 50, w: 500, h: 40 } }
	private backRect() { return { x: 150, y: 80 + this.maps.length * 50 + 8, w: 120, h: 34 } }

	draw(ctx: RenderContext): void {
		ctx.push()
		ctx.drawImage(AssetList.slipstrikeTitelbildschirmPNG)
		ctx.setFillColor("white")
		ctx.drawText("Choose Map", 320, 45, 34)
		this.maps.forEach((entry, index) => {
			const row = this.rowRect(index)
			ctx.setFillColor("#102a43")
			ctx.drawRect(row.x, row.y, row.w, row.h)
			ctx.setFillColor("white")
			ctx.drawText(`${entry.name} (${entry.id})`, row.x + 20, row.y + 30, 20)
		})
		const back = this.backRect()
		ctx.setFillColor("#102a43")
		ctx.drawRect(back.x, back.y, back.w, back.h)
		ctx.setFillColor("white")
		ctx.drawText("Back", back.x + 40, back.y + 25, 20)
		ctx.pop()
	}

	handleMousePressed(): void {
		const { x, y } = this.mouse
		for (const [index, entry] of this.maps.entries()) {
			const row = this.rowRect(index)
			if (x >= row.x && x <= row.x + row.w && y >= row.y && y <= row.y + row.h) {
				this.onSelectMap(entry.id)
				return
			}
		}
		const back = this.backRect()
		if (x >= back.x && x <= back.x + back.w && y >= back.y && y <= back.y + back.h) {
			this.cb(Pages.MainMenu)
		}
	}
	handleMouseReleased(): void { }
	handleMouseWheel(_event: WheelEvent): void { }

	tick(_deltatime: number, _globalfriction: number): void { }
	updateMouse(x: number, y: number): void { this.mouse = { ...this.mouse, x, y } }
	switchSite(page: Pages) { this.cb(page) }
}
