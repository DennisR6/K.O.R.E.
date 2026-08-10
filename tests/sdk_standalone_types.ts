import { engine, type CounterState, type EngineWorldSettings } from "../sdk/engine_sdk.js";
import { ui, type UiMenuSettings } from "../sdk/ui_sdk.js";
import { kore, type KoreMapOptions } from "../sdk/kore_sdk.js";

const world: EngineWorldSettings = engine.createWorld({ id: "typed-world", worldSize: { x: 1, y: 1 } }).build();
const counter: CounterState = engine.createCounterState({ id: "coins" });
const menu: UiMenuSettings = ui.createMenu({ id: "typed-menu", size: { width: 1, height: 1 } }).build();
const options: KoreMapOptions = { id: "typed-map", worldSize: { x: 1, y: 1 } };
const map = kore.createDefaultMap(options);
void world;
void counter;
void menu;
void map;
