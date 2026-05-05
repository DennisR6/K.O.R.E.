import type { IDrawer, IRenderer } from "../engine/RenderContext"
import type { StructureCircle } from "./structureCircle.ts"
import type { StructureLine } from "./structureLine.ts"
import type { StructureRectangle } from "./structureRectangle.ts"


export { StructureCircle } from "./structureCircle.ts"
export { StructureRectangle } from "./structureRectangle.ts"
export { StructureLine } from "./structureLine.ts"

export type Structure = StructureCircle | StructureLine | StructureRectangle
export interface IStructure extends IDrawer, IRenderer {
	getShape(): string
}

