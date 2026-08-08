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

var COUNTER_SCHEMA_VERSION = 1;
function createCounterState(input) {
  const state = {
    schemaVersion: COUNTER_SCHEMA_VERSION,
    id: input.id,
    value: input.value ?? 0
  };
  validateCounterState(state);
  return state;
}
function validateCounterState(value) {
  if (!isRecord(value) || Object.keys(value).some((key) => !["schemaVersion", "id", "value"].includes(key)) || Object.keys(value).length !== 3) {
    throw new Error("Malformed counter state");
  }
  if (value.schemaVersion !== COUNTER_SCHEMA_VERSION)
    throw new Error("Unsupported counter state schema version");
  if (typeof value.id !== "string" || value.id.length === 0)
    throw new Error("Counter state requires a non-empty id");
  if (typeof value.value !== "number" || !Number.isFinite(value.value))
    throw new Error("Counter state value must be finite");
}
function canonicalizeCounterStates(value) {
  if (!Array.isArray(value))
    throw new Error("Counter states must be an array");
  const counters = value.map((counter) => {
    validateCounterState(counter);
    return { ...counter };
  });
  if (new Set(counters.map((counter) => counter.id)).size !== counters.length)
    throw new Error("Counter state IDs must be unique");
  return counters.sort((a, b) => a.id.localeCompare(b.id));
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class EngineWorldBuilder {
  id;
  worldSize;
  entities = [];
  structures = [];
  effects = [];
  counters = [];
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
  addCounter(counter) {
    this.counters.push(...canonicalizeCounterStates([counter]));
    return this;
  }
  useFramework(framework) {
    this.framework = clone2(framework);
    return this;
  }
  build() {
    return { schemaVersion: 1, id: this.id, worldSize: clone2(this.worldSize), ...this.background === undefined ? {} : { background: clone2(this.background) }, entities: clone2(this.entities), structures: clone2(this.structures), effects: clone2(this.effects), counters: canonicalizeCounterStates(this.counters), ...this.framework ? { framework: clone2(this.framework) } : {} };
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
    if (value.target !== undefined)
      assertJsonValue(value.target);
    if (value.target !== undefined)
      this.definitions.get(value.type).validateTarget?.(value.target);
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
  if (definition.validateTarget !== undefined && typeof definition.validateTarget !== "function")
    throw new Error(`Invalid effect target validator for '${definition.id}'`);
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
var MOVEMENT_SET_VELOCITY_EFFECT_ID = "movement.set-velocity";
var MOVEMENT_ADD_VELOCITY_EFFECT_ID = "movement.add-velocity";
var MOVEMENT_SCALE_SPEED_EFFECT_ID = "movement.scale-speed";
var MOVEMENT_COMMAND_EFFECT_IDS = [MOVEMENT_SET_VELOCITY_EFFECT_ID, MOVEMENT_ADD_VELOCITY_EFFECT_ID, MOVEMENT_SCALE_SPEED_EFFECT_ID];
function movementSystemDefinition() {
  return { id: "core.movement", provides: [MOVEMENT_CAPABILITY], acceptsEffects: [...MOVEMENT_COMMAND_EFFECT_IDS], before: ["core.playback"] };
}
function registerMovementSystem(registry) {
  return registry.register(movementSystemDefinition());
}
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
function registerMovementCommands(registry) {
  return registry.register({
    id: MOVEMENT_SET_VELOCITY_EFFECT_ID,
    requiresCapability: [MOVEMENT_CAPABILITY],
    targetType: "entity",
    lifecycleCategory: "command",
    validatePayload: (payload) => validateVectorPayload(payload, "Movement velocity")
  }).register({
    id: MOVEMENT_ADD_VELOCITY_EFFECT_ID,
    requiresCapability: [MOVEMENT_CAPABILITY],
    targetType: "entity",
    lifecycleCategory: "command",
    validatePayload: (payload) => validateVectorPayload(payload, "Movement velocity delta")
  }).register({
    id: MOVEMENT_SCALE_SPEED_EFFECT_ID,
    requiresCapability: [MOVEMENT_CAPABILITY],
    targetType: "entity",
    lifecycleCategory: "command",
    validatePayload: (payload) => {
      const value = record2(payload, "Movement speed scale payload");
      exactKeys2(value, ["factor"], "Movement speed scale payload");
      if (typeof value.factor !== "number" || !Number.isFinite(value.factor) || value.factor < 0)
        throw new Error("Movement speed scale factor must be finite and non-negative");
    }
  });
}
function validateVectorPayload(payload, label) {
  const value = record2(payload, `${label} payload`);
  exactKeys2(value, ["x", "y"], `${label} payload`);
  for (const key of ["x", "y"])
    if (typeof value[key] !== "number" || !Number.isFinite(value[key]))
      throw new Error(`${label} ${key} must be finite`);
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
      throw new Error(`${label} contains unexpected fields`);
  for (const key of keys)
    if (!(key in value))
      throw new Error(`${label} is missing '${key}'`);
}
var TRANSFORM_CAPABILITY = "transform.state";
var TRANSFORM_SET_POSITION_EFFECT_ID = "transform.set-position";
var TRANSFORM_SET_ROTATION_EFFECT_ID = "transform.set-rotation";
function registerTransformEffects(registry) {
  return registry.register({
    id: TRANSFORM_SET_POSITION_EFFECT_ID,
    requiresCapability: [TRANSFORM_CAPABILITY],
    targetType: "entity-or-structure",
    lifecycleCategory: "command",
    validatePayload: (payload) => validateVectorPayload2(payload, "Transform position"),
    validateTarget: (target) => validateTransformTarget(target, true)
  }).register({
    id: TRANSFORM_SET_ROTATION_EFFECT_ID,
    requiresCapability: [TRANSFORM_CAPABILITY],
    targetType: "entity",
    lifecycleCategory: "command",
    validatePayload: (payload) => {
      const value = record3(payload, "Transform rotation payload");
      exactKeys3(value, ["rotation"], "Transform rotation payload");
      finite2(value.rotation, "Transform rotation");
    },
    validateTarget: (target) => validateTransformTarget(target, false)
  });
}
function validateTransformTarget(value, allowStructure = true) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Transform target must be an object");
  const target = value;
  if (target.type === "entity") {
    exactKeys3(target, ["type", "entityId"], "Transform entity target");
    if (typeof target.entityId !== "string" || target.entityId.length === 0)
      throw new Error("Transform target requires a non-empty entityId");
    return;
  }
  if (allowStructure && target.type === "structure") {
    exactKeys3(target, ["type", "structureId"], "Transform structure target");
    if (typeof target.structureId !== "string" || target.structureId.length === 0)
      throw new Error("Transform target requires a non-empty structureId");
    return;
  }
  throw new Error("Transform target type is unsupported");
}
function validateVectorPayload2(payload, label) {
  const value = record3(payload, `${label} payload`);
  exactKeys3(value, ["x", "y"], `${label} payload`);
  finite2(value.x, `${label} x`);
  finite2(value.y, `${label} y`);
}
function record3(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}
function exactKeys3(value, keys, label) {
  const allowed = new Set(keys);
  for (const key of Object.keys(value))
    if (!allowed.has(key))
      throw new Error(`${label} contains unexpected fields`);
  for (const key of keys)
    if (!(key in value))
      throw new Error(`${label} is missing '${key}'`);
}
function finite2(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${label} must be finite`);
}
class EngineTriggerActivationQueue {
  maxActivations;
  pending = [];
  processed = 0;
  constructor(maxActivations = 1024) {
    this.maxActivations = maxActivations;
    if (!Number.isSafeInteger(maxActivations) || maxActivations < 1)
      throw new Error("Trigger activation budget must be a positive safe integer");
  }
  enqueue(activation) {
    validateTriggerActivation(activation);
    this.enqueueValidated(activation);
  }
  enqueueValidated(activation) {
    if (this.pending.length + this.processed >= this.maxActivations)
      throw new Error("Trigger activation budget exceeded");
    this.pending.push(activation);
  }
  process(dispatch) {
    if (typeof dispatch !== "function")
      throw new Error("Trigger dispatcher must be a function");
    let processedNow = 0;
    while (this.pending.length > 0) {
      const activation = this.pending.shift();
      this.processed++;
      processedNow++;
      dispatch(structuredClone(activation));
    }
    return processedNow;
  }
  pendingCount() {
    return this.pending.length;
  }
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
function createTriggerActivation(input) {
  const activation = { schemaVersion: 1, effectId: input.effectId, event: structuredClone(input.event) };
  validateTriggerActivation(activation);
  return structuredClone(activation);
}
function createRoundStartTriggerEvent(input) {
  const event = {
    schemaVersion: 1,
    type: "round.start",
    sourceId: input.sourceId,
    sequence: input.sequence,
    payload: { turnNumber: input.turnNumber, activeTeam: input.activeTeam, phase: input.phase }
  };
  validateTriggerEvent(event);
  return structuredClone(event);
}
function createEnvironmentActivationTriggerEvent(input) {
  const event = {
    schemaVersion: 1,
    type: "environment.activation",
    sourceId: input.sourceId,
    sequence: input.sequence,
    payload: { mechanicId: input.mechanicId, mechanicIndex: input.mechanicIndex, tick: input.tick, active: input.active }
  };
  validateTriggerEvent(event);
  return structuredClone(event);
}
function createScheduleDueTriggerEvent(input) {
  const event = { schemaVersion: 1, type: "schedule.due", sourceId: input.sourceId, sequence: input.sequence, payload: { scheduleId: input.scheduleId, clock: input.clock, value: input.value } };
  validateTriggerEvent(event);
  return structuredClone(event);
}
function validateTriggerActivation(value) {
  const activation = record4(value, "Trigger activation");
  exactKeys4(activation, ["schemaVersion", "effectId", "event"], "Trigger activation");
  if (activation.schemaVersion !== 1)
    throw new Error("Unsupported Trigger activation schema version");
  string(activation.effectId, "Trigger activation effectId");
  validateTriggerEvent(activation.event);
}
function validateTriggerEvent(value) {
  const event = record4(value, "Trigger event");
  exactKeys4(event, ["schemaVersion", "type", "sourceId", "sequence", "payload"], "Trigger event");
  if (event.schemaVersion !== 1)
    throw new Error("Unsupported Trigger event schema version");
  string(event.sourceId, "Trigger event sourceId");
  safeSequence(event.sequence, "Trigger event sequence");
  if (event.type === "tick") {
    const payload = record4(event.payload, "Tick trigger payload");
    exactKeys4(payload, ["dt"], "Tick trigger payload");
    finiteNonNegative(payload.dt, "Tick trigger dt");
    return;
  }
  if (event.type === "collision.enter") {
    const payload = record4(event.payload, "Collision trigger payload");
    exactKeys4(payload, ["entityId", "otherId", "contactKey"], "Collision trigger payload");
    string(payload.entityId, "Collision trigger entityId");
    string(payload.otherId, "Collision trigger otherId");
    string(payload.contactKey, "Collision trigger contactKey");
    return;
  }
  if (event.type === "round.start") {
    const payload = record4(event.payload, "Round trigger payload");
    exactKeys4(payload, ["turnNumber", "activeTeam", "phase"], "Round trigger payload");
    safeSequence(payload.turnNumber, "Round trigger turnNumber");
    safeSequence(payload.activeTeam, "Round trigger activeTeam");
    string(payload.phase, "Round trigger phase");
    return;
  }
  if (event.type === "environment.activation") {
    const payload = record4(event.payload, "Environment activation payload");
    exactKeys4(payload, ["mechanicId", "mechanicIndex", "tick", "active"], "Environment activation payload");
    string(payload.mechanicId, "Environment activation mechanicId");
    safeSequence(payload.mechanicIndex, "Environment activation mechanicIndex");
    safeSequence(payload.tick, "Environment activation tick");
    if (typeof payload.active !== "boolean")
      throw new Error("Environment activation active must be boolean");
    return;
  }
  if (event.type === "schedule.due") {
    const payload = record4(event.payload, "Schedule due payload");
    exactKeys4(payload, ["scheduleId", "clock", "value"], "Schedule due payload");
    string(payload.scheduleId, "Schedule due scheduleId");
    if (payload.clock !== "tick" && payload.clock !== "turn")
      throw new Error("Schedule due clock must be tick or turn");
    safeSequence(payload.value, "Schedule due value");
    return;
  }
  throw new Error(`Unknown Trigger event type '${String(event.type)}'`);
}
function record4(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}
function exactKeys4(value, keys, label) {
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

var COUNTER_CAPABILITY = "counter.state";
var COUNTER_SET_EFFECT_ID = "counter.set";
var COUNTER_ADD_EFFECT_ID = "counter.add";
var COUNTER_RESET_EFFECT_ID = "counter.reset";
var COUNTER_EFFECT_IDS = [COUNTER_SET_EFFECT_ID, COUNTER_ADD_EFFECT_ID, COUNTER_RESET_EFFECT_ID];
function counterSystemDefinition() {
  return { id: "core.counter", provides: [COUNTER_CAPABILITY], acceptsEffects: [...COUNTER_EFFECT_IDS] };
}
function registerCounterSystem(registry) {
  return registry.register(counterSystemDefinition());
}
function registerCounterCommands(registry) {
  return registry.register({ id: COUNTER_SET_EFFECT_ID, requiresCapability: [COUNTER_CAPABILITY], targetType: "counter", lifecycleCategory: "command", validatePayload: (payload) => validateNumericPayload(payload, "Counter set", "value"), validateTarget: validateCounterTargetValue }).register({ id: COUNTER_ADD_EFFECT_ID, requiresCapability: [COUNTER_CAPABILITY], targetType: "counter", lifecycleCategory: "command", validatePayload: (payload) => validateNumericPayload(payload, "Counter add", "amount"), validateTarget: validateCounterTargetValue }).register({ id: COUNTER_RESET_EFFECT_ID, requiresCapability: [COUNTER_CAPABILITY], targetType: "counter", lifecycleCategory: "command", validatePayload: (payload) => exactKeys5(record5(payload, "Counter reset payload"), [], "Counter reset payload"), validateTarget: validateCounterTargetValue });
}
function validateCounterEffectSettings(value) {
  const effect = record5(value, "Counter effect");
  exactKeys5(effect, ["schemaVersion", "type", "target", "typeValue"], "Counter effect");
  if (effect.schemaVersion !== COUNTER_SCHEMA_VERSION)
    throw new Error("Unsupported counter effect schema version");
  validateCounterTargetValue(effect.target);
  if (effect.type === COUNTER_SET_EFFECT_ID)
    validateNumericPayload(effect.typeValue, "Counter set", "value");
  else if (effect.type === COUNTER_ADD_EFFECT_ID)
    validateNumericPayload(effect.typeValue, "Counter add", "amount");
  else if (effect.type === COUNTER_RESET_EFFECT_ID)
    exactKeys5(record5(effect.typeValue, "Counter reset payload"), [], "Counter reset payload");
  else
    throw new Error(`Unknown counter effect '${String(effect.type)}'`);
}
function validateCounterTarget(target) {
  validateCounterTargetValue(target);
}
function validateCounterTriggerBinding(value) {
  const binding = record5(value, "Counter trigger binding");
  if (typeof binding.trigger !== "string" || !["tick", "collision.enter", "round.start", "environment.activation", "schedule.due"].includes(binding.trigger))
    throw new Error("Counter trigger binding has an unknown trigger");
  validateCounterEffectSettings(binding.effect);
}
function counterTriggerMatches(binding, event) {
  validateCounterTriggerBinding(binding);
  validateTriggerEvent(event);
  return binding.trigger === event.type;
}
function validateCounterTargetValue(target) {
  const value = record5(target, "Counter target");
  exactKeys5(value, ["type", "counterId"], "Counter target");
  if (value.type !== "counter")
    throw new Error("Counter target type must be 'counter'");
  if (typeof value.counterId !== "string" || value.counterId.length === 0)
    throw new Error("Counter target requires a non-empty counterId");
}
function validateNumericPayload(payload, label, key) {
  const value = record5(payload, `${label} payload`);
  exactKeys5(value, [key], `${label} payload`);
  if (typeof value[key] !== "number" || !Number.isFinite(value[key]))
    throw new Error(`${label} ${key} must be finite`);
}
function record5(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}
function exactKeys5(value, keys, label) {
  const allowed = new Set(keys);
  for (const key of Object.keys(value))
    if (!allowed.has(key))
      throw new Error(`${label} contains unexpected fields`);
  for (const key of keys)
    if (!(key in value))
      throw new Error(`${label} is missing '${key}'`);
}
var PARTICIPATION_CAPABILITY = "participation.state";
var PARTICIPATION_SET_PHYSICS_EFFECT_ID = "participation.set-physics";
var PARTICIPATION_SET_DRAWING_EFFECT_ID = "participation.set-drawing";
var PARTICIPATION_EFFECT_IDS = [PARTICIPATION_SET_PHYSICS_EFFECT_ID, PARTICIPATION_SET_DRAWING_EFFECT_ID];
function participationSystemDefinition() {
  return { id: "core.participation", provides: [PARTICIPATION_CAPABILITY], acceptsEffects: [...PARTICIPATION_EFFECT_IDS] };
}
function registerParticipationSystem(registry) {
  return registry.register(participationSystemDefinition());
}
function registerParticipationCommands(registry) {
  return registry.register({ id: PARTICIPATION_SET_PHYSICS_EFFECT_ID, requiresCapability: [PARTICIPATION_CAPABILITY], targetType: "entity-or-structure", lifecycleCategory: "command", validatePayload: validateParticipationPayload }).register({ id: PARTICIPATION_SET_DRAWING_EFFECT_ID, requiresCapability: [PARTICIPATION_CAPABILITY], targetType: "entity-or-structure", lifecycleCategory: "command", validatePayload: validateParticipationPayload });
}
function validateParticipationPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Participation payload must be an object");
  const value = payload;
  if (Object.keys(value).length !== 1 || typeof value.enabled !== "boolean")
    throw new Error("Participation payload requires only boolean enabled");
}
var NUMERIC_CAPABILITY = "numeric.state";
var NUMERIC_SET_EFFECT_ID = "numeric.set";
var NUMERIC_ADD_EFFECT_ID = "numeric.add";
var NUMERIC_RESET_EFFECT_ID = "numeric.reset";
var NUMERIC_EFFECT_IDS = [NUMERIC_SET_EFFECT_ID, NUMERIC_ADD_EFFECT_ID, NUMERIC_RESET_EFFECT_ID];
function numericSystemDefinition() {
  return { id: "core.numeric", provides: [NUMERIC_CAPABILITY], acceptsEffects: [...NUMERIC_EFFECT_IDS] };
}
function registerNumericSystem(registry) {
  return registry.register(numericSystemDefinition());
}
function registerNumericCommands(registry) {
  return registry.register({ id: NUMERIC_SET_EFFECT_ID, requiresCapability: [NUMERIC_CAPABILITY], targetType: "numeric", lifecycleCategory: "command", validatePayload: (payload) => validateNumericPayload2(payload, "Numeric set", "value"), validateTarget: validateNumericTarget }).register({ id: NUMERIC_ADD_EFFECT_ID, requiresCapability: [NUMERIC_CAPABILITY], targetType: "numeric", lifecycleCategory: "command", validatePayload: (payload) => validateNumericPayload2(payload, "Numeric add", "amount"), validateTarget: validateNumericTarget }).register({ id: NUMERIC_RESET_EFFECT_ID, requiresCapability: [NUMERIC_CAPABILITY], targetType: "numeric", lifecycleCategory: "command", validatePayload: (payload) => {
    exactKeys6(record6(payload, "Numeric reset payload"), [], "Numeric reset payload");
  }, validateTarget: validateNumericTarget });
}
function validateNumericTarget(value) {
  const target = record6(value, "Numeric target");
  exactKeys6(target, ["type", "entityId", "stateId"], "Numeric target");
  if (target.type !== "numeric")
    throw new Error("Numeric target type must be 'numeric'");
  if (typeof target.entityId !== "string" || target.entityId.length === 0)
    throw new Error("Numeric target requires a non-empty entityId");
  if (typeof target.stateId !== "string" || target.stateId.length === 0)
    throw new Error("Numeric target requires a non-empty stateId");
}
function validateNumericEffectSettings(value) {
  const effect = record6(value, "Numeric effect");
  exactKeys6(effect, ["schemaVersion", "type", "target", "typeValue"], "Numeric effect");
  if (effect.schemaVersion !== 1)
    throw new Error("Unsupported numeric effect schema version");
  validateNumericTarget(effect.target);
  if (effect.type === NUMERIC_SET_EFFECT_ID)
    validateNumericPayload2(effect.typeValue, "Numeric set", "value");
  else if (effect.type === NUMERIC_ADD_EFFECT_ID)
    validateNumericPayload2(effect.typeValue, "Numeric add", "amount");
  else if (effect.type === NUMERIC_RESET_EFFECT_ID)
    exactKeys6(record6(effect.typeValue, "Numeric reset payload"), [], "Numeric reset payload");
  else
    throw new Error(`Unknown numeric effect '${String(effect.type)}'`);
}
function validateNumericPayload2(payload, label, key) {
  const value = record6(payload, `${label} payload`);
  exactKeys6(value, [key], `${label} payload`);
  if (typeof value[key] !== "number" || !Number.isFinite(value[key]))
    throw new Error(`${label} ${key} must be finite`);
}
function record6(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}
function exactKeys6(value, keys, label) {
  if (Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key)))
    throw new Error(`${label} contains unexpected fields`);
}
var ENGINE_EFFECT_COMPOSITION_SCHEMA_VERSION = 1;
var ENGINE_EFFECT_COMPOSITION_TYPE = "effect.composition";
function createEngineEffectComposition(effects) {
  const composition = { schemaVersion: 1, type: ENGINE_EFFECT_COMPOSITION_TYPE, effects: structuredClone([...effects]) };
  validateEngineEffectComposition(composition);
  return composition;
}
function validateEngineEffectComposition(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Malformed Engine effect composition");
  const composition = value;
  if (Object.keys(composition).some((key) => !["schemaVersion", "type", "effects"].includes(key)) || Object.keys(composition).length !== 3)
    throw new Error("Malformed Engine effect composition");
  if (composition.schemaVersion !== 1 || composition.type !== ENGINE_EFFECT_COMPOSITION_TYPE || !Array.isArray(composition.effects))
    throw new Error("Unsupported Engine effect composition");
  composition.effects.forEach((effect) => {
    assertJsonValue(effect);
    if (!effect || typeof effect !== "object" || Array.isArray(effect) || typeof effect.type !== "string")
      throw new Error("Composition children must be Engine effects");
  });
}
var COLLISION_COMMAND_SCHEMA_VERSION = 1;
var COLLISION_COMMAND_TYPE = "collision.command";
function createCollisionCommandBinding(effect) {
  const binding = { schemaVersion: 1, type: COLLISION_COMMAND_TYPE, effect: structuredClone(effect) };
  validateCollisionCommandBinding(binding);
  return binding;
}
function validateCollisionCommandBinding(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Malformed collision command binding");
  const binding = value;
  if (Object.keys(binding).some((key) => !["schemaVersion", "type", "effect"].includes(key)) || Object.keys(binding).length !== 3)
    throw new Error("Malformed collision command binding");
  if (binding.schemaVersion !== 1 || binding.type !== COLLISION_COMMAND_TYPE)
    throw new Error("Unsupported collision command binding");
  validateRelativeEffect(binding.effect);
}
function isCollisionCommandBinding(value) {
  try {
    validateCollisionCommandBinding(value);
    return true;
  } catch {
    return false;
  }
}
function validateRelativeEffect(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Collision command effect must be an object");
  const effect = value;
  if (effect.type === "effect.composition") {
    validateEngineEffectComposition(effect);
    for (const child of effect.effects)
      validateRelativeEffect(child);
    return;
  }
  if (typeof effect.type !== "string" || effect.type.length === 0 || effect.schemaVersion !== 1 || !("typeValue" in effect) || "target" in effect)
    throw new Error("Collision command must be a target-relative Engine effect");
  assertJsonValue(effect.typeValue);
}
var NUMERIC_STATE_SCHEMA_VERSION = 1;
var NUMERIC_THRESHOLD_COMPARATORS = ["below", "below-or-equal", "above", "above-or-equal"];
function validateNumericThresholdBindings(value) {
  if (!Array.isArray(value))
    throw new Error("Numeric threshold bindings must be an array");
  const bindings = value.map((binding) => {
    validateNumericThresholdBinding(binding);
    return structuredClone(binding);
  });
  if (new Set(bindings.map((binding) => binding.id)).size !== bindings.length)
    throw new Error("Numeric threshold IDs must be unique");
}
function validateNumericThresholdBinding(value) {
  const binding = record7(value, "Numeric threshold binding");
  knownKeys(binding, ["schemaVersion", "id", "resetValue", "thresholds"], "Numeric threshold binding");
  if (binding.schemaVersion !== NUMERIC_STATE_SCHEMA_VERSION)
    throw new Error("Unsupported numeric threshold schema version");
  identifier(binding.id, "Numeric threshold ID");
  if (binding.resetValue !== undefined && (typeof binding.resetValue !== "number" || !Number.isFinite(binding.resetValue)))
    throw new Error("Numeric resetValue must be finite");
  if (!Array.isArray(binding.thresholds))
    throw new Error("Numeric threshold binding requires thresholds");
  binding.thresholds.forEach(validateNumericThreshold);
}
function validateNumericThreshold(value) {
  const threshold = record7(value, "Numeric threshold");
  exactKeys7(threshold, ["schemaVersion", "comparator", "value", "effects"], "Numeric threshold");
  if (threshold.schemaVersion !== NUMERIC_STATE_SCHEMA_VERSION)
    throw new Error("Unsupported numeric threshold schema version");
  if (!NUMERIC_THRESHOLD_COMPARATORS.includes(threshold.comparator))
    throw new Error("Unknown numeric threshold comparator");
  if (typeof threshold.value !== "number" || !Number.isFinite(threshold.value))
    throw new Error("Numeric threshold value must be finite");
  if (!Array.isArray(threshold.effects) || threshold.effects.length === 0)
    throw new Error("Numeric threshold requires at least one follow-up effect");
  threshold.effects.forEach(validateRelativeEffect2);
}
function validateRelativeEffect2(value) {
  const effect = record7(value, "Numeric threshold effect");
  if (Object.keys(effect).some((key) => !["schemaVersion", "type", "typeValue"].includes(key)) || Object.keys(effect).length !== 3)
    throw new Error("Numeric threshold effects cannot declare their own target");
  if (effect.schemaVersion !== undefined && effect.schemaVersion !== 1)
    throw new Error("Unsupported numeric threshold effect schema version");
  if (typeof effect.type !== "string" || effect.type.length === 0)
    throw new Error("Numeric threshold effect requires a type");
  assertJsonValue(effect.typeValue);
}
function identifier(value, label) {
  if (typeof value !== "string" || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/.test(value))
    throw new Error(`${label} must be a stable identifier`);
}
function record7(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}
function exactKeys7(value, keys, label) {
  if (Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key)))
    throw new Error(`${label} contains unexpected fields`);
}
function knownKeys(value, keys, label) {
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw new Error(`${label} contains unexpected fields`);
}
var TEMPORAL_MODIFIER_SCHEMA_VERSION = 1;
var TEMPORAL_DURATION_UNITS = ["turns"];
function createTemporalModifierTemplate(input) {
  const template = structuredClone(input);
  if (template.durationUnit !== "turns")
    throw new Error("Temporal modifier requires turns duration");
  if (!Number.isSafeInteger(template.duration) || template.duration < 1)
    throw new Error("Temporal modifier duration must be a positive integer");
  if (!template.effect || typeof template.effect !== "object" || Array.isArray(template.effect))
    throw new Error("Temporal modifier requires an Engine effect");
  assertJsonValue(template.effect);
  if (template.effect.schemaVersion !== 1 || typeof template.effect.type !== "string")
    throw new Error("Temporal modifier Engine effect is invalid");
  return template;
}
function createTemporalModifier(input) {
  const modifier = {
    schemaVersion: TEMPORAL_MODIFIER_SCHEMA_VERSION,
    id: input.id,
    target: { ...input.target },
    effect: structuredClone(input.effect),
    durationUnit: input.durationUnit,
    duration: input.duration,
    remaining: input.remaining ?? input.duration,
    ...input.sourceId === undefined ? {} : { sourceId: input.sourceId },
    ...input.sourceOrder === undefined ? {} : { sourceOrder: input.sourceOrder }
  };
  validateTemporalModifier(modifier);
  return modifier;
}
function advanceTemporalModifier(modifier) {
  validateTemporalModifier(modifier);
  if (modifier.remaining <= 1)
    return;
  return { ...structuredClone(modifier), remaining: modifier.remaining - 1 };
}
function validateTemporalModifier(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Temporal modifier must be an object");
  const modifier = value;
  if (modifier.schemaVersion !== TEMPORAL_MODIFIER_SCHEMA_VERSION)
    throw new Error("Unsupported temporal modifier schema version");
  if (typeof modifier.id !== "string" || modifier.id.length === 0)
    throw new Error("Temporal modifier requires a stable id");
  if (modifier.sourceId !== undefined && (typeof modifier.sourceId !== "string" || modifier.sourceId.length === 0))
    throw new Error("Temporal modifier sourceId must be non-empty");
  if (modifier.sourceOrder !== undefined && !Number.isSafeInteger(modifier.sourceOrder))
    throw new Error("Temporal modifier sourceOrder must be a safe integer");
  if (!modifier.target || modifier.target.type !== "entity" || typeof modifier.target.entityId !== "string" || modifier.target.entityId.length === 0)
    throw new Error("Temporal modifier requires a stable entity target");
  if (modifier.durationUnit !== "turns")
    throw new Error("Temporal modifier requires turns duration");
  const duration = modifier.duration;
  const remaining = modifier.remaining;
  if (typeof duration !== "number" || !Number.isSafeInteger(duration) || duration < 1)
    throw new Error("Temporal modifier duration must be a positive integer");
  if (typeof remaining !== "number" || !Number.isSafeInteger(remaining) || remaining < 1 || remaining > duration)
    throw new Error("Temporal modifier remaining duration is invalid");
  if (!modifier.effect || typeof modifier.effect !== "object" || Array.isArray(modifier.effect))
    throw new Error("Temporal modifier requires an Engine effect");
  assertJsonValue(modifier.effect);
  if (modifier.effect.schemaVersion !== 1 || typeof modifier.effect.type !== "string")
    throw new Error("Temporal modifier Engine effect is invalid");
  const effectKeys = Object.keys(modifier.effect);
  if (effectKeys.some((key) => !["schemaVersion", "type", "typeValue", "target"].includes(key)))
    throw new Error("Temporal modifier Engine effect contains unexpected fields");
}
var STRUCTURE_LIFECYCLE_SCHEMA_VERSION = 1;
var STRUCTURE_LIFECYCLE_DURATION_UNITS = ["turns"];
function createStructureLifecycleTemplate(input) {
  const template = structuredClone(input);
  validateStructureLifecycleTemplate(template);
  return template;
}
function createStructureLifecycle(input) {
  const lifecycle = {
    schemaVersion: STRUCTURE_LIFECYCLE_SCHEMA_VERSION,
    id: input.id,
    structureId: input.structureId,
    durationUnit: input.durationUnit,
    duration: input.duration,
    remaining: input.remaining ?? input.duration,
    ...input.sourceId === undefined ? {} : { sourceId: input.sourceId },
    ...input.sourceOrder === undefined ? {} : { sourceOrder: input.sourceOrder },
    ...input.targetId === undefined ? {} : { targetId: input.targetId }
  };
  validateStructureLifecycle(lifecycle);
  return lifecycle;
}
function advanceStructureLifecycle(lifecycle) {
  validateStructureLifecycle(lifecycle);
  if (lifecycle.remaining <= 1)
    return;
  return { ...structuredClone(lifecycle), remaining: lifecycle.remaining - 1 };
}
function validateStructureLifecycleTemplate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Structure lifecycle template must be an object");
  const template = value;
  if (template.durationUnit !== "turns")
    throw new Error("Structure lifecycle requires turns duration");
  validateDuration(template.duration, "Structure lifecycle duration");
  if (!template.structure || typeof template.structure !== "object" || Array.isArray(template.structure))
    throw new Error("Structure lifecycle requires structure geometry");
  const structure = template.structure;
  if (structure.type !== "rectangle")
    throw new Error("Structure lifecycle currently requires rectangle geometry");
  if (typeof structure.w !== "number" || !Number.isFinite(structure.w) || structure.w <= 0)
    throw new Error("Structure lifecycle width must be positive");
  if (typeof structure.h !== "number" || !Number.isFinite(structure.h) || structure.h <= 0)
    throw new Error("Structure lifecycle height must be positive");
  if (structure.color !== undefined && typeof structure.color !== "string")
    throw new Error("Structure lifecycle color must be a string");
  if (structure.role !== undefined && !["solid", "containment", "both"].includes(structure.role))
    throw new Error("Structure lifecycle role is invalid");
  assertJsonValue(structure);
}
function validateStructureLifecycle(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Structure lifecycle must be an object");
  const lifecycle = value;
  if (lifecycle.schemaVersion !== STRUCTURE_LIFECYCLE_SCHEMA_VERSION)
    throw new Error("Unsupported structure lifecycle schema version");
  if (typeof lifecycle.id !== "string" || lifecycle.id.length === 0)
    throw new Error("Structure lifecycle requires a stable id");
  if (typeof lifecycle.structureId !== "string" || lifecycle.structureId.length === 0)
    throw new Error("Structure lifecycle requires a stable structure id");
  if (lifecycle.sourceId !== undefined && (typeof lifecycle.sourceId !== "string" || lifecycle.sourceId.length === 0))
    throw new Error("Structure lifecycle sourceId must be non-empty");
  if (lifecycle.sourceOrder !== undefined && !Number.isSafeInteger(lifecycle.sourceOrder))
    throw new Error("Structure lifecycle sourceOrder must be a safe integer");
  if (lifecycle.targetId !== undefined && (typeof lifecycle.targetId !== "string" || lifecycle.targetId.length === 0))
    throw new Error("Structure lifecycle targetId must be non-empty");
  if (lifecycle.durationUnit !== "turns")
    throw new Error("Structure lifecycle requires turns duration");
  validateDuration(lifecycle.duration, "Structure lifecycle duration");
  validateDuration(lifecycle.remaining, "Structure lifecycle remaining duration");
  if (lifecycle.remaining > lifecycle.duration)
    throw new Error("Structure lifecycle remaining duration exceeds duration");
}
function validateDuration(value, label) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new Error(`${label} must be a positive integer`);
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
  createCounterState,
  canonicalizeCounterStates,
  validateCounterState,
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
  validateTriggerActivation,
  validateTransformTarget,
  validateTransformState,
  validateTemporalModifier,
  validateStructureLifecycleTemplate,
  validateStructureLifecycle,
  validateNumericThresholdBindings,
  validateNumericThresholdBinding,
  validateNumericThreshold,
  validateNumericTarget,
  validateNumericEffectSettings,
  validateMovementState,
  validateEngineEffectComposition,
  validateCounterTriggerBinding,
  validateCounterTarget,
  validateCounterState,
  validateCounterEffectSettings,
  validateCollisionCommandBinding,
  registerTransformEffects,
  registerParticipationSystem,
  registerParticipationCommands,
  registerNumericSystem,
  registerNumericCommands,
  registerMovementSystem,
  registerMovementEffect,
  registerMovementCommands,
  registerCounterSystem,
  registerCounterCommands,
  participationSystemDefinition,
  numericSystemDefinition,
  movementSystemDefinition,
  isCollisionCommandBinding,
  engine,
  createTriggerActivation,
  createTransformState,
  createTickTriggerEvent,
  createTemporalModifierTemplate,
  createTemporalModifier,
  createStructureLifecycleTemplate,
  createStructureLifecycle,
  createScheduleDueTriggerEvent,
  createRoundStartTriggerEvent,
  createMovementState,
  createEnvironmentActivationTriggerEvent,
  createEngineEffectComposition,
  createCounterState,
  createCollisionEnterTriggerEvent,
  createCollisionCommandBinding,
  counterTriggerMatches,
  counterSystemDefinition,
  canonicalizeCounterStates,
  advanceTemporalModifier,
  advanceStructureLifecycle,
  TRANSFORM_SET_ROTATION_EFFECT_ID,
  TRANSFORM_SET_POSITION_EFFECT_ID,
  TRANSFORM_CAPABILITY,
  TEMPORAL_MODIFIER_SCHEMA_VERSION,
  TEMPORAL_DURATION_UNITS,
  STRUCTURE_LIFECYCLE_SCHEMA_VERSION,
  STRUCTURE_LIFECYCLE_DURATION_UNITS,
  PARTICIPATION_SET_PHYSICS_EFFECT_ID,
  PARTICIPATION_SET_DRAWING_EFFECT_ID,
  PARTICIPATION_EFFECT_IDS,
  PARTICIPATION_CAPABILITY,
  NUMERIC_THRESHOLD_COMPARATORS,
  NUMERIC_STATE_SCHEMA_VERSION,
  NUMERIC_SET_EFFECT_ID,
  NUMERIC_RESET_EFFECT_ID,
  NUMERIC_EFFECT_IDS,
  NUMERIC_CAPABILITY,
  NUMERIC_ADD_EFFECT_ID,
  MOVEMENT_SET_VELOCITY_EFFECT_ID,
  MOVEMENT_SCALE_SPEED_EFFECT_ID,
  MOVEMENT_EFFECT_ID,
  MOVEMENT_COMMAND_EFFECT_IDS,
  MOVEMENT_CAPABILITY,
  MOVEMENT_ADD_VELOCITY_EFFECT_ID,
  EngineWorldBuilder,
  EngineTriggerActivationQueue,
  EngineSystemRegistry,
  EngineEffectRegistry,
  ENGINE_EFFECT_COMPOSITION_TYPE,
  ENGINE_EFFECT_COMPOSITION_SCHEMA_VERSION,
  COUNTER_SET_EFFECT_ID,
  COUNTER_SCHEMA_VERSION,
  COUNTER_RESET_EFFECT_ID,
  COUNTER_EFFECT_IDS,
  COUNTER_CAPABILITY,
  COUNTER_ADD_EFFECT_ID,
  COLLISION_COMMAND_TYPE,
  COLLISION_COMMAND_SCHEMA_VERSION
};
