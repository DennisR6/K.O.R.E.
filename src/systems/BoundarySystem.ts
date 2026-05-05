import type { RenderContext } from "../engine/RenderContext";
import type { MapBoundary } from "../settings/settings";
import type { IGameContext, ISystem } from "./types";

export class BoundarySystem implements ISystem {
	private structures: MapBoundary[];

	constructor(structures: MapBoundary[]) {
		this.structures = structures;
	}

	update() { }

	draw(_ctx: IGameContext, renderer: RenderContext) {
		for (const struct of this.structures) {
			if (struct.color === "transparent") continue;

			renderer.setFillColor(struct.color);
			renderer.setStrokeColor(struct.color);

			if (struct.type === "rectangle") {
				renderer.drawRect(struct.x, struct.y, struct.w, struct.h);
			} else if (struct.type === "circle") {
				renderer.drawCircle(struct.x, struct.y, struct.r);
			}
		}
	}
}
