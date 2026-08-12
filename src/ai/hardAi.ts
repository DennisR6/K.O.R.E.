import type { GameHandler } from "../kore/runtime/Handler.js";
import type { AiDecision, IAiTurnProducer } from "./aiEmitter.js";
import type { AiSettings } from "./types.js";
import { SeededRandom } from "../utils/random.js";
import { RulePhase } from "../rules/types.js";
import { validateItemTarget, type ItemTarget } from "../item/target.js";
import type { ItemDocument } from "../item/types.js";
import type { IEntity } from "../entity/Entity.js";

interface ScoredChoice {
	actorId: string;
	angle: number;
	power: number;
	aimedAtEnemy: boolean;
}

interface ScoredItemChoice {
	actorId: string;
	itemId: string;
	target: ItemTarget;
	score: number;
}

/** Maximum simulation horizon used only while ranking speculative Hard AI candidates. */
export const HARD_AI_SPECULATIVE_MAX_TICKS = 300 as const;

export class HardAi implements IAiTurnProducer {
	public computeTurn(handler: GameHandler, aiSettings: AiSettings): AiDecision | undefined {
		// Greedy bounded search with a seed-dependent tie-break: candidates
		// are evaluated in the fixed priority order below, and the match seed
		// decides which equally-best candidate wins. Killing moves always beat
		// non-killing candidates, and non-killing ties keep aiming at an enemy,
		// so matches keep making progress - but every seed plays a different
		// game while replays stay reproducible from the seed.
		const random = new SeededRandom(aiSettings.seed);
		const rule = handler.getRuleState();

		const entities = handler.getEntityManager().getEntities();
		const aiActors = entities.filter((e) => !e.isDead() && e.getTeam().includes(aiSettings.team) && handler.isActorEligibleForAction(e.getId()));
		const enemyActors = entities.filter((e) => !e.isDead() && !e.getTeam().includes(aiSettings.team));

		if (aiActors.length === 0 || enemyActors.length === 0) return undefined;
		if (rule.phase === RulePhase.Item) return this.chooseItem(handler, aiActors, enemyActors, random);

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
		const simulatedScores = new Map<string, number>();

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
					const simulationKey = `${aiActor.getId()}:${candidate.angle}:${power}`;
					let score = simulatedScores.get(simulationKey);
					if (score === undefined) {
						score = 0;
						try {
							const sim = handler.simulateTurn(aiActor.getId(), candidate.angle, power, { maxTicks: HARD_AI_SPECULATIVE_MAX_TICKS });

							// Score both terminal outcomes and actual tactical progress.
							// A death-only score leaves every harmless shot tied at zero,
							// which lets Hard AI repeat no-op actions indefinitely.
							const finalActor = sim.finalState.find(snapshot => snapshot.id === aiActor.getId());
							const actorStart = aiActor.getPos();
							if (finalActor) {
								const actorMotion = Math.hypot(finalActor.position.x - actorStart.x, finalActor.position.y - actorStart.y);
								// Reward bounded movement, while strongly preferring survival.
								score += Math.min(actorMotion, 100) * 0.1;
								if (!finalActor.isPhysicsEnabled || !finalActor.isDrawingEnabled) score -= 10000;
							}
							// Keep direct enemy approaches ahead of equally safe wandering shots.
							if (candidate.aimedAtEnemy) score += 10;
							const initialNearestEnemy = Math.min(...enemyActors.map(enemy => distanceBetween(actorStart, enemy.getPos())));
							const finalEnemyPositions = sim.finalState.filter(snapshot => !snapshot.team.includes(aiSettings.team) && snapshot.isPhysicsEnabled && snapshot.isDrawingEnabled);
							if (finalEnemyPositions.length > 0) {
								const finalNearestEnemy = Math.min(...finalEnemyPositions.map(enemy => distanceBetween(finalActor?.position ?? actorStart, enemy.position)));
								// Closing on an enemy is useful even when no collision occurred.
								score += (initialNearestEnemy - finalNearestEnemy) * 2;
							}
							for (const pSnapshot of sim.finalState) {
								if (!pSnapshot.isPhysicsEnabled || !pSnapshot.isDrawingEnabled) {
									if (pSnapshot.team.includes(aiSettings.team)) score -= 10000;
									else score += 5000;
								}
							}
						} catch {
							score = -20000;
						}
						simulatedScores.set(simulationKey, score);
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

	private chooseItem(handler: GameHandler, aiActors: IEntity[], enemyActors: IEntity[], random: SeededRandom): AiDecision | undefined {
		const items = handler.getSettings()?.items ?? [];
		const choices: ScoredItemChoice[] = [];
		for (const actor of aiActors) {
			for (const inventory of actor.getInventory().filter(entry => entry.remainingUses > 0)) {
				const item = items.find(candidate => candidate.id === inventory.itemId);
				if (!item) continue;
				for (const target of itemTargets(item, actor, enemyActors, handler.getEntityManager().getEntities())) {
					try {
						validateItemTarget(item, target, { actor, entities: handler.getEntityManager().getEntities(), worldSize: handler.getContext().worldSize });
					} catch { continue; }
					choices.push({ actorId: actor.getId(), itemId: item.id, target, score: scoreItem(item, target, actor, enemyActors) });
				}
			}
		}
		if (choices.length === 0) return undefined;
		const bestScore = Math.max(...choices.map(choice => choice.score));
		if (bestScore < 2 || random.nextInt(100) >= 65) return undefined;
		const best = choices.filter(choice => choice.score === bestScore);
		const choice = best[random.nextInt(best.length)]!;
		return { itemUse: { actorId: choice.actorId, itemId: choice.itemId, target: choice.target } };
	}
}

function itemTargets(item: ItemDocument, actor: IEntity, enemies: IEntity[], entities: IEntity[]): ItemTarget[] {
	if (item.targetType === "self") return [{ type: "self" }];
	if (item.targetType === "entity") {
		return [...entities].sort((left, right) => distance(actor, left) - distance(actor, right)).map(entity => ({ type: "entity", entityId: entity.getId() }));
	}
	if (item.targetType === "position") {
		const target = enemies.slice().sort((left, right) => distance(actor, left) - distance(actor, right))[0];
		return target ? [{ type: "position", position: target.getPos() }] : [];
	}
	return [];
}

function scoreItem(item: ItemDocument, target: ItemTarget, actor: IEntity, enemies: IEntity[]): number {
	const baseScores: Record<string, number> = {
		anker: 2, durchlaessigkeit: 2, magnet: 4, falltuer: 3, "power-dash": 3,
		"verzoegerte-mine": 3, "mini-wall": 2, "freeze-shot": 4, switch: 2,
		"jaegermeister-elixier": 3, "vodka-zero": 2,
	};
	let score = baseScores[item.id] ?? 1;
	if (target.type === "entity" && enemies.some(enemy => enemy.getId() === target.entityId)) score += 1;
	if (target.type === "position") score += 1;
	if (item.targetType === "self" && enemies.length > 0) score += Math.max(0, 1 - distance(actor, enemies[0]!) / 800);
	return score;
}

function distanceBetween(first: { x: number; y: number }, second: { x: number; y: number }): number {
	return Math.hypot(first.x - second.x, first.y - second.y);
}

function distance(first: { getPos(): { x: number; y: number } }, second: { getPos(): { x: number; y: number } }): number {
	const a = first.getPos(); const b = second.getPos();
	return Math.hypot(a.x - b.x, a.y - b.y);
}
