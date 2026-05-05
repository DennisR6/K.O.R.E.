/**
 * @fileoverview Definitionen für statische Kartenobjekte (Strukturen).
 * Strukturen sind unbewegliche Hindernisse wie Wände oder Pfosten.
 */

import type { IDrawer, ITicker } from "../engine/RenderContext";
import type { StructureCircle } from "./structureCircle.ts";
import type { StructureLine } from "./structureLine.ts";
import type { StructureRectangle } from "./structureRectangle.ts";

/**
 * Ein Sammel-Typ (Union Type) für alle verfügbaren Struktur-Formen.
 * Erlaubt es der Engine, Hindernisse generisch zu behandeln, während die 
 * konkrete Form (Kreis, Linie, Rechteck) erst bei der Kollision wichtig wird.
 */
export type Structure = StructureCircle | StructureLine | StructureRectangle;

/**
 * Das Basis-Interface für jede Struktur auf der Karte.
 * 
 * Jede Struktur muss:
 * 1. **IDrawer**: Sich selbst auf der Karte zeichnen können.
 * 2. **ITicker**: Auf Zeit reagieren (auch wenn sie meist statisch bleibt).
 */
export interface IStructure extends IDrawer, ITicker {
	/**
	 * Gibt die Form der Struktur als String zurück (z.B. "circle", "line", "rectangle").
	 * Wird vom PhysicsSystem genutzt, um den korrekten Kollisions-Algorithmus zu wählen.
	 * @returns {string} Die Kennung der Form.
	 */
	getShape(): string;
}


export type { IDrawer, ITicker } from "../engine/RenderContext"
export type { StructureCircle } from "./structureCircle.ts"
export type { StructureLine } from "./structureLine.ts"
export type { StructureRectangle } from "./structureRectangle.ts"

export interface IStructure extends IDrawer, ITicker { getShape(): string }

