
import type { RenderContext } from "../engine/RenderContext";




export function Textborder(ctx: RenderContext, x: number, y: number, w: number, h: number, color: string, text: string, callback?: Function) {
	ctx.push()
	ctx.setFillColor(color)
	ctx.drawRect(x, y, w, h)
	ctx.setStrokeColor("white")
	ctx.drawText(text, x, y - 12, 12)
	ctx.pop()
	if (callback) callback()
}
