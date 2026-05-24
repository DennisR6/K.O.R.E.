import type p5Types from "p5";
import { createTestHandler } from "./engine/Handler.js";
import { P5Renderer } from "./engine/drawingEngine.js";
import type { RenderContext } from "./engine/RenderContext.js";
import { GameSettings } from "./settings/settings.js";
import { Simulator } from "./systems/Simulator.js";
import { defaultPhysics } from "./physics/defaultPhysics.js";
import { LogEmitter, CombiEmitter } from "./emitter/InputEmitter.js";
import { BackgroundImageSystem } from "./ui/Background.js";
import { PhysicsSystem, PlaybackSystem } from "./systems/Systems.js";
import { Round2PlayerSystem } from "./systems/RoundSystem.js";
import { StructureRectangle } from "./structures/structureRectangle.js";
import { StructureCircle } from "./structures/structureCircle.js";
import { GameEmitter } from "./emitter/EngineEmitter.js";
import { DeadlyObstacleCirle } from "./structures/DeadlyObstacleCircle.js";
import { CustomDrawableBackground } from "./ui/CustomDrawableBackground.js";
import { Player } from "./entity/Player.js";
import { Mouse } from "./ui/Mouse.js";


const TickRate = 1

// const socket = io("http://localhost:3000", { autoConnect: true, reconnection: true, auth: { token: getIdOrUUUID() } })
// const sock = new SocketEmitter(socket)


// setTimeout(() => {
// 	sock.sendShot("0", 0, 20)
// }, 5_000)


const physics = new defaultPhysics(GameSettings.friction)
let handler = createTestHandler({ systems: [], physicsStrategy: physics, dt: TickRate });
const physSystem = new PhysicsSystem(physics, TickRate)
handler.addSystem(new Simulator(physSystem))
const em = new CombiEmitter([new LogEmitter(), new GameEmitter(handler)])

if (GameSettings.background?.type === "image")
	handler.addPreDrawer(new BackgroundImageSystem(GameSettings.background.url))
if (GameSettings.background?.type === "color")
	handler.addPreDrawer(new CustomDrawableBackground())
GameSettings.mapBoundarys?.forEach(str => {
	if (str.type === "rectangle") handler.addStructure(new StructureRectangle(str.x, str.y, str.w, str.h, str.color))
	if (str.type === "circle") handler.addStructure(new StructureCircle(str.x, str.y, str.r, str.color))
})

GameSettings.hazzards?.forEach(str => {
	if (str.type === "rectangle") handler.addStructure(new DeadlyObstacleCirle(str.x, str.y, str.w, str.color))
	if (str.type === "circle") handler.addStructure(new DeadlyObstacleCirle(str.x, str.y, str.r, str.color))
})


GameSettings.players?.forEach((player) => handler.getEntityManager().addEntity(new Player().new({ ...player })));
// handler.getEntityManager().addEntity(new DebugPlayer().new({ x: 76, y: 157, size: 1, color: "green" }))

//Erstelle MausHandler und verbinde ihn überall
const mouseHandler = new Mouse(physics, handler.getEntityManager(), ["1"])
handler.addSystem(mouseHandler)
handler.setMouseHandler(mouseHandler)
handler.addPostDrawer(mouseHandler)

handler.setEmitter(em)
handler.addSystem(physSystem)
handler.addSystem(new PlaybackSystem())
handler.addSystem(new Round2PlayerSystem(false))

handler.start()

// setTimeout(() => {
// const turn = [{ actorId: 0, angle: 0, power: 20 }]
// const { actorId, angle, power } = turn[0]
// const sim = handler.simulateTurn(actorId, angle, power);
// handler.tickTurn(sim);
// }, 2_000)

const DEFAULTFPS = 60
const sketch = (p: p5Types) => {
	let ctx: RenderContext;
	const scale = (window.window.innerWidth * 0.9) / GameSettings.screenResolution.x
	p.setup = () => {
		p.createCanvas(scale * GameSettings.screenResolution.x, scale * GameSettings.screenResolution.y);
		// p.frameRate(ACTUALFPS)
		ctx = new P5Renderer(p, scale, GameSettings.screenResolution.x)
		ctx.mouseWheel(handler.handleMouseWheel)
	};

	p.draw = () => {
		if (!ctx) return
		handler.tick()
		p.push()
		handler.drawWorld(ctx)
		p.pop()
		p.push()
		p.stroke(12)
		p.textSize(24)
		// p.text("press <space> for 1 tick", 100, p.height - 20, undefined, undefined)
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
