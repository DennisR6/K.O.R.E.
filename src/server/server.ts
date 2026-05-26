// import express from "express"
// import { createServer } from "node:http";
// import { Server } from "socket.io";
// import type { IInput } from "../engine/types";
// import { Database } from "bun:sqlite";
//
// const db = new Database(":memory:");
// const query = db.query("select 'Hello world' as message;");
// query.get();
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
