import type { GameHandler } from "../kore/runtime/Handler.js";
import { SeededRandom } from "../utils/random.js";
import type { AiDecision, IAiTurnProducer } from "./aiEmitter.js";
import type { AiSettings } from "./types.js";

export class MediumAi implements IAiTurnProducer {
	public computeTurn(handler: GameHandler, aiSettings: AiSettings): AiDecision | undefined {
		const entities = handler.getEntityManager().getEntities();
		const aiActors = entities.filter((e) => !e.isDead() && e.getTeam().includes(aiSettings.team) && handler.isActorEligibleForAction(e.getId()));
		const enemyActors = entities.filter((e) => !e.isDead() && !e.getTeam().includes(aiSettings.team));

		if (aiActors.length === 0 || enemyActors.length === 0) return undefined;

		const random = new SeededRandom(aiSettings.seed + handler.getTurnNumber() * 37);
		const worldSize = handler.getContext().worldSize;

		let bestScore = -Infinity;
		let bestChoice: { actorId: string; angle: number; power: number } | undefined;

		for (const aiActor of aiActors) {
			const aiPos = aiActor.getPos();

			for (const enemyActor of enemyActors) {
				const enemyPos = enemyActor.getPos();
				const dx = enemyPos.x - aiPos.x;
				const dy = enemyPos.y - aiPos.y;
				const dist = Math.hypot(dx, dy);

				let angle = Math.atan2(dy, dx) * (180 / Math.PI);
				if (angle < 0) angle += 360;

				let score = 1000 - dist;

				// Penalty if shooting toward nearby boundary when near edge
				if (worldSize.x > 0 && worldSize.y > 0) {
					const nearLeftEdge = aiPos.x < 60 && dx < 0;
					const nearRightEdge = aiPos.x > worldSize.x - 60 && dx > 0;
					const nearTopEdge = aiPos.y < 60 && dy < 0;
					const nearBottomEdge = aiPos.y > worldSize.y - 60 && dy > 0;

					if (nearLeftEdge || nearRightEdge || nearTopEdge || nearBottomEdge) {
						score -= 500;
					}
				}

				if (score > bestScore) {
					bestScore = score;
					// Calculate power based on distance (bounded 2..10)
					const calculatedPower = Math.min(10, Math.max(2, Math.round(dist / 30)));
					bestChoice = {
						actorId: aiActor.getId(),
						angle: Math.round(angle) % 360,
						power: calculatedPower,
					};
				}
			}
		}

		if (!bestChoice) return undefined;

		// Add small deterministic variance based on seed
		const angleVariance = (random.nextInt(5) - 2); // -2 to +2 degrees
		const finalAngle = (bestChoice.angle + angleVariance + 360) % 360;

		return {
			shot: {
				actorId: bestChoice.actorId,
				angle: finalAngle,
				power: bestChoice.power,
			},
		};
	}
}
