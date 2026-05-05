import p5 from "p5";
import { createTestHandler, GameHandler } from "./engine/Handler";
import { P5Renderer } from "./engine/drawingEngine.ts";
import type { RenderContext } from "./engine/RenderContext";
import { FRICTION_TABLE, GameSettings } from "./settings/settings";
import { GameEmitter } from "./emitter/EngineEmitter.ts";
import { Simulator } from "./engine/Simulator.ts";
import { defaultPhysics } from "./physics/defaultPhysics.ts";
import { LogEmitter, CombiEmitter } from "./emitter/InputEmitter.ts";
import { BackgroundImageSystem } from "./ui/Background.ts";
import { PhysicsSystem, PlaybackSystem } from "./systems/Systems.ts";
import { NoRoundSystem } from "./systems/RoundSystem.ts";
import { TrackerPlayer } from "./entity/trackingPlayer.ts";
import { StructureRectangle } from "./structures/structureRectangle.ts";


const physics = new defaultPhysics(FRICTION_TABLE.wood)
let handler = createTestHandler({ systems: [], physicsStrategy: physics });
handler.setSimulator(new Simulator())
const em = new CombiEmitter([new LogEmitter(), new GameEmitter(handler)])
handler.setEmitter(em)
handler.addSystem(new PhysicsSystem(physics, 60))
handler.addSystem(new PlaybackSystem())
handler.addSystem(new NoRoundSystem())
handler.addPreDrawer(new BackgroundImageSystem({ url: "/eis.png" }))
GameSettings.mapBoundarys?.forEach(str => {
	if (str.type === "rectangle") {
		handler.addStructure(new StructureRectangle(str.x, str.y, str.w, str.h, str.color))
	}
})

GameSettings.players?.forEach((player) => handler.getEntityManager().addEntity(new TrackerPlayer().new({ ...player })));
handler.start()

const turn = [{ actorId: '0', angle: 210.6326165894326, power: 22.94228880033126 }]
const { actorId, angle, power } = turn[0]
const sim = handler.simulateTurn(actorId, angle, power); handler.tickTurn(sim);

const DEFAULTFPS = 60
const sketch = (p: p5) => {
	let ctx: RenderContext;
	const scale = (window.window.innerWidth * 0.9) / GameSettings.screenResolution.x
	p.setup = () => {
		p.createCanvas(scale * GameSettings.screenResolution.x, scale * GameSettings.screenResolution.y);
		ctx = new P5Renderer(p, scale, GameSettings.screenResolution.x)
	};

	p.draw = () => {
		if (!ctx) return
		handler.tick(1)
		p.push()
		handler.drawWorld(ctx)
		p.pop()
		p.push()
		handler.drawUI(ctx)
		p.pop()
		p.push()
		p.stroke(12)
		p.textSize(24)
		p.text("drücke Leerzeichen um die Engine 1x zu ticken", 100, p.height - 20, undefined, undefined)
		p.pop()
	};

	// Input Events
	p.mousePressed = () => handler.handleMousePressed(ctx.toWorld(p.mouseX), ctx.toWorld(p.mouseY));
	p.mouseDragged = () => handler.updateMouse(ctx.toWorld(p.mouseX), ctx.toWorld(p.mouseY));
	p.mouseReleased = () => handler.handleMouseReleased();


	p.windowResized = () => ctx.resizeCanvas(window.window.innerWidth, window.window.innerHeight)

};

new p5(sketch);

declare global {
	interface Window {
		game: {
			handler: GameHandler
			logs: string[]
		}
	}
}
window.game = { handler, logs: [] };


// In deinem Input-Handler oder Window-Listener
window.addEventListener('keydown', (e) => {
	if (e.code === 'Space') {
		const p1 = handler.getEntityManager().getEntities()[0]
		const p2 = handler.getEntityManager().getEntities()[1]
		console.log("Tick")
		console.log(`Pos.x: ${p1.getVel().x} Pos.y: ${p1.getVel().y} Vel.x${p1.getVel().x} Vel.y: ${p1.getVel().y}`);
		console.log(`Pos.x: ${p2.getVel().x} Pos.y: ${p2.getVel().y} Vel.x${p2.getVel().x} Vel.y: ${p2.getVel().y}`);
		handler.tick((1_000 / DEFAULTFPS) / 10);
	}
});
