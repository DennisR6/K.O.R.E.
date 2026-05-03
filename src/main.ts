import './style.css'
import { P5Renderer } from "./engine/drawingEngine"
import { Handler } from './engine/handler'
import p5 from 'p5'
import setttings from './settings/settings'
import json from "../public/map.json"

const handler = new Handler(json)

const sketch = (p: p5) => {
	const ctx = new P5Renderer(p)
	p.setup = () => {
		p.createCanvas(16 * setttings.screenResolution.factor, 9 * setttings.screenResolution.factor)
	}
	p.draw = () => {
		handler.render(p.deltaTime)
		handler.draw(ctx)
	}
}
new p5(sketch)

document.querySelector<HTMLBodyElement>('body')!.innerHTML = `<div></div>`
