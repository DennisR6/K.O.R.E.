import type { Item, Settings } from "../settings/settings";
import { type Structure, StructureCircle, StructureLine, StructureRectangle } from "../structures/structures";
import type { Drawer, Renderer, RenderContext } from "./RenderContext";
import { Player, type IEntity } from "../entity/entity"
import { defaultPhysics, type PhysicsStrategy } from "../physics/physics";
import { BackgroundColor, BackgroundImage, type IBackground } from "../background/background";
import { type UIStrategy, DefaultUI } from "../ui/uiStrategy.ts"

export class Handler implements Renderer, Drawer {
	entitys: Array<IEntity>;
	structures: Array<Structure>;
	physics: PhysicsStrategy
	background: IBackground
	friction: number
	item: Item[] = []
	ui: UIStrategy
	constructor(settings?: Settings) {
		this.entitys = [];
		this.structures = [];
		this.physics = new defaultPhysics()
		this.friction = 1
		this.ui = new DefaultUI(
			settings?.screenResolution.factor! * 16 / 6 * 2.5,
			settings?.screenResolution.factor! * 9 / 6 * 5,
			50,
			50,
			10,
			5
		)
		switch (settings?.background?.type) {
			case "color": {
				this.background = new BackgroundColor(settings.background.color)
				break
			}
			case "image": {
				this.background = new BackgroundImage(settings.background.url)
				break
			}
			default:
				this.background = new BackgroundColor("green")
		}

		if (settings != undefined) {
			this.importSettings(settings)
		}
	}

	// TODO:
	importSettings(settings: Settings) {
		// NOTE: Importiere alle Wände
		settings.mapBoundarys?.forEach(structure => {
			switch (structure.type) {
				case "circle": {
					const { x, y, r, color } = structure
					this.structures.push(new StructureCircle(x, y, r, color))
					break
				}
				case "line": {
					const { x, y, x2, y2, color } = structure
					this.structures.push(new StructureLine(x, y, x2, y2, color))
					break
				}
				case "rectangle": {
					const { x, y, w, h, color } = structure
					this.structures.push(new StructureRectangle(x, y, w, h, color))
					break
				}
				default:
					const e: never = structure
					console.log(`${(e as any).type} is not Implemented yet.`)
					return
			}
		})
		// NOTE: importiere alle Spieler
		settings.players?.forEach((player, id) => {
			const { x, y, team, color, playericon } = player
			this.entitys.push(new Player(x, y, team, color, playericon, id))
		})
		this.friction = settings.friction!;
		(new Array().concat(this.entitys, this.structures)).forEach((item: IEntity) => item.setFriction(settings.friction || 0.95))

		// TODO: importiere die item-Settings 
		settings.items?.forEach(item => this.item.push(item))

		// TODO: importiere die Effekte
		settings.effects
	}
	// NOTE: stable
	addStructure(structure: Structure) {
		this.structures.push(structure)
	}
	// NOTE: stable
	addEntity(entity: IEntity) {
		this.entitys.push(entity)
	}
	// NOTE: stable
	draw(ctx: RenderContext) {
		ctx.clear("white")
		ctx.push()
		this.background.draw(ctx)
		ctx.pop()
		for (const structure of this.structures) {
			ctx.push()
			structure.draw(ctx)
			ctx.pop()
		}
		for (const entity of this.entitys) {
			ctx.push()
			entity.draw(ctx)
			ctx.pop()
		}
		ctx.push()
		this.ui.draw(ctx)
		ctx.pop()
	}
	// NOTE: stable
	render(deltatime: number) {
		for (let i = 0; i < this.entitys.length; i++) {
			for (let j = i + 1; j < this.entitys.length; j++) {
				const e1 = this.entitys[i];
				const e2 = this.entitys[j];
				if (this.physics.checkCollision(e1, e2)) {
					this.physics.handleCollision(e1, e2);
				}
			}
		}

		for (const entity of this.entitys) {
			for (const struct of this.structures) {
				if (this.physics.checkCollision(entity, struct)) {
					this.physics.handleCollision(entity, struct);
				}
			}
		}

		for (const entity of this.entitys) {
			entity.render(deltatime)
		}
	}
}
