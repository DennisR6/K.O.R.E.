import type p5Types from "p5";
import { P5Renderer } from "./engine/drawingEngine.js";
import type { RenderContext } from "./engine/RenderContext.js";
import { GameSettings } from "./settings/settings.js";
import { LogEmitter, CombiEmitter } from "./emitter/InputEmitter.js";
import { GameHandlerBuilder } from "./engine/Handler.js";
import { NetworkEmitter } from "./emitter/Emitter.js";



const handler = new GameHandlerBuilder()
	.defaultSystems()
	.fromSettings(GameSettings)
	.build()

const socket = new WebSocket("ws://localhost:3000", ["deviceID", crypto.randomUUID()])
socket.onmessage = (event) => {
	const output = JSON.parse(event.data)
	switch (output.type) {
		case "turn": {
			handler.tickTurn(output.sim)
			break
		}
		case "init": {
			console.log("init", output)
			break
		}
		default:
			console.log("TODO", output.type)
	}
}
socket.onopen = () => {
	socket.send(JSON.stringify({ type: "PING", sender: "Player1" }));
};

const em = new CombiEmitter([new LogEmitter(), new NetworkEmitter(socket)])
handler.setEmitter(em)
handler.start()

const sketch = (p: p5Types) => {
	let ctx: RenderContext;
	const scale = (window.window.innerWidth * 0.9) / GameSettings.screenResolution.x
	p.setup = () => {
		p.createCanvas(scale * GameSettings.screenResolution.x, scale * GameSettings.screenResolution.y);
		ctx = new P5Renderer(p, scale, GameSettings.screenResolution.x)
		ctx.mouseWheel(handler.handleMouseWheel)
	};

	p.draw = () => {
		if (!ctx) return
		handler.tick()
		p.push()
		handler.drawWorld(ctx)
		p.pop()
	};

	// Input Events
	p.mousePressed = () => handler.handleMousePressed(ctx.toWorld(p.mouseX), ctx.toWorld(p.mouseY));
	p.mouseDragged = () => handler.updateMouse(ctx.toWorld(p.mouseX), ctx.toWorld(p.mouseY));
	p.mouseReleased = () => handler.handleMouseReleased();
	p.mouseWheel = handler.handleMouseWheel

	p.windowResized = () => ctx.resizeCanvas(window.window.innerWidth, window.window.innerHeight)

};

// new window.p5(sketch);
//@ts-ignore
new window.p5(sketch)
window.game = { handler, logs: [] };

window.addEventListener('keydown', (e) => { });
