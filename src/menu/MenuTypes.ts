import type { IMouse } from "../engine/types.js";
import type { IDrawer, ITicker } from "../structures/types.js";
import type { Pages } from "./Menu.js";

export interface IMenu extends IDrawer, ITicker, IMouse { }
export interface IMenuPage extends IDrawer, ITicker, IMouse {
	switchSite(page: Pages): void
}
