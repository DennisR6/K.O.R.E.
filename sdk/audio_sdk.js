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
export {
  validateAudioSettings,
  validateAudioCommand,
  validateAudioBatch,
  validateApplicationAudioSettings,
  createDefaultAudioFramework,
  createAudioSettings,
  createAudioRuntime,
  audio,
  SoundSystem,
  AudioRuntime,
  AudioEmitter,
  ApplicationAudioMixer
};
