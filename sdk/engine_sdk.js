function assertJsonValue(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number") {
    if (Number.isFinite(value))
      return;
    throw new Error("System settings must contain finite JSON numbers");
  }
  if (Array.isArray(value)) {
    value.forEach(assertJsonValue);
    return;
  }
  if (typeof value === "object") {
    for (const child of Object.values(value))
      assertJsonValue(child);
    return;
  }
  throw new Error("System settings must contain JSON data only");
}

class EngineSystemRegistry {
  definitions = new Map;
  register(definition) {
    validateDefinition(definition);
    if (this.definitions.has(definition.id))
      throw new Error(`Duplicate system definition '${definition.id}'`);
    this.definitions.set(definition.id, clone(definition));
    return this;
  }
  select(ids) {
    const selected = new Set;
    const add = (id) => {
      if (selected.has(id))
        return;
      const definition = this.definitions.get(id);
      if (!definition)
        throw new Error(`Unknown system '${id}'`);
      selected.add(id);
      for (const capability of definition.requires ?? []) {
        const providers = [...this.definitions.values()].filter((candidate) => provides(candidate, capability));
        const active = providers.filter((candidate) => selected.has(candidate.id));
        if (active.length === 1)
          continue;
        if (active.length > 1 || providers.length !== 1)
          throw new Error(`System '${id}' requires exactly one provider for '${capability}'`);
        add(providers[0].id);
      }
    };
    ids.forEach(add);
    validateReplacements([...selected].map((id) => this.definitions.get(id)));
    const order = topologicalOrder([...selected].map((id) => this.definitions.get(id)));
    return {
      schemaVersion: 1,
      systems: order.map((definition) => ({ systemId: definition.id, schemaVersion: definition.schemaVersion ?? 1, state: clone(definition.state ?? {}) })).sort((a, b) => a.systemId.localeCompare(b.systemId)),
      systemOrder: order.map((definition) => definition.id)
    };
  }
  validate(settings) {
    if (!settings || typeof settings !== "object" || Array.isArray(settings))
      throw new Error("Malformed framework settings");
    const value = settings;
    if (value.schemaVersion !== 1 || !Array.isArray(value.systems) || !Array.isArray(value.systemOrder))
      throw new Error("Malformed framework settings");
    const ids = new Set;
    for (const system of value.systems) {
      if (!system || typeof system.systemId !== "string" || system.schemaVersion !== 1 || !system.state || typeof system.state !== "object" || Array.isArray(system.state))
        throw new Error("Malformed system settings");
      if (!this.definitions.has(system.systemId) || ids.has(system.systemId))
        throw new Error(`Unknown or duplicate system '${system.systemId}'`);
      assertJsonValue(system.state);
      ids.add(system.systemId);
    }
    if (value.systemOrder.length !== ids.size || new Set(value.systemOrder).size !== ids.size || value.systemOrder.some((id) => !ids.has(id)))
      throw new Error("Invalid framework system order");
    const expected = this.select(value.systemOrder).systemOrder;
    if (expected.join("|") !== value.systemOrder.join("|"))
      throw new Error("Framework system order violates dependencies");
  }
  validateEffectSupport(settings, effects, catalog) {
    this.validate(settings);
    const selected = new Set(settings.systemOrder);
    const definitions = [...selected].map((id) => this.definitions.get(id));
    for (const effect of effects) {
      catalog.validate(effect);
      const typed = effect;
      const definition = catalog.get(typed.type);
      const accepted = definitions.some((candidate) => candidate.acceptsEffects?.includes(typed.type) === true);
      if (!accepted)
        throw new Error(`No selected system accepts effect '${typed.type}'`);
      for (const capability of definition.requiresCapability ?? []) {
        if (!definitions.some((candidate) => provides(candidate, capability)))
          throw new Error(`Effect '${typed.type}' requires missing capability '${capability}'`);
      }
    }
  }
}
function validateDefinition(definition) {
  if (!definition || typeof definition.id !== "string" || !/^[a-z0-9.-]{1,80}$/.test(definition.id))
    throw new Error("Invalid system definition ID");
  if (definition.schemaVersion !== undefined && definition.schemaVersion !== 1)
    throw new Error("Unsupported system definition version");
  for (const list of [definition.provides, definition.requires, definition.before, definition.after, definition.replaces]) {
    if (list !== undefined && (!Array.isArray(list) || list.some((value) => typeof value !== "string" || value.length === 0)))
      throw new Error(`Invalid system definition '${definition.id}'`);
  }
  if (definition.acceptsEffects !== undefined && (!Array.isArray(definition.acceptsEffects) || definition.acceptsEffects.some((value) => typeof value !== "string" || value.length === 0)))
    throw new Error(`Invalid accepted Effects for '${definition.id}'`);
  assertJsonValue(definition.state ?? {});
}
function provides(definition, capability) {
  return definition.id === capability || definition.provides?.includes(capability) === true;
}
function validateReplacements(definitions) {
  for (const definition of definitions) {
    for (const capability of definition.replaces ?? []) {
      const conflicts = definitions.filter((candidate) => candidate.id !== definition.id && provides(candidate, capability) && !definition.replaces?.includes(capability) && !(definition.replaces?.includes(candidate.id) || candidate.replaces?.includes(definition.id)));
      if (conflicts.length > 0)
        throw new Error(`System '${definition.id}' conflicts with '${conflicts[0].id}' for '${capability}'`);
    }
  }
  const capabilities = new Set(definitions.flatMap((definition) => [definition.id, ...definition.provides ?? []]));
  for (const capability of capabilities) {
    const providers = definitions.filter((definition) => provides(definition, capability));
    if (providers.length > 1 && !providers.some((definition) => definition.replaces?.includes(capability)))
      throw new Error(`Multiple selected providers for '${capability}'`);
  }
}
function topologicalOrder(definitions) {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const edges = new Map(definitions.map((definition) => [definition.id, new Set]));
  for (const definition of definitions) {
    for (const dependency of definition.after ?? [])
      if (byId.has(dependency))
        edges.get(dependency).add(definition.id);
    for (const dependency of definition.before ?? [])
      if (byId.has(dependency))
        edges.get(definition.id).add(dependency);
    for (const capability of definition.requires ?? []) {
      const provider = definitions.find((candidate) => candidate.id !== definition.id && provides(candidate, capability));
      if (provider)
        edges.get(provider.id).add(definition.id);
    }
  }
  const incoming = new Map(definitions.map((definition) => [definition.id, 0]));
  for (const targets of edges.values())
    for (const target of targets)
      incoming.set(target, incoming.get(target) + 1);
  const available = definitions.filter((definition) => incoming.get(definition.id) === 0).map((definition) => definition.id).sort();
  const result = [];
  while (available.length) {
    const id = available.shift();
    result.push(byId.get(id));
    for (const target of edges.get(id)) {
      incoming.set(target, incoming.get(target) - 1);
      if (incoming.get(target) === 0) {
        available.push(target);
        available.sort();
      }
    }
  }
  if (result.length !== definitions.length)
    throw new Error("System dependencies contain a cycle");
  return result;
}
function clone(value) {
  return structuredClone(value);
}

class EngineWorldBuilder {
  id;
  worldSize;
  entities = [];
  structures = [];
  effects = [];
  background;
  framework;
  constructor(id, worldSize) {
    this.id = id;
    this.worldSize = worldSize;
    if (!id || !isPositiveVector(worldSize))
      throw new Error("A world requires an ID and positive finite worldSize");
  }
  setBackground(background) {
    assertJsonValue(background);
    this.background = clone2(background);
    return this;
  }
  addEntity(entity) {
    assertJsonValue(entity);
    this.entities.push(clone2(entity));
    return this;
  }
  addStructure(structure) {
    assertJsonValue(structure);
    this.structures.push(clone2(structure));
    return this;
  }
  addEffect(effect) {
    assertJsonValue(effect);
    this.effects.push(clone2(effect));
    return this;
  }
  useFramework(framework) {
    this.framework = clone2(framework);
    return this;
  }
  build() {
    return { schemaVersion: 1, id: this.id, worldSize: clone2(this.worldSize), ...this.background === undefined ? {} : { background: clone2(this.background) }, entities: clone2(this.entities), structures: clone2(this.structures), effects: clone2(this.effects), ...this.framework ? { framework: clone2(this.framework) } : {} };
  }
  buildJson(space = 2) {
    return JSON.stringify(this.build(), null, space);
  }
}
function isPositiveVector(value) {
  return Number.isFinite(value.x) && value.x > 0 && Number.isFinite(value.y) && value.y > 0;
}
function clone2(value) {
  return structuredClone(value);
}

class EngineEffectRegistry {
  definitions = new Map;
  register(definition) {
    validateDefinition2(definition);
    if (this.definitions.has(definition.id))
      throw new Error(`Duplicate effect definition '${definition.id}'`);
    this.definitions.set(definition.id, { ...definition, ...definition.requiresCapability ? { requiresCapability: [...definition.requiresCapability] } : {} });
    return this;
  }
  get(id) {
    return this.definitions.get(id);
  }
  validate(effect) {
    if (!effect || typeof effect !== "object" || Array.isArray(effect))
      throw new Error("Malformed effect settings");
    const value = effect;
    if (typeof value.type !== "string" || !this.definitions.has(value.type))
      throw new Error(`Unknown effect '${String(value.type)}'`);
    if (value.schemaVersion !== undefined && value.schemaVersion !== 1)
      throw new Error(`Unsupported effect schema version for '${value.type}'`);
    assertJsonValue(value.typeValue);
    this.definitions.get(value.type).validatePayload?.(value.typeValue);
  }
  describe() {
    return [...this.definitions.values()].sort((a, b) => a.id.localeCompare(b.id)).map((definition) => ({
      id: definition.id,
      schemaVersion: definition.schemaVersion ?? 1,
      ...definition.requiresCapability ? { requiresCapability: [...definition.requiresCapability] } : {},
      ...definition.targetType ? { targetType: definition.targetType } : {},
      ...definition.lifecycleCategory ? { lifecycleCategory: definition.lifecycleCategory } : {}
    }));
  }
}
function validateDefinition2(definition) {
  if (!definition || typeof definition.id !== "string" || !/^[a-z0-9.-]{1,80}$/.test(definition.id))
    throw new Error("Invalid effect definition ID");
  if (definition.schemaVersion !== undefined && definition.schemaVersion !== 1)
    throw new Error("Unsupported effect definition version");
  for (const value of [definition.targetType, definition.lifecycleCategory])
    if (value !== undefined && (typeof value !== "string" || value.length === 0))
      throw new Error(`Invalid effect definition '${definition.id}'`);
  if (definition.requiresCapability !== undefined && (!Array.isArray(definition.requiresCapability) || definition.requiresCapability.some((value) => typeof value !== "string" || value.length === 0)))
    throw new Error(`Invalid effect capabilities for '${definition.id}'`);
  if (definition.validatePayload !== undefined && typeof definition.validatePayload !== "function")
    throw new Error(`Invalid effect validator for '${definition.id}'`);
}

function createTransformState(input) {
  const state = { schemaVersion: 1, position: { ...input.position }, rotation: input.rotation ?? 0 };
  validateTransformState(state);
  return structuredClone(state);
}
function createMovementState(input) {
  const state = { schemaVersion: 1, velocity: { ...input.velocity }, angularVelocity: input.angularVelocity ?? 0, enabled: input.enabled ?? true };
  validateMovementState(state);
  return structuredClone(state);
}
function validateTransformState(value) {
  const state = record(value, "Transform state");
  exactKeys(state, ["schemaVersion", "position", "rotation"], "Transform state");
  if (state.schemaVersion !== 1)
    throw new Error("Unsupported Transform state schema version");
  validateVector(state.position, "Transform position");
  finite(state.rotation, "Transform rotation");
}
function validateMovementState(value) {
  const state = record(value, "Movement state");
  exactKeys(state, ["schemaVersion", "velocity", "angularVelocity", "enabled"], "Movement state");
  if (state.schemaVersion !== 1)
    throw new Error("Unsupported Movement state schema version");
  validateVector(state.velocity, "Movement velocity");
  finite(state.angularVelocity, "Movement angularVelocity");
  if (typeof state.enabled !== "boolean")
    throw new Error("Movement enabled must be boolean");
}
function validateVector(value, label) {
  const vector = record(value, label);
  exactKeys(vector, ["x", "y"], label);
  finite(vector.x, `${label} x`);
  finite(vector.y, `${label} y`);
}
function record(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}
function exactKeys(value, keys, label) {
  const allowed = new Set(keys);
  for (const key of Object.keys(value))
    if (!allowed.has(key))
      throw new Error(`${label} contains unknown field '${key}'`);
  for (const key of keys)
    if (!(key in value))
      throw new Error(`${label} is missing '${key}'`);
}
function finite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${label} must be finite`);
}

var MOVEMENT_CAPABILITY = "movement.state";
var MOVEMENT_EFFECT_ID = "movement.integrate";
function registerMovementEffect(registry) {
  return registry.register({
    id: MOVEMENT_EFFECT_ID,
    requiresCapability: [MOVEMENT_CAPABILITY],
    targetType: "entity",
    lifecycleCategory: "modifier",
    validatePayload: (payload) => {
      if (!payload || typeof payload !== "object" || Array.isArray(payload))
        throw new Error("Movement payload must be an object");
      const value = payload;
      if (Object.keys(value).some((key) => !["deltaTime", "x", "y"].includes(key)) || Object.keys(value).length !== 3)
        throw new Error("Movement payload contains unexpected fields");
      for (const key of ["deltaTime", "x", "y"])
        if (typeof value[key] !== "number" || !Number.isFinite(value[key]))
          throw new Error(`Movement ${key} must be finite`);
    }
  });
}
function createTickTriggerEvent(input) {
  const event = { schemaVersion: 1, type: "tick", sourceId: input.sourceId, sequence: input.sequence, payload: { dt: input.dt } };
  validateTriggerEvent(event);
  return structuredClone(event);
}
function createCollisionEnterTriggerEvent(input) {
  const event = {
    schemaVersion: 1,
    type: "collision.enter",
    sourceId: input.sourceId,
    sequence: input.sequence,
    payload: { entityId: input.entityId, otherId: input.otherId, contactKey: input.contactKey }
  };
  validateTriggerEvent(event);
  return structuredClone(event);
}
function validateTriggerEvent(value) {
  const event = record2(value, "Trigger event");
  exactKeys2(event, ["schemaVersion", "type", "sourceId", "sequence", "payload"], "Trigger event");
  if (event.schemaVersion !== 1)
    throw new Error("Unsupported Trigger event schema version");
  string(event.sourceId, "Trigger event sourceId");
  safeSequence(event.sequence, "Trigger event sequence");
  if (event.type === "tick") {
    const payload = record2(event.payload, "Tick trigger payload");
    exactKeys2(payload, ["dt"], "Tick trigger payload");
    finiteNonNegative(payload.dt, "Tick trigger dt");
    return;
  }
  if (event.type === "collision.enter") {
    const payload = record2(event.payload, "Collision trigger payload");
    exactKeys2(payload, ["entityId", "otherId", "contactKey"], "Collision trigger payload");
    string(payload.entityId, "Collision trigger entityId");
    string(payload.otherId, "Collision trigger otherId");
    string(payload.contactKey, "Collision trigger contactKey");
    return;
  }
  throw new Error(`Unknown Trigger event type '${String(event.type)}'`);
}
function record2(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}
function exactKeys2(value, keys, label) {
  const allowed = new Set(keys);
  for (const key of Object.keys(value))
    if (!allowed.has(key))
      throw new Error(`${label} contains unknown field '${key}'`);
  for (const key of keys)
    if (!(key in value))
      throw new Error(`${label} is missing '${key}'`);
}
function string(value, label) {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${label} must be a non-empty string`);
}
function safeSequence(value, label) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${label} must be a non-negative safe integer`);
}
function finiteNonNegative(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error(`${label} must be a finite non-negative number`);
}

var engine = {
  createWorld(options) {
    return new EngineWorldBuilder(options.id, options.worldSize);
  },
  createSystemRegistry() {
    return new EngineSystemRegistry;
  },
  createEffectRegistry() {
    return new EngineEffectRegistry;
  },
  createTransformState,
  createMovementState,
  createEntity(settings) {
    assertJsonValue(settings);
    return structuredClone(settings);
  },
  createStructure(settings) {
    assertJsonValue(settings);
    return structuredClone(settings);
  },
  createEffect(settings) {
    assertJsonValue(settings);
    return structuredClone(settings);
  },
  validate(value) {
    assertJsonValue(value);
  },
  buildJson(settings, space = 2) {
    return JSON.stringify(settings, null, space);
  }
};
export {
  validateTriggerEvent,
  validateTransformState,
  validateMovementState,
  registerMovementEffect,
  engine,
  createTransformState,
  createTickTriggerEvent,
  createMovementState,
  createCollisionEnterTriggerEvent,
  MOVEMENT_EFFECT_ID,
  MOVEMENT_CAPABILITY,
  EngineWorldBuilder,
  EngineSystemRegistry,
  EngineEffectRegistry
};
