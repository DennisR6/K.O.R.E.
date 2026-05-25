/**
 * @fileoverview Zentraler Hub für statische Kartenstrukturen.
 */

import type { StructureCircle } from "./structureCircle.js";
import type { StructureLine } from "./structureLine.js";
import type { StructureRectangle } from "./structureRectangle.js";
import type { ITicker } from "./types.js";
import type { IDrawer } from "./types.js";

export type { IDrawer, ITicker } from "../engine/RenderContext.js";
export type { StructureCircle } from "./structureCircle.js";
export type { StructureLine } from "./structureLine.js";
export type { StructureRectangle } from "./structureRectangle.js";

export interface IStructure extends IDrawer, ITicker { getShape(): "circle" | "line" | "rectangle"; }

// 3. Der Union-Type
export type Structure = StructureCircle | StructureLine | StructureRectangle;
