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
var DEFAULT_BUSES = [
  { id: "master", volume: 1, muted: false, maxVoices: 64, defaultPriority: 0, paused: false },
  { id: "music", volume: 1, muted: false, maxVoices: 1, defaultPriority: 50, paused: false },
  { id: "ambience", volume: 1, muted: false, maxVoices: 8, defaultPriority: 20, paused: false },
  { id: "effects", volume: 1, muted: false, maxVoices: 32, defaultPriority: 10, paused: false },
  { id: "ui", volume: 1, muted: false, maxVoices: 8, defaultPriority: 30, paused: false },
  { id: "voice", volume: 1, muted: false, maxVoices: 8, defaultPriority: 40, paused: false }
];

class AudioEmitter {
  soundSourceId;
  pending = [];
  constructor(soundSourceId) {
    this.soundSourceId = soundSourceId;
    validateId(soundSourceId, "sound source ID");
  }
  emit(command) {
    validateAudioCommand(command);
    if (command.sourceId !== this.soundSourceId)
      throw new Error(`Audio command source '${command.sourceId}' does not match emitter '${this.soundSourceId}'`);
    this.pending.push(clone3(command));
  }
  drainSoundCommands() {
    const commands = this.pending.map(clone3);
    this.pending = [];
    return commands;
  }
}

class SoundSystem {
  runtimeId;
  buses = new Map;
  persistent = new Map;
  pending = [];
  output;
  sequence;
  constructor(runtimeId, settings = { buses: clone3(DEFAULT_BUSES), persistentSources: [] }) {
    this.runtimeId = runtimeId;
    validateId(runtimeId, "runtime ID");
    for (const bus of settings.buses) {
      validateBus(bus);
      if (this.buses.has(bus.id))
        throw new Error(`Duplicate audio bus '${bus.id}'`);
      this.buses.set(bus.id, clone3(bus));
    }
    if (!this.buses.has("master"))
      this.buses.set("master", clone3(DEFAULT_BUSES[0]));
    for (const source of settings.persistentSources) {
      validatePersistentSource(source, this.buses);
      if (this.persistent.has(source.sourceId))
        throw new Error(`Duplicate persistent audio source '${source.sourceId}'`);
      this.persistent.set(source.sourceId, clone3(source));
    }
    this.sequence = settings.sequence ?? 0;
    this.output = emptyBatch(runtimeId, this.sequence, this.diagnostics());
  }
  submit(command) {
    validateAudioCommand(command);
    this.pending.push(clone3(command));
  }
  tick(candidates) {
    const collected = [];
    let ordinal = 0;
    for (const candidate of candidates.filter(isSoundEmitter).sort((a, b) => a.soundSourceId.localeCompare(b.soundSourceId))) {
      for (const command of candidate.drainSoundCommands())
        collected.push({ command, ordinal: ordinal++ });
    }
    for (const command of this.pending.splice(0))
      collected.push({ command, ordinal: ordinal++ });
    const result = this.aggregate(collected);
    this.output = { schemaVersion: 1, runtimeId: this.runtimeId, sequence: ++this.sequence, commands: result.commands, diagnostics: { ...this.diagnostics(), ...result.diagnostics, sequence: this.sequence } };
  }
  drainOutput() {
    const value = clone3(this.output);
    this.output = emptyBatch(this.runtimeId, this.sequence, this.diagnostics());
    return value;
  }
  restorePersistentIntent() {
    for (const source of [...this.persistent.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId)))
      this.pending.push(clone3(source.command));
  }
  toSettings(framework = createDefaultAudioFramework()) {
    const settings = { schemaVersion: 1, runtimeId: this.runtimeId, buses: [...this.buses.values()].sort(byBus).map(clone3), persistentSources: [...this.persistent.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId)).map(clone3), framework: clone3(framework), sequence: this.sequence };
    validateAudioSettings(settings);
    return settings;
  }
  getDiagnostics() {
    return clone3(this.diagnostics());
  }
  aggregate(collected) {
    let rejected = 0;
    let deduplicated = 0;
    let droppedByPriority = 0;
    const valid = [];
    for (const entry of collected) {
      try {
        validateAudioCommand(entry.command);
        validateBusReference(entry.command, this.buses);
        valid.push(entry);
      } catch {
        rejected++;
      }
    }
    const dedupe = new Map;
    const retained = [];
    for (const entry of valid) {
      const key = entry.command.type === "playSound" && entry.command.dedupeKey ? `${entry.command.sourceId}|${entry.command.dedupeKey}` : undefined;
      if (!key) {
        retained.push(entry);
        continue;
      }
      const prior = dedupe.get(key);
      if (!prior || compareCommand(entry.command, prior.command, entry.ordinal, prior.ordinal, this.buses) < 0) {
        if (prior)
          deduplicated++;
        dedupe.set(key, entry);
      } else
        deduplicated++;
    }
    retained.push(...dedupe.values());
    const admitted = [];
    for (const [busId, entries] of groupBy(retained.filter((entry) => isVoiceCommand(entry.command)), (entry) => commandBus(entry.command)).entries()) {
      const bus = this.buses.get(busId);
      const ordered = entries.sort((a, b) => compareCommand(a.command, b.command, a.ordinal, b.ordinal, this.buses));
      admitted.push(...ordered.slice(0, bus.maxVoices));
      droppedByPriority += Math.max(0, ordered.length - bus.maxVoices);
    }
    admitted.push(...retained.filter((entry) => !isVoiceCommand(entry.command)));
    for (const entry of admitted)
      this.applyPersistent(entry.command);
    const commands = admitted.sort((a, b) => comparePipeline(a.command, b.command, a.ordinal, b.ordinal, this.buses)).map((entry) => this.resolve(entry.command));
    return { commands, diagnostics: { collected: collected.length, rejected, deduplicated, droppedByPriority } };
  }
  resolve(command) {
    return { ...clone3(command), runtimeId: this.runtimeId, globalSourceId: `${this.runtimeId}:${command.sourceId}`, sequence: this.sequence + 1 };
  }
  applyPersistent(command) {
    if (command.type === "startLoop" || command.type === "playMusic")
      this.persistent.set(command.sourceId, { sourceId: command.sourceId, command: clone3(command) });
    if (command.type === "stopSource")
      this.persistent.delete(command.sourceId);
    if (command.type === "stopMusic") {
      for (const [id, source] of this.persistent)
        if (source.command.type === "playMusic" && (!command.sourceId || command.sourceId === id))
          this.persistent.delete(id);
    }
    if (command.type === "stopAll")
      this.persistent.clear();
    if (command.type === "setBusVolume") {
      const bus = this.buses.get(command.bus);
      bus.volume = command.volume;
      if (command.muted !== undefined)
        bus.muted = command.muted;
    }
    if (command.type === "pauseBus" || command.type === "resumeBus")
      this.buses.get(command.bus).paused = command.type === "pauseBus";
  }
  diagnostics() {
    return { collected: 0, rejected: 0, deduplicated: 0, droppedByPriority: 0, activePersistentSources: [...this.persistent.keys()].sort(), outputStatus: "ready", sequence: this.sequence };
  }
}

class AudioRuntime {
  system;
  framework;
  constructor(settings) {
    validateAudioSettings(settings);
    this.framework = clone3(settings.framework);
    this.system = new SoundSystem(settings.runtimeId, settings);
  }
  tick(emitters) {
    this.system.tick(emitters);
  }
  submit(command) {
    this.system.submit(command);
  }
  drainOutput() {
    return this.system.drainOutput();
  }
  restorePersistentIntent() {
    this.system.restorePersistentIntent();
  }
  toSettings() {
    return this.system.toSettings(this.framework);
  }
  getDiagnostics() {
    return this.system.getDiagnostics();
  }
}

class ApplicationAudioMixer {
  applicationId;
  buses = new Map;
  pending = [];
  activeMusic;
  sequence;
  constructor(applicationId, settings = { buses: clone3(DEFAULT_BUSES) }) {
    this.applicationId = applicationId;
    validateId(applicationId, "application ID");
    for (const bus of settings.buses) {
      validateBus(bus);
      if (this.buses.has(bus.id))
        throw new Error(`Duplicate audio bus '${bus.id}'`);
      this.buses.set(bus.id, clone3(bus));
    }
    if (!this.buses.has("master"))
      this.buses.set("master", clone3(DEFAULT_BUSES[0]));
    if (settings.activeMusic) {
      validateResolvedCommand(settings.activeMusic);
      this.activeMusic = clone3(settings.activeMusic);
    }
    this.sequence = settings.sequence ?? 0;
  }
  submit(batch) {
    validateAudioBatch(batch);
    this.pending.push(clone3(batch));
  }
  flush() {
    const submitted = this.pending.splice(0).flatMap((batch) => batch.commands);
    const rejected = submitted.filter((command) => ("bus" in command) && command.bus !== undefined && !this.buses.has(command.bus)).length;
    const incoming = submitted.filter((command) => !(("bus" in command) && command.bus !== undefined && !this.buses.has(command.bus))).sort((a, b) => compareResolved(a, b, this.buses));
    const controls = incoming.filter((command) => !isVoiceCommand(command));
    for (const command of controls)
      this.applyControl(command);
    const voices = incoming.filter(isVoiceCommand);
    const music = voices.filter((command) => command.type === "playMusic");
    const nonMusic = this.limitVoices(voices.filter((command) => command.type !== "playMusic"));
    const previousMusic = this.activeMusic;
    const selectedMusic = this.selectMusic(music);
    const replacedMusic = selectedMusic && previousMusic && previousMusic.globalSourceId !== selectedMusic.globalSourceId ? [{ type: "stopSource", sourceId: previousMusic.sourceId, runtimeId: previousMusic.runtimeId, globalSourceId: previousMusic.globalSourceId, sequence: this.sequence + 1 }] : [];
    const commands = [...controls, ...replacedMusic, ...nonMusic, ...selectedMusic ? [selectedMusic] : []].sort((a, b) => compareResolved(a, b, this.buses));
    const diagnostics = { collected: submitted.length, rejected, deduplicated: 0, droppedByPriority: Math.max(0, voices.filter((command) => command.type !== "playMusic").length - nonMusic.length) + Math.max(0, music.length - (selectedMusic ? 1 : 0)), activePersistentSources: this.activeMusic ? [this.activeMusic.globalSourceId] : [], activeMusicSourceId: this.activeMusic?.globalSourceId, outputStatus: "ready", sequence: ++this.sequence };
    return { schemaVersion: 1, runtimeId: this.applicationId, sequence: this.sequence, commands: commands.map((command) => ({ ...command, sequence: this.sequence })), diagnostics };
  }
  toSettings() {
    const settings = { schemaVersion: 1, applicationId: this.applicationId, buses: [...this.buses.values()].sort(byBus).map(clone3), ...this.activeMusic ? { activeMusic: clone3(this.activeMusic) } : {}, sequence: this.sequence };
    validateApplicationAudioSettings(settings);
    return settings;
  }
  limitVoices(commands) {
    const result = [];
    for (const [busId, entries] of groupBy(commands, (command) => commandBus(command)).entries())
      result.push(...entries.sort((a, b) => compareResolved(a, b, this.buses)).slice(0, this.buses.get(busId).maxVoices));
    return result;
  }
  selectMusic(candidates) {
    const ordered = candidates.sort((a, b) => compareResolved(a, b, this.buses));
    for (const candidate of ordered) {
      const policy = candidate.replacementPolicy ?? "replace-lower-or-equal";
      const currentPriority = this.activeMusic ? resolvedPriority(this.activeMusic, this.buses) : -Infinity;
      const priority = resolvedPriority(candidate, this.buses);
      if (!this.activeMusic || policy === "replace-current" || policy === "replace-lower-or-equal" && priority >= currentPriority || policy === "keep-current" && !this.activeMusic) {
        this.activeMusic = clone3(candidate);
        return candidate;
      }
    }
    return;
  }
  applyControl(command) {
    if (command.type === "stopMusic" && (!command.sourceId || this.activeMusic?.globalSourceId === `${command.runtimeId}:${command.sourceId}`))
      this.activeMusic = undefined;
    if (command.type === "stopSource" && this.activeMusic?.globalSourceId === `${command.runtimeId}:${command.sourceId}`)
      this.activeMusic = undefined;
    if (command.type === "stopAll")
      this.activeMusic = undefined;
    if (command.type === "setBusVolume") {
      const bus = this.buses.get(command.bus);
      if (bus) {
        bus.volume = command.volume;
        if (command.muted !== undefined)
          bus.muted = command.muted;
      }
    }
    if (command.type === "pauseBus" || command.type === "resumeBus") {
      const bus = this.buses.get(command.bus);
      if (bus)
        bus.paused = command.type === "pauseBus";
    }
  }
}
function createDefaultAudioFramework() {
  const registry = new EngineSystemRegistry().register({ id: "audio.collect", provides: ["audio.commands"] }).register({ id: "audio.mix", requires: ["audio.commands"], after: ["audio.collect"], provides: ["audio.batch"] });
  return registry.select(["audio.collect", "audio.mix"]);
}
function createAudioRuntime(settings) {
  return new AudioRuntime(settings);
}
function createAudioSettings(options) {
  return { schemaVersion: 1, runtimeId: options.runtimeId, buses: clone3(options.buses ?? DEFAULT_BUSES), persistentSources: clone3(options.persistentSources ?? []), framework: createDefaultAudioFramework(), sequence: 0 };
}
function validateAudioSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Malformed audio settings");
  const settings = value;
  if (settings.schemaVersion !== 1 || typeof settings.runtimeId !== "string" || !Array.isArray(settings.buses) || !Array.isArray(settings.persistentSources) || !settings.framework || typeof settings.sequence !== "number" || !Number.isSafeInteger(settings.sequence) || settings.sequence < 0)
    throw new Error("Malformed audio settings");
  const sequence = settings.sequence;
  validateId(settings.runtimeId, "runtime ID");
  const buses = new Map;
  for (const bus of settings.buses) {
    validateBus(bus);
    if (buses.has(bus.id))
      throw new Error(`Duplicate audio bus '${bus.id}'`);
    buses.set(bus.id, bus);
  }
  if (!buses.has("master"))
    throw new Error("Audio settings require a master bus");
  const sources = new Set;
  for (const source of settings.persistentSources) {
    validatePersistentSource(source, buses);
    if (sources.has(source.sourceId))
      throw new Error(`Duplicate persistent audio source '${source.sourceId}'`);
    sources.add(source.sourceId);
  }
  const registry = new EngineSystemRegistry().register({ id: "audio.collect", provides: ["audio.commands"] }).register({ id: "audio.mix", requires: ["audio.commands"], after: ["audio.collect"], provides: ["audio.batch"] });
  registry.validate(settings.framework);
  if (sequence < 0)
    throw new Error("Invalid audio sequence");
  assertJsonValue(settings);
}
function validateApplicationAudioSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Malformed application audio settings");
  const settings = value;
  if (settings.schemaVersion !== 1 || typeof settings.applicationId !== "string" || !Array.isArray(settings.buses) || typeof settings.sequence !== "number" || !Number.isSafeInteger(settings.sequence) || settings.sequence < 0)
    throw new Error("Malformed application audio settings");
  const sequence = settings.sequence;
  validateId(settings.applicationId, "application ID");
  const ids = new Set;
  for (const bus of settings.buses) {
    validateBus(bus);
    if (ids.has(bus.id))
      throw new Error(`Duplicate audio bus '${bus.id}'`);
    ids.add(bus.id);
  }
  if (!ids.has("master"))
    throw new Error("Application audio settings require a master bus");
  if (settings.activeMusic)
    validateResolvedCommand(settings.activeMusic);
  if (sequence < 0)
    throw new Error("Invalid audio sequence");
  assertJsonValue(settings);
}
function validateAudioCommand(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Malformed audio command");
  const command = value;
  if (typeof command.type !== "string" || !COMMAND_TYPES.has(command.type))
    throw new Error("Unknown audio command");
  if (command.type !== "stopMusic")
    validateId(command.sourceId, "audio source ID");
  else if (command.sourceId !== undefined)
    validateId(command.sourceId, "audio source ID");
  if ("soundId" in command)
    validateId(command.soundId, "sound ID");
  if ("bus" in command && command.bus !== undefined)
    validateId(command.bus, "audio bus ID");
  if ("instanceId" in command && command.instanceId !== undefined)
    validateId(command.instanceId, "audio instance ID");
  if ("dedupeKey" in command && command.dedupeKey !== undefined)
    validateId(command.dedupeKey, "audio dedupe key");
  for (const name of ["volume", "pitch", "pan", "fadeInMs", "fadeOutMs", "priority"]) {
    const numeric = command[name];
    if (numeric !== undefined && (typeof numeric !== "number" || !Number.isFinite(numeric) || name === "volume" && (numeric < 0 || numeric > 1) || name === "pitch" && numeric <= 0 || name === "pan" && (numeric < -1 || numeric > 1) || (name === "fadeInMs" || name === "fadeOutMs") && numeric < 0 || name === "priority" && !Number.isInteger(numeric)))
      throw new Error(`Invalid audio ${name}`);
  }
  if (command.type === "playMusic" && command.replacementPolicy !== undefined && !["replace-current", "replace-lower-or-equal", "keep-current"].includes(command.replacementPolicy))
    throw new Error("Invalid music replacement policy");
  assertJsonValue(command);
}
function validateAudioBatch(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Malformed audio batch");
  const batch = value;
  if (batch.schemaVersion !== 1 || typeof batch.runtimeId !== "string" || typeof batch.sequence !== "number" || !Number.isSafeInteger(batch.sequence) || batch.sequence < 0 || !Array.isArray(batch.commands) || !batch.diagnostics)
    throw new Error("Malformed audio batch");
  const sequence = batch.sequence;
  validateId(batch.runtimeId, "runtime ID");
  for (const command of batch.commands)
    validateResolvedCommand(command);
  if (sequence < 0)
    throw new Error("Invalid audio sequence");
  assertJsonValue(batch);
}
var audio = {
  engine: { createSystemRegistry: engine.createSystemRegistry },
  createSettings: createAudioSettings,
  createRuntime: createAudioRuntime,
  createApplicationMixer(applicationId, settings) {
    return new ApplicationAudioMixer(applicationId, settings);
  },
  createDefaultFramework: createDefaultAudioFramework,
  emitter(sourceId) {
    return new AudioEmitter(sourceId);
  },
  bus(settings) {
    validateBus(settings);
    return clone3(settings);
  },
  command: {
    play(settings) {
      return { type: "playSound", ...clone3(settings) };
    },
    loop(settings) {
      return { type: "startLoop", ...clone3(settings) };
    },
    music(settings) {
      return { type: "playMusic", ...clone3(settings) };
    },
    stopSource(settings) {
      return { type: "stopSource", ...clone3(settings) };
    },
    stopInstance(settings) {
      return { type: "stopInstance", ...clone3(settings) };
    },
    stopMusic(settings = {}) {
      return { type: "stopMusic", ...clone3(settings) };
    },
    setBusVolume(settings) {
      return { type: "setBusVolume", ...clone3(settings) };
    },
    pauseBus(settings) {
      return { type: "pauseBus", ...clone3(settings) };
    },
    resumeBus(settings) {
      return { type: "resumeBus", ...clone3(settings) };
    },
    stopAll(settings) {
      return { type: "stopAll", ...clone3(settings) };
    }
  },
  validate: validateAudioSettings,
  validateCommand: validateAudioCommand,
  validateBatch: validateAudioBatch
};
var COMMAND_TYPES = new Set(["playSound", "startLoop", "playMusic", "stopSource", "stopInstance", "stopMusic", "pauseBus", "resumeBus", "setBusVolume", "stopAll"]);
function isSoundEmitter(value) {
  return !!value && typeof value === "object" && typeof value.soundSourceId === "string" && typeof value.drainSoundCommands === "function";
}
function validateId(value, name) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9._:-]{1,120}$/.test(value))
    throw new Error(`Invalid ${name}`);
}
function validateBus(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Malformed audio bus");
  const bus = value;
  validateId(bus.id, "audio bus ID");
  const volume = bus.volume;
  const maxVoices = bus.maxVoices;
  if (typeof volume !== "number" || !Number.isFinite(volume) || volume < 0 || volume > 1 || typeof bus.muted !== "boolean" || typeof maxVoices !== "number" || !Number.isSafeInteger(maxVoices) || maxVoices < 1 || !Number.isSafeInteger(bus.defaultPriority) || typeof bus.paused !== "boolean")
    throw new Error(`Invalid audio bus '${bus.id}'`);
  assertJsonValue(bus);
}
function validatePersistentSource(value, buses) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Malformed persistent audio source");
  const source = value;
  validateId(source.sourceId, "persistent source ID");
  validateAudioCommand(source.command);
  if (source.command.type !== "startLoop" && source.command.type !== "playMusic")
    throw new Error("Persistent audio source must be a loop or music command");
  if (source.command.sourceId !== source.sourceId)
    throw new Error("Persistent audio source ID mismatch");
  validateBusReference(source.command, buses);
}
function validateBusReference(command, buses) {
  if ("bus" in command && command.bus !== undefined && !buses.has(command.bus))
    throw new Error(`Unknown audio bus '${command.bus}'`);
}
function validateResolvedCommand(value) {
  validateAudioCommand(value);
  const command = value;
  validateId(command.runtimeId, "runtime ID");
  validateId(command.globalSourceId, "global audio source ID");
  const sequence = command.sequence;
  if (typeof sequence !== "number" || !Number.isSafeInteger(sequence) || sequence < 0)
    throw new Error("Invalid audio sequence");
}
function commandBus(command) {
  return "bus" in command && command.bus ? command.bus : command.type === "playMusic" ? "music" : "effects";
}
function isVoiceCommand(command) {
  return command.type === "playSound" || command.type === "startLoop" || command.type === "playMusic";
}
function resolvedPriority(command, buses) {
  return command.priority ?? buses.get(commandBus(command))?.defaultPriority ?? 0;
}
function compareCommand(a, b, aOrdinal, bOrdinal, buses) {
  return resolvedPriority(b, buses) - resolvedPriority(a, buses) || commandBus(a).localeCompare(commandBus(b)) || (a.sourceId ?? "").localeCompare(b.sourceId ?? "") || ("soundId" in a ? a.soundId : "").localeCompare("soundId" in b ? b.soundId : "") || aOrdinal - bOrdinal;
}
function pipelineOrder(command) {
  if (command.type === "stopAll" || command.type === "pauseBus" || command.type === "resumeBus" || command.type === "setBusVolume")
    return 0;
  if (command.type === "stopSource" || command.type === "stopInstance" || command.type === "stopMusic")
    return 1;
  if (command.type === "playMusic")
    return 2;
  if (command.type === "startLoop")
    return 3;
  return 4;
}
function comparePipeline(a, b, aOrdinal, bOrdinal, buses) {
  return pipelineOrder(a) - pipelineOrder(b) || compareCommand(a, b, aOrdinal, bOrdinal, buses);
}
function compareResolved(a, b, buses) {
  return pipelineOrder(a) - pipelineOrder(b) || resolvedPriority(b, buses) - resolvedPriority(a, buses) || a.globalSourceId.localeCompare(b.globalSourceId) || ("soundId" in a ? a.soundId : "").localeCompare("soundId" in b ? b.soundId : "") || a.sequence - b.sequence;
}
function byBus(a, b) {
  return a.id.localeCompare(b.id);
}
function emptyBatch(runtimeId, sequence, diagnostics) {
  return { schemaVersion: 1, runtimeId, sequence, commands: [], diagnostics: { ...diagnostics, sequence } };
}
function groupBy(items, key) {
  const grouped = new Map;
  for (const item of items) {
    const id = key(item);
    const values = grouped.get(id) ?? [];
    values.push(item);
    grouped.set(id, values);
  }
  return grouped;
}
function clone3(value) {
  return structuredClone(value);
}
function validateAnimationSettings(value) {
  if (!isRecord2(value) || value.schemaVersion !== 1 || typeof value.id !== "string" || typeof value.channel !== "string" || !positiveInteger(value.durationTicks) || !integer(value.priority) || !INTERRUPTIONS.has(value.interruption) || !Array.isArray(value.tracks))
    throw new Error("Malformed animation settings");
  assertKeys(value, ["schemaVersion", "id", "channel", "durationTicks", "priority", "interruption", "tracks"], "animation settings");
  validateId2(value.id, "animation ID");
  validateId2(value.channel, "animation channel");
  const ids = new Set;
  for (const track of value.tracks) {
    if (!isRecord2(track) || typeof track.id !== "string" || !Array.isArray(track.keyframes))
      throw new Error("Malformed animation track");
    assertKeys(track, ["id", "keyframes"], "animation track");
    validateId2(track.id, "animation track ID");
    if (ids.has(track.id))
      throw new Error(`Duplicate animation track '${track.id}'`);
    ids.add(track.id);
    let previous = -1;
    for (const keyframe of track.keyframes) {
      if (!isRecord2(keyframe) || !nonNegativeInteger(keyframe.tick) || keyframe.tick > value.durationTicks || keyframe.tick <= previous)
        throw new Error("Invalid animation keyframe");
      assertKeys(keyframe, ["tick", "value"], "animation keyframe");
      assertJsonValue(keyframe.value);
      previous = keyframe.tick;
    }
    if (track.keyframes.length === 0)
      throw new Error("Animation tracks require keyframes");
  }
  assertJsonValue(value);
}
function validatePresentationEvent(value) {
  if (!isRecord2(value) || value.schemaVersion !== 1 || value.type !== "play" && value.type !== "cancel" || typeof value.eventId !== "string")
    throw new Error("Malformed presentation event");
  assertKeys(value, ["schemaVersion", "type", "eventId", "channel", "animationId", "instanceId", "priority", "payload"], "presentation event");
  validateId2(value.eventId, "presentation event ID");
  if (value.channel !== undefined)
    validateId2(value.channel, "presentation channel");
  if (value.animationId !== undefined)
    validateId2(value.animationId, "animation ID");
  if (value.instanceId !== undefined)
    validateId2(value.instanceId, "presentation instance ID");
  if (value.priority !== undefined && !integer(value.priority))
    throw new Error("Invalid presentation priority");
  if (value.type === "play" && value.animationId === undefined)
    throw new Error("Play events require an animation ID");
  if (value.type === "cancel" && value.instanceId === undefined && value.channel === undefined)
    throw new Error("Cancel events require an instance or channel");
  if (value.payload !== undefined)
    assertJsonValue(value.payload);
  assertJsonValue(value);
}
function validatePresentationRuntimeSettings(value) {
  if (!isRecord2(value) || value.schemaVersion !== 1 || typeof value.runtimeId !== "string" || !nonNegativeInteger(value.tick) || !nonNegativeInteger(value.sequence) || !Array.isArray(value.active) || !Array.isArray(value.pending))
    throw new Error("Malformed presentation runtime settings");
  assertKeys(value, ["schemaVersion", "runtimeId", "tick", "sequence", "active", "pending"], "presentation runtime settings");
  validateId2(value.runtimeId, "presentation runtime ID");
  for (const active of value.active) {
    if (!isRecord2(active) || typeof active.instanceId !== "string" || typeof active.animationId !== "string" || typeof active.channel !== "string" || !nonNegativeInteger(active.startTick) || !integer(active.priority))
      throw new Error("Malformed active animation");
    assertKeys(active, ["instanceId", "animationId", "channel", "startTick", "priority"], "active animation");
    validateId2(active.instanceId, "presentation instance ID");
    validateId2(active.animationId, "animation ID");
    validateId2(active.channel, "presentation channel");
  }
  for (const event of value.pending)
    validatePresentationEvent(event);
  assertJsonValue(value);
}

class PresentationRuntime {
  runtimeId;
  animations = new Map;
  active = new Map;
  pending = [];
  tickNumber;
  sequence;
  lastFrame;
  constructor(runtimeId, settings) {
    this.runtimeId = runtimeId;
    validateId2(runtimeId, "presentation runtime ID");
    for (const animation of settings.animations) {
      validateAnimationSettings(animation);
      if (this.animations.has(animation.id))
        throw new Error(`Duplicate animation '${animation.id}'`);
      this.animations.set(animation.id, clone4(animation));
    }
    this.tickNumber = settings.tick ?? 0;
    this.sequence = settings.sequence ?? 0;
    for (const item of settings.active ?? [])
      this.restoreActive(item);
    for (const event of settings.pending ?? []) {
      validatePresentationEvent(event);
      this.pending.push(clone4(event));
    }
    this.lastFrame = this.frame([]);
  }
  emit(event) {
    validatePresentationEvent(event);
    this.pending.push(clone4(event));
  }
  tick(ticks = 1) {
    if (!nonNegativeInteger(ticks))
      throw new Error("Presentation tick count must be a non-negative integer");
    const records = [];
    for (let step = 0;step < ticks; step++) {
      this.tickNumber++;
      this.processPending(records);
      this.expire(records);
    }
    this.lastFrame = this.frame(records);
    return clone4(this.lastFrame);
  }
  project() {
    return clone4(this.frame([]));
  }
  toSettings() {
    const settings = { schemaVersion: 1, runtimeId: this.runtimeId, tick: this.tickNumber, sequence: this.sequence, active: [...this.active.values()].sort(byInstance).map(clone4), pending: this.pending.map(clone4) };
    validatePresentationRuntimeSettings(settings);
    return settings;
  }
  processPending(records) {
    const pending = this.pending.splice(0).map((event, ordinal) => ({ event, ordinal })).sort((a, b) => this.eventPriority(b.event) - this.eventPriority(a.event) || a.ordinal - b.ordinal || a.event.eventId.localeCompare(b.event.eventId));
    for (const { event } of pending) {
      if (event.type === "cancel") {
        for (const item2 of [...this.active.values()])
          if (event.instanceId && item2.instanceId === event.instanceId || event.channel && item2.channel === event.channel)
            this.cancel(item2, records, event.eventId);
        continue;
      }
      const animation = this.animations.get(event.animationId);
      if (!animation)
        throw new Error(`Unknown animation '${event.animationId}'`);
      const current = this.active.get(animation.channel);
      if (current && (animation.interruption === "ignore" || animation.interruption === "higher-priority" && animation.priority <= current.priority))
        continue;
      if (current)
        this.cancel(current, records, event.eventId);
      const item = { instanceId: event.instanceId ?? `${this.runtimeId}:${event.eventId}`, animationId: animation.id, channel: animation.channel, startTick: this.tickNumber, priority: animation.priority };
      this.active.set(animation.channel, item);
      records.push(this.record({ ...event, type: "play", animationId: animation.id, instanceId: item.instanceId }, this.sequence++));
    }
  }
  eventPriority(event) {
    return event.priority ?? (event.type === "play" ? this.animations.get(event.animationId)?.priority ?? 0 : 0);
  }
  cancel(item, records, eventId) {
    this.active.delete(item.channel);
    records.push(this.record({ schemaVersion: 1, type: "cancel", eventId, instanceId: item.instanceId, channel: item.channel }, this.sequence++));
  }
  expire(records) {
    for (const item of [...this.active.values()]) {
      const animation = this.animations.get(item.animationId);
      if (this.tickNumber - item.startTick >= animation.durationTicks)
        this.cancel(item, records, `${item.instanceId}:complete`);
    }
  }
  record(event, sequence) {
    return { ...clone4(event), sequence, tick: this.tickNumber };
  }
  frame(events) {
    return { schemaVersion: 1, runtimeId: this.runtimeId, tick: this.tickNumber, events: events.map(clone4), animations: [...this.active.values()].sort(byInstance).map((item) => this.projectAnimation(item)) };
  }
  projectAnimation(item) {
    const animation = this.animations.get(item.animationId);
    const localTick = Math.max(0, this.tickNumber - item.startTick);
    const values = {};
    for (const track of animation.tracks)
      values[track.id] = sample(track.keyframes, localTick);
    return { instanceId: item.instanceId, animationId: item.animationId, channel: item.channel, priority: item.priority, localTick, progress: Math.min(1, localTick / animation.durationTicks), values };
  }
  restoreActive(item) {
    validatePresentationRuntimeSettings({ schemaVersion: 1, runtimeId: this.runtimeId, tick: this.tickNumber, sequence: this.sequence, active: [item], pending: [] });
    if (this.active.has(item.channel))
      throw new Error(`Duplicate active animation channel '${item.channel}'`);
    if (!this.animations.has(item.animationId))
      throw new Error(`Unknown animation '${item.animationId}'`);
    this.active.set(item.channel, clone4(item));
  }
}
function sample(keyframes, tick) {
  let result = keyframes[0].value;
  for (const keyframe of keyframes) {
    if (keyframe.tick > tick)
      break;
    result = keyframe.value;
  }
  return clone4(result);
}
function validateId2(value, name) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9._:-]{1,120}$/.test(value))
    throw new Error(`Invalid ${name}`);
}
function assertKeys(value, allowed, name) {
  const keys = new Set(allowed);
  for (const key of Object.keys(value))
    if (!keys.has(key))
      throw new Error(`Unknown ${name} field '${key}'`);
}
function isRecord2(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function integer(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}
function nonNegativeInteger(value) {
  return integer(value) && value >= 0;
}
function positiveInteger(value) {
  return integer(value) && value > 0;
}
function clone4(value) {
  return structuredClone(value);
}
function byInstance(a, b) {
  return a.channel.localeCompare(b.channel) || a.instanceId.localeCompare(b.instanceId);
}
var INTERRUPTIONS = new Set(["replace", "higher-priority", "ignore"]);

class UiRuntime {
  settings;
  screens = new Map;
  systems;
  activeScreen;
  history;
  pendingPress;
  hovered;
  pendingKeyboard;
  pendingActions = [];
  emitted = [];
  constructor(settings) {
    this.settings = settings;
    validateUiSettings(settings);
    this.activeScreen = settings.activeScreen;
    this.history = [...settings.history];
    for (const screen of settings.screens)
      this.screens.set(screen.id, { settings: clone5(screen), elements: screen.elements.map((element) => createNode(element)) });
    this.systems = settings.framework.systemOrder.map(createUiSystem);
    this.layout();
  }
  static fromSettings(settings) {
    return new UiRuntime(settings);
  }
  tick(input = {}, deltaTime = 1) {
    for (const system of this.systems)
      system.tick?.(this, input, deltaTime);
  }
  draw(renderer) {
    for (const system of this.systems)
      system.draw?.(this, renderer);
  }
  toSettings() {
    const screens = [...this.screens.values()].map((screen) => ({ ...clone5(screen.settings), elements: screen.elements.map((node) => node.toSettings()) }));
    return { ...clone5(this.settings), activeScreen: this.activeScreen, history: [...this.history], screens };
  }
  getActiveElements() {
    return this.screens.get(this.activeScreen).elements;
  }
  getActiveScreen() {
    return this.activeScreen;
  }
  getFocusedElementId() {
    return this.activeLeaves().find(hasFocusable)?.id;
  }
  getElementValue(id) {
    const element = this.findElementAnywhere(id);
    return element?.kind === "textInput" ? element.value : undefined;
  }
  getHoveredElementId() {
    return this.hovered;
  }
  getPressedTargetId() {
    return this.pendingPress;
  }
  dispatch(action) {
    validateAction(action, new Set(this.screens.keys()), "action", true);
    this.applyAction(clone5(action));
  }
  setElementVisible(id, visible) {
    const node = this.findNodeAnywhere(id);
    if (!node)
      return false;
    node.visible = visible;
    this.layout();
    return true;
  }
  setElementAction(id, action) {
    if (action)
      validateAction(action, new Set(this.screens.keys()), "action", true);
    const element = this.findElementAnywhere(id);
    if (!element)
      return false;
    element.action = action ? clone5(action) : undefined;
    return true;
  }
  setElementEnabled(id, enabled) {
    const node = this.findNodeAnywhere(id);
    if (!node)
      return false;
    node.enabled = enabled;
    return true;
  }
  setElementText(id, text) {
    const element = this.findElementAnywhere(id);
    if (!element)
      return false;
    element.text = text;
    return true;
  }
  setElementComponent(id, component) {
    if (component)
      validateUiComponent(component, `element "${id}" component`);
    const element = this.findElementAnywhere(id);
    if (!element || element.kind !== "button")
      return false;
    element.component = component ? clone5(component) : undefined;
    return true;
  }
  drainCommands() {
    const commands = this.emitted.map(clone5);
    this.emitted = [];
    return commands;
  }
  explain() {
    return `UI '${this.settings.id}' uses ${this.systems.map((system) => system.id).join(", ")} with explicit tick() and draw().`;
  }
  layout() {
    const screen = this.screens.get(this.activeScreen);
    if (!screen)
      return;
    const size = this.settings.size;
    this.resolveLayout({ x: 0, y: 0, width: size.width, height: size.height }, screen.settings.layout ?? { type: "absolute" }, screen.elements, true, true);
  }
  pointer(input) {
    this.pendingPress = undefined;
    this.hovered = undefined;
    for (const element of this.activeLeaves()) {
      if ("hovered" in element)
        element.hovered = false;
      if ("pressed" in element)
        element.pressed = false;
    }
    if (!input)
      return;
    const point = { x: input.x, y: input.y };
    const target = this.findPointerTarget(point);
    this.hovered = target?.id;
    if (target && "hovered" in target)
      target.hovered = true;
    this.applyGroupHover(point, this.activeScreenNodes(), true, false);
    if (target && input.pressed && "pressed" in target)
      target.pressed = true;
    if (input.justPressed)
      this.pendingPress = target?.id;
  }
  applyGroupHover(point, nodes, parentVisible, parentGroupHovered) {
    for (const node of nodes) {
      const visible = node.visible && parentVisible;
      if (!visible)
        continue;
      if (isContainerNode(node)) {
        const groupHovered = parentGroupHovered || node.groupHover === true && node.containsPoint(point);
        this.applyGroupHover(point, node.elements, visible, groupHovered);
      } else if (parentGroupHovered) {
        node.hovered = true;
      }
    }
  }
  focus() {
    if (!this.pendingPress)
      return;
    for (const element of this.activeLeaves())
      if (hasFocusable(element))
        element.focused = element.id === this.pendingPress;
  }
  keyboard(input) {
    this.pendingKeyboard = input;
    const keys = input?.pressedKeys ?? [];
    const focusable = this.activeLeaves().filter((element) => hasFocusable(element) && element.visible && element.enabled);
    if (focusable.length === 0)
      return;
    const current = focusable.findIndex((element) => element.focused);
    const forward = keys.includes("Tab") || keys.includes("ArrowRight") || keys.includes("ArrowDown");
    const backward = keys.includes("ArrowLeft") || keys.includes("ArrowUp") || keys.includes("Tab") && keys.includes("Shift");
    if (forward || backward) {
      const next = current < 0 ? 0 : (current + (backward ? -1 : 1) + focusable.length) % focusable.length;
      for (const element of focusable)
        element.focused = element === focusable[next];
    }
    if (keys.includes("Enter") || keys.includes(" ")) {
      const focused = focusable.find((element) => element.focused);
      if (focused && focused.kind !== "textInput")
        this.pendingPress = focused.id;
    }
  }
  textInput() {
    const focused = this.activeLeaves().find(hasTextInput);
    if (!focused) {
      this.pendingKeyboard = undefined;
      return;
    }
    if (this.pendingKeyboard?.textInput)
      focused.insertText(this.pendingKeyboard.textInput);
    if (this.pendingKeyboard?.pressedKeys?.includes("Backspace"))
      focused.deleteBackward();
    this.pendingKeyboard = undefined;
  }
  press() {
    if (!this.pendingPress)
      return;
    const found = this.findNode(this.pendingPress);
    if (!found || !found.enabled || !found.visible || !found.action)
      return;
    this.pendingActions.push(clone5(found.action));
  }
  navigate() {
    for (const action of this.pendingActions.splice(0))
      this.applyAction(action);
  }
  render(renderer) {
    this.renderNodes(renderer, this.activeScreenNodes(), true);
  }
  applyAction(action) {
    if (action.type === "navigate") {
      if (!this.screens.has(action.target))
        return;
      this.history.push(this.activeScreen);
      this.activeScreen = action.target;
      this.layout();
      return;
    }
    if (action.type === "back") {
      const previous = this.history.pop();
      if (previous) {
        this.activeScreen = previous;
        this.layout();
      }
      return;
    }
    if (action.type === "toggleVisibility" || action.type === "closeOverlay") {
      const target = action.type === "closeOverlay" ? this.activeScreenNodes()[0]?.id : action.target;
      const node = this.findNode(target);
      if (node) {
        node.visible = !node.visible;
        this.layout();
      }
      return;
    }
    if (action.type === "setValue" || action.type === "select") {
      const element = this.findElement(action.target);
      if (element && isTextInputElement(element) && typeof action.value === "string")
        element.value = action.value;
      return;
    }
    if (action.type === "setEnabled") {
      const node = this.findNode(action.target);
      if (node)
        node.enabled = action.enabled;
      return;
    }
    if (action.type === "setText") {
      const element = this.findElement(action.target);
      if (element)
        element.text = action.text;
      return;
    }
    if (action.type === "emitValues") {
      const payload = {};
      for (const target of action.targets) {
        const element = this.findElement(target);
        if (element && isTextInputElement(element))
          payload[target] = element.value;
      }
      this.emitted.push({ command: action.command, payload });
      return;
    }
    if (action.type === "emit")
      this.emitted.push({ command: action.command, ...action.payload === undefined ? {} : { payload: clone5(action.payload) } });
  }
  resolveLayout(parent, layout, nodes, parentVisible, parentEnabled) {
    const padding = normalizePadding(layout.padding);
    const content = {
      x: parent.x + padding.left,
      y: parent.y + padding.top,
      width: Math.max(0, parent.width - padding.left - padding.right),
      height: Math.max(0, parent.height - padding.top - padding.bottom)
    };
    if (layout.type === "absolute") {
      for (const node of nodes) {
        const visible = node.visible && parentVisible;
        const enabled = node.enabled && parentEnabled;
        node.rect = { x: content.x + node.localRect.x, y: content.y + node.localRect.y, width: node.localRect.width, height: node.localRect.height };
        if (isContainerNode(node))
          this.resolveLayout(node.rect, node.layout, node.elements, visible, enabled);
      }
      return;
    }
    const horizontal = layout.type === "horizontal";
    const gap = layout.gap ?? 0;
    const justify = layout.justify ?? "start";
    const align = layout.align ?? "start";
    const participants = [];
    for (const node of nodes) {
      if (!(node.visible && parentVisible))
        continue;
      participants.push({ node, mainSize: horizontal ? node.rect.width : node.rect.height, crossSize: horizontal ? node.rect.height : node.rect.width });
    }
    const count = participants.length;
    const contentMain = horizontal ? content.width : content.height;
    const contentCross = horizontal ? content.height : content.width;
    const totalMain = participants.reduce((sum, participant) => sum + participant.mainSize, 0) + (count > 1 ? gap * (count - 1) : 0);
    const remaining = contentMain - totalMain;
    const offsets = mainAxisOffsets(count, gap, remaining, justify);
    for (let index = 0;index < count; index++) {
      const participant = participants[index];
      const node = participant.node;
      const priorSize = participants.slice(0, index).reduce((sum, prior) => sum + prior.mainSize, 0);
      const mainPos = offsets[index] + priorSize;
      let crossPos;
      let resolvedCrossSize = participant.crossSize;
      if (align === "stretch") {
        resolvedCrossSize = contentCross;
        crossPos = 0;
      } else if (align === "center")
        crossPos = (contentCross - participant.crossSize) / 2;
      else if (align === "end")
        crossPos = contentCross - participant.crossSize;
      else
        crossPos = 0;
      const rect = horizontal ? { x: content.x + mainPos, y: content.y + crossPos, width: participant.mainSize, height: resolvedCrossSize } : { x: content.x + crossPos, y: content.y + mainPos, width: resolvedCrossSize, height: participant.mainSize };
      node.rect = rect;
      if (isContainerNode(node))
        this.resolveLayout(rect, node.layout, node.elements, node.visible && parentVisible, node.enabled && parentEnabled);
    }
  }
  activeScreenNodes() {
    return this.screens.get(this.activeScreen).elements;
  }
  activeLeaves() {
    const leaves = [];
    const walk = (nodes) => {
      for (const node of nodes) {
        if (isContainerNode(node))
          walk(node.elements);
        else
          leaves.push(node);
      }
    };
    walk(this.activeScreenNodes());
    return leaves;
  }
  findPointerTarget(point, nodes = this.activeScreenNodes(), parentVisible = true, parentEnabled = true) {
    for (let i = nodes.length - 1;i >= 0; i--) {
      const node = nodes[i];
      const visible = node.visible && parentVisible;
      const enabled = node.enabled && parentEnabled;
      if (isContainerNode(node)) {
        const hit = this.findPointerTarget(point, node.elements, visible, enabled);
        if (hit)
          return hit;
        if (visible && enabled && node.action && node.containsPoint(point))
          return node;
        continue;
      }
      if (visible && enabled && (node.action || hasFocusable(node)) && node.containsPoint(point))
        return node;
    }
    return;
  }
  findNode(id, nodes = this.activeScreenNodes()) {
    for (const node of nodes) {
      if (node.id === id)
        return node;
      if (isContainerNode(node)) {
        const found = this.findNode(id, node.elements);
        if (found)
          return found;
      }
    }
    return;
  }
  findElement(id, nodes = this.activeScreenNodes()) {
    for (const node of nodes) {
      if (isContainerNode(node)) {
        const found = this.findElement(id, node.elements);
        if (found)
          return found;
        continue;
      }
      if (node.id === id)
        return node;
    }
    return;
  }
  findNodeAnywhere(id) {
    for (const screen of this.screens.values()) {
      const found = this.findNode(id, screen.elements);
      if (found)
        return found;
    }
    return;
  }
  findElementAnywhere(id) {
    for (const screen of this.screens.values()) {
      const found = this.findElement(id, screen.elements);
      if (found)
        return found;
    }
    return;
  }
  renderNodes(renderer, nodes, parentVisible) {
    for (const node of nodes) {
      const visible = node.visible && parentVisible;
      if (isContainerNode(node)) {
        this.renderNodes(renderer, node.elements, visible);
        continue;
      }
      if (!visible)
        continue;
      if (node.kind === "button")
        renderer.drawButton(node);
      else if (node.kind === "textInput")
        renderer.drawTextInput(node);
      else if (node.kind === "image")
        renderer.drawImage(node);
      else
        renderer.drawText(node);
    }
  }
}

class UiElement {
  settings;
  visible;
  enabled;
  focused;
  hovered;
  pressed;
  value;
  localRect;
  resolvedStyle;
  constructor(settings, parentStyle) {
    this.settings = settings;
    this.localRect = clone5(settings.rect);
    this.visible = settings.visible ?? true;
    this.enabled = settings.enabled ?? true;
    this.focused = false;
    this.hovered = false;
    this.pressed = false;
    this.value = "value" in settings ? settings.value ?? settings.text : ("text" in settings) ? settings.text : "";
    this.resolvedStyle = settings.style ?? (settings.inheritStyle ? parentStyle : undefined);
  }
  get id() {
    return this.settings.id;
  }
  get kind() {
    return this.settings.kind;
  }
  get rect() {
    return this.settings.rect;
  }
  set rect(value) {
    this.settings.rect = value;
  }
  get text() {
    return "text" in this.settings ? this.settings.text : "";
  }
  set text(value) {
    if ("text" in this.settings)
      this.settings.text = value;
  }
  get icon() {
    return this.settings.kind === "button" ? this.settings.icon : undefined;
  }
  get component() {
    return this.settings.kind === "button" ? this.settings.component : undefined;
  }
  set component(value) {
    if (this.settings.kind === "button")
      this.settings.component = value;
  }
  get source() {
    return this.settings.kind === "image" ? this.settings.source : undefined;
  }
  get style() {
    return this.resolvedStyle;
  }
  get action() {
    return this.settings.kind === "text" ? undefined : this.settings.action;
  }
  set action(value) {
    if (this.settings.kind !== "text")
      this.settings.action = value;
  }
  containsPoint(point) {
    return point.x >= this.rect.x && point.x <= this.rect.x + this.rect.width && point.y >= this.rect.y && point.y <= this.rect.y + this.rect.height;
  }
  insertText(value) {
    this.value += value;
    this.text = this.value;
  }
  deleteBackward() {
    this.value = this.value.slice(0, -1);
    this.text = this.value;
  }
  toSettings() {
    const base = { ...clone5(this.settings), rect: clone5(this.localRect), visible: this.visible, enabled: this.enabled };
    if (this.kind !== "image")
      base.text = this.text;
    return this.kind === "textInput" ? { ...base, value: this.value } : base;
  }
}

class UiContainer {
  settings;
  visible;
  enabled;
  localRect;
  layout;
  elements;
  resolvedStyle;
  constructor(settings, parentStyle) {
    this.settings = settings;
    this.localRect = clone5(settings.rect);
    this.visible = settings.visible ?? true;
    this.enabled = settings.enabled ?? true;
    this.layout = clone5(settings.layout);
    this.resolvedStyle = settings.style ?? (settings.inheritStyle ? parentStyle : undefined);
    this.elements = settings.elements.map((child) => createNode(child, this.resolvedStyle));
  }
  get id() {
    return this.settings.id;
  }
  get kind() {
    return "container";
  }
  get rect() {
    return this.settings.rect;
  }
  set rect(value) {
    this.settings.rect = value;
  }
  get style() {
    return this.resolvedStyle;
  }
  get groupHover() {
    return this.settings.groupHover;
  }
  get action() {
    return this.settings.action ? clone5(this.settings.action) : undefined;
  }
  containsPoint(point) {
    return point.x >= this.rect.x && point.x <= this.rect.x + this.rect.width && point.y >= this.rect.y && point.y <= this.rect.y + this.rect.height;
  }
  toSettings() {
    return { ...clone5(this.settings), rect: clone5(this.localRect), visible: this.visible, enabled: this.enabled, elements: this.elements.map((node) => node.toSettings()) };
  }
}
var UI_SYSTEMS = {
  "ui.visibility": { id: "ui.visibility" },
  "ui.layout": { id: "ui.layout", tick: (runtime) => runtime.layout() },
  "ui.input.pointer": { id: "ui.input.pointer", tick: (runtime, input) => runtime.pointer(input.pointer) },
  "ui.focus": { id: "ui.focus", tick: (runtime) => runtime.focus() },
  "ui.input.keyboard": { id: "ui.input.keyboard", tick: (runtime, input) => runtime.keyboard(input.keyboard) },
  "ui.text-input": { id: "ui.text-input", tick: (runtime) => runtime.textInput() },
  "ui.button": { id: "ui.button", tick: (runtime) => runtime.press() },
  "ui.navigation": { id: "ui.navigation", tick: (runtime) => runtime.navigate() },
  "ui.render": { id: "ui.render", draw: (runtime, renderer) => runtime.render(renderer) }
};
function createUiSystem(id) {
  const system = UI_SYSTEMS[id];
  if (!system)
    throw new Error(`Unknown UI system '${id}'`);
  return system;
}
function createDefaultUiFramework() {
  const registry = new EngineSystemRegistry().register({ id: "ui.visibility", provides: ["ui.visibility"] }).register({ id: "ui.layout", provides: ["ui.layout"], after: ["ui.visibility"] }).register({ id: "ui.input.pointer", provides: ["ui.pointer"], after: ["ui.layout"] }).register({ id: "ui.focus", requires: ["ui.pointer"], provides: ["ui.focus"], after: ["ui.input.pointer"] }).register({ id: "ui.input.keyboard", provides: ["ui.keyboard"], after: ["ui.focus"] }).register({ id: "ui.text-input", requires: ["ui.focus", "ui.keyboard"], after: ["ui.input.keyboard"] }).register({ id: "ui.button", requires: ["ui.pointer"], after: ["ui.focus", "ui.text-input"] }).register({ id: "ui.navigation", after: ["ui.button", "ui.text-input"] }).register({ id: "ui.render", requires: ["ui.layout"], after: ["ui.navigation"] });
  return registry.select(["ui.visibility", "ui.layout", "ui.input.pointer", "ui.focus", "ui.input.keyboard", "ui.text-input", "ui.button", "ui.navigation", "ui.render"]);
}

class UiMenuBuilder {
  id;
  size;
  screens = [];
  framework = createDefaultUiFramework();
  constructor(id, size) {
    this.id = id;
    this.size = size;
    if (!id || !positive(size.width) || !positive(size.height))
      throw new Error("A UI menu requires an ID and positive size");
  }
  addScreen(screen) {
    this.screens.push(clone5(screen));
    return this;
  }
  useFramework(framework) {
    this.framework = clone5(framework);
    return this;
  }
  build() {
    const settings = { schemaVersion: 1, id: this.id, size: clone5(this.size), activeScreen: this.screens[0]?.id ?? "", history: [], screens: clone5(this.screens), framework: clone5(this.framework) };
    validateUiSettings(settings);
    return settings;
  }
  buildJson(space = 2) {
    return JSON.stringify(this.build(), null, space);
  }
  explain() {
    return "Builds a JSON-safe explicit-tick UI menu with screens, semantic actions, and registry-selected systems.";
  }
}
function createNode(settings, parentStyle) {
  const cloned = clone5(settings);
  return cloned.kind === "container" ? new UiContainer(cloned, parentStyle) : new UiElement(cloned, parentStyle);
}
function isContainerNode(node) {
  return node.kind === "container";
}
function hasFocusable(value) {
  return value.kind === "button" || value.kind === "textInput";
}
function hasTextInput(value) {
  return value.kind === "textInput" && value.focused === true;
}
function isTextInputElement(value) {
  return value.kind === "textInput";
}
function positive(value) {
  return Number.isFinite(value) && value > 0;
}
function isRecord3(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function clone5(value) {
  return structuredClone(value);
}
function range(count, compute) {
  return Array.from({ length: count }, (_, index) => compute(index));
}
function normalizePadding(padding) {
  if (padding === undefined)
    return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof padding === "number")
    return { top: padding, right: padding, bottom: padding, left: padding };
  if ("horizontal" in padding)
    return { top: padding.vertical, right: padding.horizontal, bottom: padding.vertical, left: padding.horizontal };
  return { top: padding.top, right: padding.right, bottom: padding.bottom, left: padding.left };
}
function normalizeLayout(input) {
  const result = { type: input.type };
  if (input.gap !== undefined)
    result.gap = input.gap;
  if (input.padding !== undefined)
    result.padding = normalizePadding(input.padding);
  if (input.justify !== undefined)
    result.justify = input.justify;
  if (input.align !== undefined)
    result.align = input.align;
  return result;
}
function mainAxisOffsets(count, gap, remaining, justify) {
  if (count === 0)
    return [];
  if (count === 1) {
    if (justify === "start" || justify === "space-between" || remaining < 0)
      return [0];
    if (justify === "end")
      return [remaining];
    return [remaining / 2];
  }
  if (remaining < 0)
    return range(count, (index) => index * gap);
  switch (justify) {
    case "start":
      return range(count, (index) => index * gap);
    case "center":
      return range(count, (index) => index * gap + remaining / 2);
    case "end":
      return range(count, (index) => index * gap + remaining);
    case "space-between":
      return range(count, (index) => index * (gap + remaining / (count - 1)));
    case "space-around":
      return range(count, (index) => remaining / (2 * count) + index * (gap + remaining / count));
    case "space-evenly":
      return range(count, (index) => remaining / (count + 1) + index * (gap + remaining / (count + 1)));
  }
}
var ELEMENT_KEYS = {
  text: new Set(["kind", "id", "rect", "text", "visible", "enabled", "focusable", "style", "inheritStyle"]),
  button: new Set(["kind", "id", "rect", "text", "icon", "component", "visible", "enabled", "focusable", "style", "inheritStyle", "action"]),
  textInput: new Set(["kind", "id", "rect", "text", "visible", "enabled", "focusable", "style", "inheritStyle", "action", "value"]),
  image: new Set(["kind", "id", "rect", "source", "visible", "enabled", "style", "inheritStyle"]),
  container: new Set(["kind", "id", "rect", "layout", "elements", "visible", "enabled", "style", "inheritStyle", "groupHover", "text", "action"])
};
var LAYOUT_KEYS = new Set(["type", "gap", "padding", "justify", "align"]);
var PADDING_KEYS = new Set(["top", "right", "bottom", "left"]);
var RECT_KEYS = new Set(["x", "y", "width", "height"]);
var LAYOUT_TYPES = new Set(["absolute", "horizontal", "vertical"]);
var JUSTIFIES = new Set(["start", "center", "end", "space-between", "space-around", "space-evenly"]);
var ALIGNS = new Set(["start", "center", "end", "stretch"]);
function validateUiSettings(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings))
    throw new Error("Invalid UI settings");
  const value = settings;
  if (value.schemaVersion !== 1 || typeof value.id !== "string" || !value.size || !isRecord3(value.size) || !positive(Number(value.size.width)) || !positive(Number(value.size.height)) || !Array.isArray(value.screens) || typeof value.activeScreen !== "string" || !Array.isArray(value.history))
    throw new Error("Invalid UI settings");
  const screenIds = new Set;
  const seenScreens = new WeakSet;
  for (const screen of value.screens) {
    if (!isRecord3(screen))
      throw new Error("Invalid UI screen");
    if (typeof screen.id !== "string" || screen.id.length === 0 || screenIds.has(screen.id))
      throw new Error("Invalid UI screen");
    if (seenScreens.has(screen))
      throw new Error("Invalid UI screen");
    seenScreens.add(screen);
    for (const key of Object.keys(screen))
      if (key !== "id" && key !== "layout" && key !== "visible" && key !== "elements")
        throw new Error("Invalid UI screen");
    if (screen.layout !== undefined)
      validateLayout(screen.layout, `screen "${screen.id}"`);
    if (screen.visible !== undefined && typeof screen.visible !== "boolean")
      throw new Error("Invalid UI screen");
    if (!Array.isArray(screen.elements))
      throw new Error("Invalid UI screen");
    screenIds.add(screen.id);
  }
  for (const screen of value.screens) {
    const elementIds = new Set;
    const ancestors = new WeakSet;
    for (const element of screen.elements)
      validateElement(element, elementIds, screenIds, `screen "${screen.id}"`, ancestors, true);
  }
  if (!screenIds.has(value.activeScreen))
    throw new Error("UI active screen is missing");
  if (value.history.some((id) => typeof id !== "string" || !screenIds.has(id)))
    throw new Error("UI navigation history references an unknown screen");
  if (value.theme !== undefined)
    assertJsonValue(value.theme);
  if (!value.framework || !isRecord3(value.framework))
    throw new Error("UI framework is required");
  const expected = createDefaultUiFramework().systemOrder;
  if (!Array.isArray(value.framework.systemOrder) || value.framework.systemOrder.join("|") !== expected.join("|"))
    throw new Error("Unsupported UI framework order");
}
function validateElement(value, ids, screenIds, path, ancestors, requireScreenTargets) {
  if (!isRecord3(value))
    throw invalidElement(path, "malformed element");
  if (ancestors.has(value))
    throw invalidElement(path, "cyclic element tree");
  ancestors.add(value);
  try {
    const kind = value.kind;
    if (typeof value.id !== "string" || value.id.length === 0)
      throw invalidElement(path, "missing or invalid id");
    if (kind !== "button" && kind !== "text" && kind !== "textInput" && kind !== "image" && kind !== "container")
      throw invalidElement(path, `unsupported element kind '${String(kind)}'`);
    const allowed = ELEMENT_KEYS[kind];
    for (const key of Object.keys(value))
      if (!allowed.has(key))
        throw invalidElement(path, `unknown field '${key}'`);
    const id = value.id;
    if (ids.has(id))
      throw invalidElement(path, `duplicate element id '${id}'`);
    ids.add(id);
    const childPath = `${path} > ${kind} "${id}"`;
    validateRect(value.rect, childPath);
    if (value.visible !== undefined && typeof value.visible !== "boolean")
      throw invalidElement(childPath, "invalid visible state");
    if (value.enabled !== undefined && typeof value.enabled !== "boolean")
      throw invalidElement(childPath, "invalid enabled state");
    if (value.style !== undefined && typeof value.style !== "string")
      throw invalidElement(childPath, "invalid style");
    if (value.inheritStyle !== undefined && typeof value.inheritStyle !== "boolean")
      throw invalidElement(childPath, "invalid inheritStyle");
    if (value.groupHover !== undefined && typeof value.groupHover !== "boolean")
      throw invalidElement(childPath, "invalid groupHover");
    if (value.text !== undefined && typeof value.text !== "string")
      throw invalidElement(childPath, "invalid text");
    if (kind === "container" && value.action !== undefined)
      validateAction(value.action, screenIds, childPath, requireScreenTargets);
    if (kind === "container") {
      if (value.layout === undefined)
        throw invalidElement(childPath, "missing layout");
      validateLayout(value.layout, childPath);
      if (!Array.isArray(value.elements))
        throw invalidElement(childPath, "missing elements");
      for (const child of value.elements)
        validateElement(child, ids, screenIds, childPath, ancestors, requireScreenTargets);
    } else if (kind === "image") {
      if (typeof value.source !== "string" || value.source.length === 0)
        throw invalidElement(childPath, "invalid image source");
    } else {
      if (typeof value.text !== "string")
        throw invalidElement(childPath, "invalid text");
      if (value.icon !== undefined && (typeof value.icon !== "string" || value.icon.length === 0))
        throw invalidElement(childPath, "invalid icon");
      if (value.component !== undefined)
        validateUiComponent(value.component, `${childPath}.component`);
      if (value.focusable !== undefined && typeof value.focusable !== "boolean")
        throw invalidElement(childPath, "invalid focusable state");
      if (kind === "textInput" && value.value !== undefined && typeof value.value !== "string")
        throw invalidElement(childPath, "invalid value");
      if (value.action !== undefined)
        validateAction(value.action, screenIds, childPath, requireScreenTargets);
    }
  } finally {
    ancestors.delete(value);
  }
}
function validateUiComponent(value, path = "component") {
  if (!isRecord3(value) || value.type !== "image" || typeof value.source !== "string" || value.source.length === 0 || Object.keys(value).some((key) => key !== "type" && key !== "source"))
    throw new Error(`Invalid ${path}`);
}
function validateLayout(value, path) {
  if (!isRecord3(value))
    throw invalidElement(path, "invalid layout");
  if (typeof value.type !== "string" || !LAYOUT_TYPES.has(value.type))
    throw invalidElement(path, "invalid layout type");
  for (const key of Object.keys(value))
    if (!LAYOUT_KEYS.has(key))
      throw invalidElement(path, `unknown layout field '${key}'`);
  if (value.type === "absolute" && (value.gap !== undefined || value.justify !== undefined || value.align !== undefined))
    throw invalidElement(path, "absolute layout must not declare flow fields");
  if (value.gap !== undefined && (typeof value.gap !== "number" || !Number.isFinite(value.gap) || value.gap < 0))
    throw invalidElement(path, "invalid gap");
  if (value.padding !== undefined)
    validatePadding(value.padding, path);
  if (value.justify !== undefined && !JUSTIFIES.has(value.justify))
    throw invalidElement(path, "invalid justification");
  if (value.align !== undefined && !ALIGNS.has(value.align))
    throw invalidElement(path, "invalid alignment");
}
function validatePadding(value, path) {
  if (typeof value === "number") {
    if (Number.isFinite(value) && value >= 0)
      return;
    throw invalidElement(path, "invalid padding");
  }
  if (!isRecord3(value))
    throw invalidElement(path, "invalid padding");
  for (const key of Object.keys(value))
    if (!PADDING_KEYS.has(key))
      throw invalidElement(path, "invalid padding");
  for (const side of PADDING_KEYS)
    if (typeof value[side] !== "number" || !Number.isFinite(value[side]) || value[side] < 0)
      throw invalidElement(path, "invalid padding");
}
function validateRect(value, path) {
  if (!isRecord3(value))
    throw invalidElement(path, "invalid rect");
  for (const key of Object.keys(value))
    if (!RECT_KEYS.has(key))
      throw invalidElement(path, "invalid rect");
  for (const key of RECT_KEYS)
    if (typeof value[key] !== "number" || !Number.isFinite(value[key]))
      throw invalidElement(path, "invalid rect");
  if (value.width < 0 || value.height < 0)
    throw invalidElement(path, "negative size");
}
function validateAction(action, screenIds, path, requireScreenTargets) {
  if (action.type === "navigate" && requireScreenTargets && !screenIds.has(action.target))
    throw invalidElement(path, "UI navigation target is missing");
  if (action.type === "emit" && (!action.command || typeof action.command !== "string"))
    throw invalidElement(path, "Invalid UI command");
  if (action.type === "emitValues" && (!action.command || !Array.isArray(action.targets) || action.targets.some((target) => typeof target !== "string")))
    throw invalidElement(path, "Invalid UI value command");
  if (action.type === "setEnabled" && (typeof action.target !== "string" || typeof action.enabled !== "boolean"))
    throw invalidElement(path, "Invalid UI enabled action");
  if (action.type === "setText" && (typeof action.target !== "string" || typeof action.text !== "string"))
    throw invalidElement(path, "Invalid UI text action");
  assertJsonValue(action);
}
function invalidElement(path, reason) {
  return new Error(`Invalid UI element in ${path}: ${reason}`);
}
var ui = {
  createMenu(options) {
    return new UiMenuBuilder(options.id, options.size);
  },
  fromSettings(settings) {
    return UiRuntime.fromSettings(settings);
  },
  createDefaultFramework: createDefaultUiFramework,
  validate: validateUiSettings,
  screen(settings) {
    const input = clone5(settings);
    const result = { id: input.id, elements: input.elements.map((element) => clone5(element)) };
    if (input.layout !== undefined)
      result.layout = normalizeLayout(input.layout);
    if (input.visible !== undefined)
      result.visible = input.visible;
    return result;
  },
  button(settings) {
    if (settings.component)
      validateUiComponent(settings.component);
    return { ...clone5(settings), kind: "button", focusable: settings.focusable ?? true };
  },
  text(settings) {
    return { ...clone5(settings), kind: "text", focusable: false };
  },
  textInput(settings) {
    return { ...clone5(settings), kind: "textInput", focusable: true, value: settings.value ?? settings.text };
  },
  image(settings) {
    return { ...clone5(settings), kind: "image" };
  },
  component: {
    image(source) {
      const component = { type: "image", source };
      validateUiComponent(component);
      return component;
    }
  },
  container(settings) {
    let input;
    try {
      input = clone5(settings);
    } catch (error) {
      throw new Error(`UI container input must be acyclic JSON data: ${error instanceof Error ? error.message : String(error)}`);
    }
    const result = {
      kind: "container",
      id: input.id,
      rect: clone5(input.rect),
      layout: normalizeLayout(input.layout ?? { type: "absolute" }),
      elements: [
        ...input.text === undefined ? [] : [{ kind: "text", id: `${input.id}__text`, text: input.text, rect: { x: 0, y: 0, width: input.rect.width, height: input.rect.height }, focusable: false }],
        ...input.elements.map((element) => clone5(element))
      ]
    };
    if (input.visible !== undefined)
      result.visible = input.visible;
    if (input.enabled !== undefined)
      result.enabled = input.enabled;
    if (input.style !== undefined)
      result.style = input.style;
    if (input.inheritStyle !== undefined)
      result.inheritStyle = input.inheritStyle;
    if (input.groupHover !== undefined)
      result.groupHover = input.groupHover;
    if (input.text !== undefined)
      result.text = input.text;
    if (input.action !== undefined)
      result.action = clone5(input.action);
    const ids = new Set;
    validateElement(result, ids, new Set, `container "${input.id}"`, new WeakSet, false);
    return result;
  },
  layout: {
    absolute(options = {}) {
      return normalizeLayout({ type: "absolute", ...options });
    },
    horizontal(options = {}) {
      return normalizeLayout({ type: "horizontal", ...options });
    },
    vertical(options = {}) {
      return normalizeLayout({ type: "vertical", ...options });
    }
  },
  action: {
    navigate(target) {
      return { type: "navigate", target };
    },
    back() {
      return { type: "back" };
    },
    emit(command, payload) {
      return { type: "emit", command, ...payload === undefined ? {} : { payload } };
    },
    emitValues(command, targets) {
      return { type: "emitValues", command, targets: [...targets] };
    },
    setEnabled(target, enabled) {
      return { type: "setEnabled", target, enabled };
    },
    setText(target, text) {
      return { type: "setText", target, text };
    }
  },
  types: { containsPoint(rect, point) {
    return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
  } }
};
export {
  validateUiSettings,
  validateUiComponent,
  ui,
  createDefaultUiFramework,
  UiRuntime,
  UiMenuBuilder
};
