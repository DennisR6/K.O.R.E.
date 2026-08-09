import type { RenderContext } from "../engine/RenderContext.js";
import { GameState } from "../engine/types.js";
import type { ItemDocument, ItemPickup, ItemPickupState } from "../item/types.js";
import { type MatchResult, type RuleState } from "../rules/types.js";
import type { MapBoundarySettings } from "../settings/settings.js";
import { SHAPE } from "../physics/physics.js";
import type { PlayerSettings } from "../entity/types.js";
import { createEnglishLanguage, type LanguageCatalog } from "../i18n/language.js";

/**
 * Read-only boundary used by the gameplay renderer. It deliberately has no
 * mutation APIs so presentation cannot become a second gameplay model.
 */
export interface AuthoritativeGameplaySnapshot {
  gameState: GameState;
  ruleState: RuleState;
  matchResult: MatchResult | undefined;
  structures: MapBoundarySettings[];
  players: PlayerSettings[];
  items: ItemDocument[];
  pickups: ItemPickup[];
  pickupState: ItemPickupState | undefined;
}

export interface AuthoritativeGameplayState {
  getAuthoritativeRenderState(): AuthoritativeGameplaySnapshot;
}

/** Draws the complete live match from the authoritative handler on every frame. */
export class AuthoritativeGameplayRenderer {
  private language: LanguageCatalog = createEnglishLanguage();
  public constructor(private readonly state: AuthoritativeGameplayState) { }
  public setLanguage(language: LanguageCatalog): void { this.language = language; }

  public draw(renderer: RenderContext): void {
    const snapshot = this.state.getAuthoritativeRenderState();

    for (const structure of snapshot.structures) this.drawStructure(renderer, structure);
    this.drawPickups(renderer, snapshot.pickups, snapshot.pickupState, snapshot.items);
    for (const player of snapshot.players) this.drawPlayer(renderer, player, snapshot.ruleState.activeTeam);
  }

  private drawStructure(renderer: RenderContext, structure: MapBoundarySettings): void {
    if (structure.drawingEnabled === false) return;
    const role = structure.role;
    const color = structure.color ?? "#64748b";
    if (role !== "containment") {
      renderer.push();
      renderer.setFillColor(color);
      renderer.setStrokeColor(color);
      this.drawShape(renderer, structure);
      renderer.pop();
    }
    if (role === "containment" || role === "both") {
      renderer.push();
      renderer.setNoFill();
      renderer.setStrokeColor(color);
      renderer.setStroke(2);
      this.drawShape(renderer, structure);
      renderer.pop();
    }
  }

  private drawShape(renderer: RenderContext, structure: MapBoundarySettings): void {
    switch (structure.type) {
      case SHAPE.CIRCLE: renderer.drawCircle(structure.x, structure.y, structure.r); return;
      case SHAPE.RECTANGLE: renderer.drawRect(structure.x, structure.y, structure.w, structure.h); return;
      case SHAPE.LINE: renderer.line(structure.x, structure.y, structure.x2, structure.y2); return;
    }
  }

  private drawPickups(renderer: RenderContext, pickups: ItemPickup[], state: ItemPickupState | undefined, items: ItemDocument[]): void {
    for (const [index, pickup] of pickups.entries()) {
      const collected = state?.pickups[index]?.collected ?? 0;
      if (collected >= (pickup.maxPickupsPerTurn ?? 1)) continue;
      const item = items.find(candidate => candidate.id === pickup.itemId);
      renderer.push();
      if (item?.ui?.component) {
        renderer.drawImage(item.ui.component.source, pickup.spawnRegion.x, pickup.spawnRegion.y, pickup.spawnRegion.w, pickup.spawnRegion.h);
        renderer.pop();
        continue;
      }
      renderer.setNoFill();
      renderer.setStrokeColor("#facc15");
      renderer.setStroke(2);
      renderer.drawRect(pickup.spawnRegion.x, pickup.spawnRegion.y, pickup.spawnRegion.w, pickup.spawnRegion.h);
      renderer.setFillColor("#713f12");
      renderer.drawText(pickup.itemId, pickup.spawnRegion.x, pickup.spawnRegion.y - 4, 12);
      renderer.pop();
    }
  }

  private drawPlayer(renderer: RenderContext, player: PlayerSettings, activeTeam: number): void {
    const position = player.position;
    renderer.push();
    if (!player.isPhysicsEnabled && !player.isDrawingEnabled) {
      renderer.setFillColor("#64748b");
      renderer.setStrokeColor("#cbd5e1");
      renderer.drawCircle(position.x, position.y, player.size);
      renderer.line(position.x - player.size / 2, position.y - player.size / 2, position.x + player.size / 2, position.y + player.size / 2);
      renderer.line(position.x - player.size / 2, position.y + player.size / 2, position.x + player.size / 2, position.y - player.size / 2);
      renderer.drawText(this.language.strings["kore.ui.world.out"], position.x - player.size, position.y + player.size + 12, 12);
      renderer.pop();
      return;
    }

    renderer.drawImage(player.hoop, position.x - player.size, position.y - player.size, player.size * 2, player.size * 2);
    renderer.drawImage(player.playericon, position.x - player.size, position.y - player.size, player.size * 2, player.size * 2);
    if (player.team.includes(activeTeam)) {
      renderer.setNoFill();
      renderer.setStrokeColor(activeTeam === 0 ? "#38bdf8" : "#fb7185");
      // renderer.setStroke(2);
      // renderer.drawCircle(position.x, position.y, player.size);
    }
		player.effects.forEach((effect, index) => {
			renderer.setNoFill();
			renderer.setStrokeColor("#a78bfa");
			renderer.drawCircle(position.x, position.y, player.size + 7 + index * 3);
			renderer.setFillColor("#4c1d95");
			renderer.drawText(effect.type.replace("EffectType.", ""), position.x + player.size + 4, position.y + index * 12, 11);
		});
    renderer.pop();
  }
}
