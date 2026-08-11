import type { GameHandler } from "../kore/runtime/Handler.js";
import { SeededRandom } from "../utils/random.js";
import type { AiDecision, IAiTurnProducer } from "./aiEmitter.js";
import type { AiSettings } from "./types.js";

export class EasyAi implements IAiTurnProducer {
	public computeTurn(handler: GameHandler, aiSettings: AiSettings): AiDecision | undefined {
		const aiActors = handler
			.getEntityManager()
			.getEntities()
			.filter((e) => !e.isDead() && e.getTeam().includes(aiSettings.team) && handler.isActorEligibleForAction(e.getId()));

		if (aiActors.length === 0) return undefined;

		const random = new SeededRandom(aiSettings.seed + handler.getTurnNumber() * 31);
		const actorIndex = random.nextInt(aiActors.length);
		const actor = aiActors[actorIndex]!;

		const angle = random.nextInt(360);
		// Power between 1 and 10
		const power = 1 + random.nextInt(10);

		return {
			shot: {
				actorId: actor.getId(),
				angle,
				power,
			},
		};
	}
}
