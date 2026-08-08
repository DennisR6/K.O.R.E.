import type { Vector2D } from "../physics/physics.js";

export function arrangeInGrid(
	players: { position: Vector2D, size: number }[],
	rect: { x: number, y: number, w: number, h: number },
	padding: number = 0,
): void {
	if (players.length === 0) return;

	const size = players[0].size * 2;
	const cellSize = size + padding + 1;
	const cols = Math.max(1, Math.floor(rect.w / cellSize));
	const rows = Math.max(1, Math.floor(rect.h / cellSize));
	if (cols * rows < players.length) throw new Error("Nicht genug Platz für alle Spieler!");

	players.forEach((player, index) => {
		const col = index % cols;
		const row = Math.floor(index / cols);
		player.position.x = rect.x + (col * cellSize) + (size / 2);
		player.position.y = rect.y + (row * cellSize) + (size / 2);
	});
}
