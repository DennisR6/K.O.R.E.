import type p5Types from "p5";
import { P5Renderer } from "./engine/drawingEngine.js";
import type { RenderContext } from "./engine/RenderContext.js";
import { GameSettings } from "./settings/settings.js";
import { GameHandler, GameHandlerBuilder } from "./engine/Handler.js";
import { MainMenu } from "./menu/Menu.js";
import { AudioManager } from "./menu/AudioManager.js";
import { DirectionArrow } from "./systems/DirectionArrow.js";
import { CombiEmitter, LogEmitter } from "./emitter/InputEmitter.js";
import { EmitterSystem } from "./systems/Emitter.js";
import { ObjectEmitter } from "./emitter/ObjectEmitter.js";

let usersettings = { url: "", mapbuilder: false, skipmenu: false }
const uri = new URL(window.location.href)
for (const [key, value] of uri.searchParams) {
	//@ts-ignore
	usersettings[key] = value
}

// setUserUUUID(undefined)
// let userid = getUserUUUID()!
let handler: GameHandler
const builder = new GameHandlerBuilder()
	.defaultSystems()
if (!usersettings.skipmenu) {
	handler = builder.build()
	const menu = new MainMenu()
	handler.setMouseHandler(menu)
	handler.addPreTickAndDraw(menu)
} else {
	const arrow = new DirectionArrow()
	const em = new CombiEmitter([new LogEmitter(), new ObjectEmitter()])
	handler = builder
		.fromSettings(GameSettings)
		.addSystem(arrow)
		.addSystem(new EmitterSystem(em))
		.build()
	handler.addPostDrawer(arrow)
}
startGame(handler)
function startGame(h: GameHandler) {
	const sketch = (p: p5Types) => {
		let ctx: RenderContext;
		const scale = (window.window.innerWidth * 0.9) / GameSettings.screenResolution.x
		p.setup = () => {
			p.createCanvas(scale * GameSettings.screenResolution.x, scale * GameSettings.screenResolution.y);
			ctx = new P5Renderer(p, scale, GameSettings.screenResolution.x)
			ctx.resizeCanvas(window.window.innerWidth, window.window.innerHeight)
			ctx.mouseWheel(handler.handleMouseWheel)
		};

		p.draw = () => {
			if (!ctx) return
			h.tick()
			p.push()
			h.drawWorld(ctx)
			p.pop()
		};

		// Input Events
		p.mousePressed = () => h.handleMousePressed(ctx.toWorld(p.mouseX), ctx.toWorld(p.mouseY));
		p.mouseMoved = () => {
			if (!ctx) return
			h.updateMouse(ctx.toWorld(p.mouseX), ctx.toWorld(p.mouseY))
		};
		p.mouseReleased = () => h.handleMouseReleased();
		p.mouseWheel = h.handleMouseWheel

		p.windowResized = () => ctx.resizeCanvas(window.window.innerWidth, window.window.innerHeight)


	};

	//@ts-ignore
	new window.p5(sketch)
	window.game = { handler, logs: [], audio: new AudioManager() };
}

const customCursor = document.getElementById('my-cursor')!;
window.addEventListener('mousemove', (e) => {
	customCursor.style.left = e.clientX + 'px';
	customCursor.style.top = e.clientY + 'px';
});

document.addEventListener('keydown', (e) => {
	switch (e.key) {
		case "n": window.game.audio.nextTrack(); break
		case "p": window.game.audio.previousTrack(); break
		case "ArrowUp": window.game.audio.addVolume(0.05); break
		case "ArrowDown": window.game.audio.addVolume(-0.05); break
	}
});

document.addEventListener('click', () => { window.game.audio.start() }, { once: true });
