import type p5Types from "p5";
import { P5Renderer } from "./engine/drawingEngine.js";
import type { RenderContext } from "./engine/RenderContext.js";
import { GameSettings } from "./settings/settings.js";
import { LogEmitter, CombiEmitter } from "./emitter/InputEmitter.js";
import { GameHandlerBuilder } from "./engine/Handler.js";
import { GameEmitter } from "./emitter/EngineEmitter.js";


const handler = new GameHandlerBuilder(2)
	.defaultSystems()
	.fromSettings(GameSettings)
	.build()

const em = new CombiEmitter([new LogEmitter(), new GameEmitter(handler)])
handler.setEmitter(em)
handler.start()

const DEFAULTFPS = 60
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

// In deinem Input-Handler oder Window-Listener
window.addEventListener('keydown', (e) => {
	if (e.code === 'Space') {
		const p1 = handler.getEntityManager().getEntities()[0]
		const p2 = handler.getEntityManager().getEntities()[1]

		console.table({ PosX: p1.getPos().x, PosY: p1.getPos().y, VelX: p1.getVel().x, VelY: p1.getVel().y });
		console.table({ PosX: p2.getPos().x, PosY: p2.getPos().y, VelX: p2.getVel().x, VelY: p2.getVel().y });

		handler.tick((1_000 / DEFAULTFPS) / 10);
	}
});
