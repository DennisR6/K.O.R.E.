import type { IDrawer, RenderContext } from "../kore/runtime/RenderContext.js";
import type { IGameContext, ISerializableSystem, SystemSettings } from "./types.js";
import type { UiSystem } from "./UiSystem.js";

export class MatchStateIndicator implements IDrawer, ISerializableSystem<SystemSettings> {
	public readonly systemId = "ui.match-state-indicator";
	private context: IGameContext | undefined;
	private rulePhase: string = "physics";
	private selectedItemId: string | null = null;

	constructor(
		private readonly input?: UiSystem,
		private readonly getRulePhase?: () => string,
		private readonly getSelectedItem?: () => string | null,
	) { }
	public toSettings(): SystemSettings { return { systemId: this.systemId, schemaVersion: 1, state: { rulePhase: this.rulePhase, selectedItemId: this.selectedItemId } }; }

	public ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		this.context = ctx;
	}

	public setRulePhase(phase: string): void {
		this.rulePhase = phase;
	}

	public setSelectedItem(itemId: string | null): void {
		this.selectedItemId = itemId;
	}

	public draw(renderer: RenderContext): void {
		const context = this.context;
		if (!context) return;

		const team = context.activeTeam;
		const turn = context.currTurn + 1;
		const phase = this.getRulePhase ? this.getRulePhase() : this.rulePhase;
		const force = this.input?.chargePower ?? 0;
		const item = this.getSelectedItem ? this.getSelectedItem() : (this.selectedItemId ?? "None");

		renderer.push();
		renderer.setFillColor("#1e293b");

		const lines = [
			`Team: ${team + 1}`,
			`Phase: ${phase}`,
			`Turn: ${turn}`,
			`Force: ${Math.round(force * 10) / 10}`,
			`Item: ${item}`,
		];

		let y = 36;
		for (const line of lines) {
			renderer.drawText(line, 20, y, 16);
			y += 22;
		}

		renderer.pop();
	}
}
