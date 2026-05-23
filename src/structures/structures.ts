/**
 * @fileoverview Zentraler Hub für statische Kartenstrukturen.
 */

// 1. Re-Exporte: Alles, was von außen gebraucht wird, kommt von hier
export type { IDrawer, ITicker } from "../engine/RenderContext.js";
export type { StructureCircle } from "./structureCircle.js";
export type { StructureLine } from "./structureLine.js";
export type { StructureRectangle } from "./structureRectangle.js";
export type { IStructure, Structure } from "./types.ts"
