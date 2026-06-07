// import type { EffectTrigger, EffectType } from "../effects/types.js";
// import type { RenderContext } from "../engine/RenderContext.js";
// import { SHAPE } from "../physics/physics.js";
// import type { MapBoundary } from "../settings/settings.js";
// import type { IGameContext, ISystem } from "./types.js";
//
// /**
//  * Das BoundarySystem ist für die visuelle Darstellung der Weltgrenzen verantwortlich.
//  * 
//  * Es verwaltet eine Liste von `MapBoundary`-Objekten. Im Gegensatz zum `EntityManager`
//  * kümmert sich dieses System rein um die statische Kulisse der Map.
//  * 
//  * @implements {ISystem} Teil des modularen System-Architektur der Engine.
//  */
// export class BoundarySystem implements ISystem {
// 	/** Die Liste aller Map-Begrenzungen (Wände, Zonen, etc.). */
// 	private structures: MapBoundary<EffectType.Physics, EffectTrigger.Collision>[];
//
// 	/**
// 	 * @param structures - Ein Array von Begrenzungsobjekten, die die Karte definieren.
// 	 */
// 	constructor(structures: MapBoundary<EffectType.Physics, EffectTrigger.Collision>[]) {
// 		this.structures = structures;
// 	}
//
// 	/**
// 	 * Das BoundarySystem ist statisch.
// 	 * Da sich die Weltgrenzen während eines Spielzugs nicht bewegen, 
// 	 * bleibt die Logik-Methode leer.
// 	 */
// 	ticker() { }
//
// 	/**
// 	 * Zeichnet alle sichtbaren Begrenzungen auf den Bildschirm.
// 	 * 
// 	 * @param _ctx - Der aktuelle Spiel-Kontext (wird hier nicht direkt genutzt).
// 	 * @param renderer - Der RenderContext, der die tatsächlichen Zeichenbefehle ausführt.
// 	 * 
// 	 * @note 
// 	 * Strukturen mit der Farbe "transparent" werden physikalisch zwar berechnet 
// 	 * (durch andere Systeme), hier aber bei der Darstellung übersprungen.
// 	 */
// 	draw(_ctx: IGameContext, renderer: RenderContext) {
// 		for (const struct of this.structures) {
// 			if (!struct.color) continue
// 			// Performance & Design: Unsichtbare Wände nicht rendern
//
// 			renderer.setFillColor(struct.color);
// 			renderer.setStrokeColor(struct.color);
//
// 			// Typ-Unterscheidung für das korrekte Rendering-Primitiv
// 			if (struct.type === SHAPE.RECTANGLE) {
// 				renderer.drawRect(struct.x, struct.y, struct.w, struct.h);
// 			} else if (struct.type === SHAPE.CIRCLE) {
// 				renderer.drawCircle(struct.x, struct.y, struct.r);
// 			}
// 		}
// 	}
// }
