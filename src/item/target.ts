import type { IEntity } from "../entity/Entity.js";
import type { Vector2D } from "@coffeemakerstudio/bean";
import type { ItemDocument, ItemTargetValidation } from "./types.js";
import { createEntityResolvedTarget, createPositionResolvedTarget, type ResolvedEffectTarget } from "./resolvedTarget.js";

export type ItemTarget =
	| { type: "self" }
	| { type: "entity"; entityId: string }
	| { type: "position"; position: Vector2D }
	| { type: "zone"; center: Vector2D; radius: number };

export interface ItemTargetContext {
	actor: IEntity;
	entities: readonly IEntity[];
	worldSize: Vector2D;
}

const ALLOW_ALL_TARGETS: ItemTargetValidation = {
	allowSelf: true,
	allowAlly: true,
	allowEnemy: true,
};

/** Validates an item target without mutating the entity or game state. */
export function validateItemTarget(
	item: ItemDocument,
	target: unknown,
	context: ItemTargetContext,
): asserts target is ItemTarget {
	const validation = item.targetValidation ?? ALLOW_ALL_TARGETS;
	if (!isRecord(target) || typeof target.type !== "string") {
		throw new Error("Item target must be an object with a valid type");
	}
	if (target.type !== item.targetType) {
		throw new Error(`Item requires a ${item.targetType} target`);
	}

	switch (target.type) {
		case "self":
			if (!validation.allowSelf) throw new Error("Item does not allow self targets");
			return;
		case "entity":
			validateEntityTarget(target, validation, context);
			return;
		case "position":
			validatePositionTarget(target.position, validation.maxRange, context);
			return;
		case "zone":
			validateZoneTarget(target, validation.maxRange, context);
			return;
		default:
			throw new Error("Item target has an unsupported type");
	}
}

/** Resolves an already validated item target into detached scheduled-effect data. */
export function resolveEffectTarget(target: ItemTarget, context: Pick<ItemTargetContext, "actor">): ResolvedEffectTarget {
	switch (target.type) {
		case "self": return createEntityResolvedTarget(String(context.actor.getId()));
		case "entity": return createEntityResolvedTarget(target.entityId);
		case "position": return createPositionResolvedTarget(target.position);
		case "zone": throw new Error("Delayed Effects do not support zone targets without a stable zone contract");
	}
}

function validateEntityTarget(
	target: { entityId?: unknown },
	validation: ItemTargetValidation,
	context: ItemTargetContext,
): void {
	if (typeof target.entityId !== "string" || target.entityId.length === 0) {
		throw new Error("Entity targets require a non-empty entityId");
	}
	const entity = context.entities.find(candidate => candidate.getId() === target.entityId);
	if (!entity || entity.isDead()) throw new Error("Entity target must be an active entity");
	if (entity === context.actor || entity.getId() === context.actor.getId()) {
		if (!validation.allowSelf) throw new Error("Item does not allow self targets");
	} else if (sharesTeam(context.actor, entity)) {
		if (!validation.allowAlly) throw new Error("Item does not allow ally targets");
	} else if (!validation.allowEnemy) {
		throw new Error("Item does not allow enemy targets");
	}
	validateRange(context.actor.getPos(), entity.getPos(), validation.maxRange);
}

function validatePositionTarget(position: unknown, maxRange: number | undefined, context: ItemTargetContext): void {
	if (!isVector(position)) throw new Error("Position targets require finite x and y coordinates");
	validateWorldPosition(position, context.worldSize);
	validateRange(context.actor.getPos(), position, maxRange);
}

function validateZoneTarget(
	target: { center?: unknown; radius?: unknown },
	maxRange: number | undefined,
	context: ItemTargetContext,
): void {
	if (!isVector(target.center) || typeof target.radius !== "number" || !Number.isFinite(target.radius) || target.radius <= 0) {
		throw new Error("Zone targets require a finite center and positive radius");
	}
	validateWorldPosition(target.center, context.worldSize);
	if (target.center.x - target.radius < 0 || target.center.y - target.radius < 0 ||
		target.center.x + target.radius > context.worldSize.x || target.center.y + target.radius > context.worldSize.y) {
		throw new Error("Zone target must be contained within the world");
	}
	validateRange(context.actor.getPos(), target.center, maxRange);
}

function validateRange(origin: Vector2D, target: Vector2D, maxRange: number | undefined): void {
	if (maxRange !== undefined && Math.hypot(origin.x - target.x, origin.y - target.y) > maxRange) {
		throw new Error("Item target is outside the maximum range");
	}
}

function validateWorldPosition(position: Vector2D, worldSize: Vector2D): void {
	if (position.x < 0 || position.y < 0 || position.x > worldSize.x || position.y > worldSize.y) {
		throw new Error("Item target must be inside the world");
	}
}

function sharesTeam(first: IEntity, second: IEntity): boolean {
	return first.getTeam().some(team => second.getTeam().includes(team));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isVector(value: unknown): value is Vector2D {
	return isRecord(value) && typeof value.x === "number" && Number.isFinite(value.x) &&
		typeof value.y === "number" && Number.isFinite(value.y);
}
