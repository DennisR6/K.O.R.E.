import type { RenderContext } from "../engine/RenderContext";
import type { IItem } from "./Items";
import type {IGameContext} from "../systems/types"
import { StructureCircle } from "../structures/structureCircle";

export class ItemWall implements IItem {
    effectParams
    effectType
    frequency
    id
    name
    probability
    spawn
    trigger
    constructor({effectParams,effectType,frequency,id,name,probability,spawn,trigger}){
    this.effectParams = effectParams
    this.effectType = effectType
    this.frequency = frequency
    this.id = id
    this.name = name
    this.probability = probability
    this.spawn = spawn
    this.trigger = trigger
    }
    draw(_ctx:RenderContext){}
    ticker(ctx:IGameContext,_dt:number,_gf:number){

        ctx.structures.push(new StructureCircle(100,100,20,"green"))
    }
}
