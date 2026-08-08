import type { GameHandler } from "../engine/Handler.js";
import type { AiDecision, IAiTurnProducer } from "./aiEmitter.js";
import type { AiSettings } from "./types.js";
import { SeededRandom } from "../utils/random.js";

interface ScoredChoice {
	actorId: string;
	angle: number;
	power: number;
	aimedAtEnemy: boolean;
}

export class HardAi implements IAiTurnProducer {
	public computeTurn(handler: GameHandler, aiSettings: AiSettings): AiDecision | undefined {
		// Greedy bounded search with a seed-dependent tie-break: candidates
		// are evaluated in the fixed priority order below, and the match seed
		// decides which equally-best candidate wins. Killing moves always beat
		// non-killing candidates, and non-killing ties keep aiming at an enemy,
		// so matches keep making progress - but every seed plays a different
		// game while replays stay reproducible from the seed.
		const random = new SeededRandom(aiSettings.seed);

		const entities = handler.getEntityManager().getEntities();
		const aiActors = entities.filter((e) => !e.isDead() && e.getTeam().includes(aiSettings.team) && handler.isActorEligibleForAction(e.getId()));
		const enemyActors = entities.filter((e) => !e.isDead() && !e.getTeam().includes(aiSettings.team));

		if (aiActors.length === 0 || enemyActors.length === 0) return undefined;

		const maxSimulations = aiSettings.decisionLimits?.maxSimulations ?? 36;
		const maxAngleSamples = aiSettings.decisionLimits?.maxAngleSamples ?? 12;
		const maxForceSamples = aiSettings.decisionLimits?.maxForceSamples ?? 3;

		const forceSamples = [4, 7, 10].slice(0, maxForceSamples);
		// Seed-dependent rotation of the fallback angle grid: same density as
		// before, but the sampled directions differ per seed.
		const angleOffset = random.nextInt(360);

		let simCount = 0;
		let bestScore = -Infinity;
		const bestChoices: ScoredChoice[] = [];

		for (const aiActor of aiActors) {
			if (simCount >= maxSimulations) break;
			const aiPos = aiActor.getPos();

			// Candidate angles toward enemies come first (the pre-seed
			// priority order that keeps battles converging).
			const candidateAngles: { angle: number; aimedAtEnemy: boolean }[] = [];
			for (const enemy of enemyActors) {
				const enemyPos = enemy.getPos();
				const dx = enemyPos.x - aiPos.x;
				const dy = enemyPos.y - aiPos.y;
				let angle = Math.atan2(dy, dx) * (180 / Math.PI);
				if (angle < 0) angle += 360;
				candidateAngles.push({ angle: Math.round(angle) % 360, aimedAtEnemy: true });
			}

			// Fill the remaining samples from a seed-rotated grid.
			let angleStep = 360 / Math.max(1, maxAngleSamples);
			for (let i = 0; i < maxAngleSamples; i++) {
				candidateAngles.push({ angle: Math.round((i * angleStep + angleOffset) % 360) % 360, aimedAtEnemy: false });
			}

			// Sample candidates
			for (const candidate of candidateAngles) {
				if (simCount >= maxSimulations) break;
				for (const power of forceSamples) {
					if (simCount >= maxSimulations) break;

					simCount++;
					let score = 0;
					try {
						const sim = handler.simulateTurn(aiActor.getId(), candidate.angle, power);

						// Evaluate finalState from simulation
						for (const pSnapshot of sim.finalState) {
							if (pSnapshot.team.includes(aiSettings.team)) {
								if (!pSnapshot.isPhysicsEnabled || !pSnapshot.isDrawingEnabled) score -= 10000; // Penalize AI elimination
							} else {
								if (!pSnapshot.isPhysicsEnabled || !pSnapshot.isDrawingEnabled) score += 5000; // Reward enemy elimination
							}
						}
					} catch {
						score = -20000;
					}

					if (score > bestScore) {
						bestScore = score;
						bestChoices.length = 0;
					}
					if (score === bestScore) {
						bestChoices.push({
							actorId: aiActor.getId(),
							angle: candidate.angle,
							power,
							aimedAtEnemy: candidate.aimedAtEnemy,
						});
					}
				}
			}
		}

		if (bestChoices.length === 0) return undefined;

		// Seed-dependent tie-break: equal-scoring candidates resolve through
		// the seeded RNG. Non-killing ties stay aimed at an enemy so a battle
		// keeps converging instead of wandering.
		let tieGroup = bestChoices;
		if (bestScore === 0) {
			const aimed = tieGroup.filter(choice => choice.aimedAtEnemy);
			if (aimed.length > 0) tieGroup = aimed;
		}
		const choice = tieGroup[random.nextInt(tieGroup.length)]!;
		return {
			shot: { actorId: choice.actorId, angle: choice.angle, power: choice.power },
		};
	}
}
