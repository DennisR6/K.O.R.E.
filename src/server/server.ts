

// const TickRate = 1
// const physics = new defaultPhysics(FRICTION_TABLE.wood)
// let handler = createTestHandler({ systems: [], physicsStrategy: physics, dt: TickRate });
// const physSys = new PhysicsSystem(physics, TickRate)
// const em = new CombiEmitter([new LogEmitter()])
// handler.setEmitter(em)
// handler.addSystem(physSys)
// handler.addSystem(new Simulator(physSys))
// handler.addSystem(new PlaybackSystem())
// handler.addSystem(new NoRoundSystem())
// GameSettings.mapBoundarys?.forEach((str: MapBoundary) => {
// 	if (str.type === "rectangle") handler.addStructure(new StructureRectangle(str.x, str.y, str.w, str.h, str.color))
// 	if (str.type === "circle") handler.addStructure(new StructureCircle(str.x, str.y, str.r, str.color))
// })
// // GameSettings.players?.forEach((player) => handler.getEntityManager().addEntity(new Player().new({ ...player })));
// handler.start()
//
//
// const app = express();
// const httpServer = createServer(app);
// const io = new Server(httpServer, {
// 	cors: { origin: "*" }
// });
//
//
//
// io.on("connection", (socket) => {
// 	console.log(`User connected: ${socket.id}`, socket.handshake.auth.token);
//
// 	socket.on("shoot", (input: IInput) => {
// 		const { actorId, angle, power } = input
// 		const res = handler.simulateTurn(actorId, angle, power)
// 		console.log(input, res)
// 		socket.emit("turn", () => res)
// 	})
// 	socket.on("disconnect", () => {
// 		console.log("User disconnected");
// 	});
// });
//
//
//
// httpServer.listen(3000, () => {
// 	console.log("Socket-Server läuft auf Port 3000");
// });
