import type { IDrawer, ITicker, StructureCircle, StructureLine, StructureRectangle } from "./structures";

// 2. Definition des Basis-Interface
export interface IStructure extends IDrawer, ITicker {
	getShape(): "circle" | "line" | "rectangle"; // Besser als string (Literal Types!)
}

// 3. Der Union-Type
export type Structure = StructureCircle | StructureLine | StructureRectangle;
