import { Player, type IEntity } from "./entity";
import type { SettingsEntity } from "../settings/settings";
import type { IDrawer, IRenderer, RenderContext } from "../engine/RenderContext";

export class EntityManager implements IDrawer, IRenderer {
	private entities: IEntity[] = [];
	constructor(entities: IEntity[]) {
		this.entities = entities
	}

	addEntity(entity: IEntity | IEntity[]) {
		if (Array.isArray(entity))
			entity.forEach(e => this.entities.push(e))
		else
			this.entities.push(entity);
	}

	getEntities(): IEntity[] {
		return this.entities;
	}

	getEntityById(id: string | number): IEntity | undefined {
		return this.entities.find(e => e.getId() === id);
	}
	getEntityAt(x: number, y: number, padding: number = 0): IEntity | undefined {
		return this.entities.find(e => {
			const dist = Math.hypot(e.getPos().x - x, e.getPos().y - y);
			return dist < (e.getBounds().radius + padding);
		});
	}
	resetSpeeds() {
		this.entities.forEach(entity => entity.setVel({ x: 0, y: 0 }))
	}
	public serialize(): any[] {
		return this.entities.map(e => ({
			id: e.getId(),
			x: e.getPos().x,
			y: e.getPos().y,
			vx: e.getVel()?.x ?? 0,
			vy: e.getVel()?.y ?? 0,
			//@ts-ignore
			color: e.color ?? "green"
		}));
	}

	public applySerializedState(state: any[]) {
		state.forEach(data => {
			let existing = this.getEntityById(data.id);
			if (!existing) {
				existing = new Player().new({ id: data.id, x: data.x, y: data.y });
				this.addEntity(existing);
			}
			existing.setPos({ x: data.x, y: data.y });
		});
	}

	addPlayer(data: SettingsEntity) {
		const p = new Player().new({ x: data.x, y: data.y, size: data.size ?? 12, color: data.color, id: data.id, team: data.team, playericon: data.playericon });
		this.entities.push(p);
	}

	update(dt: number, friction: number) {
		this.entities.forEach(e => e.update(dt, friction));
	}

	draw(ctx: RenderContext): void {
		this.entities.forEach(entity => entity.draw(ctx))
	}

	public clone(): EntityManager {
		const newManager = new EntityManager([]);
		const data = this.serialize();
		newManager.applySerializedState(data);
		return newManager;
	}
}
