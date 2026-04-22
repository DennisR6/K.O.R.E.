import type { Drawer, RenderContext, Renderer } from "../engine/RenderContext";

import assets from "../assets/assets.ts";

export interface UIStrategy extends Drawer, Renderer { }



export class DefaultUI implements UIStrategy {
	x: number;
	y: number;
	width: number;
	height: number;
	gap: number;
	amnt: number;
	activeItem: number = 0;

	constructor(x: number, y: number, width: number, height: number, gap: number, amnt: number) {
		this.x = x || 10;
		this.y = y || 10;
		this.width = width || 50;
		this.height = height || 50;
		this.gap = gap || 10;
		this.amnt = amnt || 5;
	}
	render(_deltatime: number): void { }
	draw(ctx: RenderContext): void {
		{//Catch Mouse Scrolling
			//Scrolle durch die leiste unten
			// TODO: da könntest du jetzt einen Rahmen zeichnen 
			// und/oder ein Bild als Item einfügen, das ist ab da nurnoch Implementierungsfrage
			ctx.mouseWheel((e: MouseEvent) => {
				//das @ts-ignore muss da stehen, weil es sonst probleme mit dem Typescript system macht, weil er delta nicht kennt.
				// Das Delta kommt aber von P5.js, der library die wir nutzen, es wird quasi "geimpft".
				//
				//@ts-ignore
				if (e.delta > 0) {
					this.activeItem = (this.activeItem + 1) % this.amnt
				} else if (this.activeItem <= 0) {
					this.activeItem = this.amnt - 1
				} else {
					this.activeItem = (this.activeItem - 1) % this.amnt
				}
			})
		}
		{//Text for the Turn
			assets.Textborder(ctx, 60, 60, 100, 50, "blue", "123", () => { })
			ctx.setFillColor("white")
			ctx.drawRect(495, 80, 80, 30)
			ctx.setFillColor("black")
			ctx.drawText("Your Turn!", 500, 100, 15)
		}
		{// Draw ItemSlots
			for (let i = 0; i < 6; i++) {
				if (i < 5) ctx.setFillColor("green")
				if (i < 4) ctx.setFillColor("yellow")
				if (i < 2) ctx.setFillColor("red")
				ctx.drawRect(150 + (i * 60), 150, 50, 40)
			}
			ctx.setFillColor("green")
			for (let i = 0; i < this.amnt; i++)
				if (i == this.activeItem) {
					ctx.setFillColor("blue")
					ctx.drawRect(this.x + (this.width + this.gap) * i, this.y, this.width, this.height)
				} else {
					ctx.setFillColor("green")
					ctx.drawRect(this.x + (this.width + this.gap) * i, this.y, this.width, this.height)
				}
			ctx.setStroke(1)
		}
	}
}



