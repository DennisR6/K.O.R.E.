import type { IDrawer, IRenderer, RenderContext } from "../engine/RenderContext";
import type { SettingsBackground } from "../settings/settings";


export function getBackgoundSystem(settings?: SettingsBackground): BackgroundColorSystem | BackgroundImageSystem {
	switch (settings?.type) {
		case "color":
			return new BackgroundColorSystem(settings)
		case "image":
			return new BackgroundImageSystem(settings)
		default:
			return new BackgroundColorSystem({ color: "cyan" })
	}
}
export class BackgroundImageSystem implements IRenderer, IDrawer {
	url: string
	constructor(settings: { url: string }) {
		this.url = settings.url

	}
	update(_deltatime: number, _globalfriction: number): void { }

	draw(ctx: RenderContext) {
		ctx.push()
		ctx.drawImage(this.url, 0, 0, ctx.WORLD_SIZE_X, ctx.WORLD_SIZE_Y);
		ctx.pop()
	}
}

export class BackgroundColorSystem implements IDrawer, IRenderer {
	color: string
	constructor(settings: { color: string }) {
		this.color = settings.color

	}
	update(_dt: number) {
		/* Evtl. für animierte Hintergründe */
	}

	draw(ctx: RenderContext) {
		ctx.clear(this.color)
	}
}
