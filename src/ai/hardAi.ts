import type { GameHandler } from "../engine/Handler.js";
import type { AiDecision, IAiTurnProducer } from "./aiEmitter.js";
import type { AiSettings } from "./types.js";

export class HardAi implements IAiTurnProducer {
	public computeTurn(handler: GameHandler, aiSettings: AiSettings): AiDecision | undefined {
		const entities = handler.getEntityManager().getEntities();
		const aiActors = entities.filter((e) => !e.isDead() && e.getTeam().includes(aiSettings.team));
		const enemyActors = entities.filter((e) => !e.isDead() && !e.getTeam().includes(aiSettings.team));

		if (aiActors.length === 0 || enemyActors.length === 0) return undefined;

		const maxSimulations = aiSettings.decisionLimits?.maxSimulations ?? 36;
		const maxAngleSamples = aiSettings.decisionLimits?.maxAngleSamples ?? 12;
		const maxForceSamples = aiSettings.decisionLimits?.maxForceSamples ?? 3;

		const forceSamples = [4, 7, 10].slice(0, maxForceSamples);

		let simCount = 0;
		let bestScore = -Infinity;
		let bestChoice: { actorId: string; angle: number; power: number } | undefined;

		for (const aiActor of aiActors) {
			if (simCount >= maxSimulations) break;
			const aiPos = aiActor.getPos();

			// Collect target angles toward enemies
			const candidateAngles: number[] = [];
			for (const enemy of enemyActors) {
				const enemyPos = enemy.getPos();
				const dx = enemyPos.x - aiPos.x;
				const dy = enemyPos.y - aiPos.y;
				let angle = Math.atan2(dy, dx) * (180 / Math.PI);
				if (angle < 0) angle += 360;
				candidateAngles.push(Math.round(angle) % 360);
			}

			// Fill remaining angle samples deterministically
			let angleStep = 360 / Math.max(1, maxAngleSamples);
			for (let i = 0; i < maxAngleSamples; i++) {
				candidateAngles.push(Math.round(i * angleStep) % 360);
			}

			// Sample candidates
			for (const angle of candidateAngles) {
				if (simCount >= maxSimulations) break;
				for (const power of forceSamples) {
					if (simCount >= maxSimulations) break;

					simCount++;
					let score = 0;
					try {
						const sim = handler.simulateTurn(aiActor.getId(), angle, power);

						// Evaluate finalState from simulation
						for (const pSnapshot of sim.finalState) {
							if (pSnapshot.team.includes(aiSettings.team)) {
								if (pSnapshot.isDead) score -= 10000; // Penalize AI death
							} else {
								if (pSnapshot.isDead) score += 5000; // Reward enemy elimination
							}
						}
					} catch {
						score = -20000;
					}

					if (score > bestScore || !bestChoice) {
						bestScore = score;
						bestChoice = {
							actorId: aiActor.getId(),
							angle,
							power,
						};
					}
				}
			}
		}

		if (!bestChoice) return undefined;

		return {
			shot: bestChoice,
		};
	}
}
