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
      this.screens.set(screen.id, { settings: clone2(screen), elements: screen.elements.map(createNode) });
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
    const screens = [...this.screens.values()].map((screen) => ({ ...clone2(screen.settings), elements: screen.elements.map((node) => node.toSettings()) }));
    return { ...clone2(this.settings), activeScreen: this.activeScreen, history: [...this.history], screens };
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
  getHoveredElementId() {
    return this.hovered;
  }
  getPressedTargetId() {
    return this.pendingPress;
  }
  dispatch(action) {
    validateAction(action, new Set(this.screens.keys()), "action", true);
    this.applyAction(clone2(action));
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
    element.action = action ? clone2(action) : undefined;
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
  drainCommands() {
    const commands = this.emitted.map(clone2);
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
    if (target && input.pressed && "pressed" in target)
      target.pressed = true;
    if (input.justPressed)
      this.pendingPress = target?.id;
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
    const found = this.findLeaf(this.pendingPress);
    if (found && hasPressable(found.element) && found.enabled && found.visible && found.element.action)
      this.pendingActions.push(clone2(found.element.action));
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
      this.emitted.push({ command: action.command, ...action.payload === undefined ? {} : { payload: clone2(action.payload) } });
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
    for (const node of nodes) {
      const visible = node.visible && parentVisible;
      const enabled = node.enabled && parentEnabled;
      if (isContainerNode(node)) {
        const hit = this.findPointerTarget(point, node.elements, visible, enabled);
        if (hit)
          return hit;
        continue;
      }
      if (visible && enabled && node.containsPoint(point))
        return node;
    }
    return;
  }
  findLeaf(id, nodes = this.activeScreenNodes(), parentVisible = true, parentEnabled = true) {
    for (const node of nodes) {
      const visible = node.visible && parentVisible;
      const enabled = node.enabled && parentEnabled;
      if (isContainerNode(node)) {
        const found = this.findLeaf(id, node.elements, visible, enabled);
        if (found)
          return found;
        continue;
      }
      if (node.id === id)
        return { element: node, visible, enabled };
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
  constructor(settings) {
    this.settings = settings;
    this.localRect = clone2(settings.rect);
    this.visible = settings.visible ?? true;
    this.enabled = settings.enabled ?? true;
    this.focused = false;
    this.hovered = false;
    this.pressed = false;
    this.value = "value" in settings ? settings.value ?? settings.text : ("text" in settings) ? settings.text : "";
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
  get source() {
    return this.settings.kind === "image" ? this.settings.source : undefined;
  }
  get style() {
    return this.settings.style;
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
    const base = { ...clone2(this.settings), rect: clone2(this.localRect), text: this.text, visible: this.visible, enabled: this.enabled };
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
  constructor(settings) {
    this.settings = settings;
    this.localRect = clone2(settings.rect);
    this.visible = settings.visible ?? true;
    this.enabled = settings.enabled ?? true;
    this.layout = clone2(settings.layout);
    this.elements = settings.elements.map(createNode);
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
    return this.settings.style;
  }
  containsPoint(point) {
    return point.x >= this.rect.x && point.x <= this.rect.x + this.rect.width && point.y >= this.rect.y && point.y <= this.rect.y + this.rect.height;
  }
  toSettings() {
    return { ...clone2(this.settings), rect: clone2(this.localRect), visible: this.visible, enabled: this.enabled, elements: this.elements.map((node) => node.toSettings()) };
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
    this.screens.push(clone2(screen));
    return this;
  }
  useFramework(framework) {
    this.framework = clone2(framework);
    return this;
  }
  build() {
    const settings = { schemaVersion: 1, id: this.id, size: clone2(this.size), activeScreen: this.screens[0]?.id ?? "", history: [], screens: clone2(this.screens), framework: clone2(this.framework) };
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
function createNode(settings) {
  const cloned = clone2(settings);
  return cloned.kind === "container" ? new UiContainer(cloned) : new UiElement(cloned);
}
function isContainerNode(node) {
  return node.kind === "container";
}
function hasFocusable(value) {
  return "focused" in value && value.kind !== "text";
}
function hasPressable(value) {
  return value.kind === "button";
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
function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function clone2(value) {
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
  text: new Set(["kind", "id", "rect", "text", "visible", "enabled", "focusable", "style"]),
  button: new Set(["kind", "id", "rect", "text", "icon", "visible", "enabled", "focusable", "style", "action"]),
  textInput: new Set(["kind", "id", "rect", "text", "visible", "enabled", "focusable", "style", "action", "value"]),
  image: new Set(["kind", "id", "rect", "source", "visible", "enabled", "style"]),
  container: new Set(["kind", "id", "rect", "layout", "elements", "visible", "enabled", "style"])
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
  if (value.schemaVersion !== 1 || typeof value.id !== "string" || !value.size || !isRecord(value.size) || !positive(Number(value.size.width)) || !positive(Number(value.size.height)) || !Array.isArray(value.screens) || typeof value.activeScreen !== "string" || !Array.isArray(value.history))
    throw new Error("Invalid UI settings");
  const screenIds = new Set;
  const seenScreens = new WeakSet;
  for (const screen of value.screens) {
    if (!isRecord(screen))
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
  if (!value.framework || !isRecord(value.framework))
    throw new Error("UI framework is required");
  const expected = createDefaultUiFramework().systemOrder;
  if (!Array.isArray(value.framework.systemOrder) || value.framework.systemOrder.join("|") !== expected.join("|"))
    throw new Error("Unsupported UI framework order");
}
function validateElement(value, ids, screenIds, path, ancestors, requireScreenTargets) {
  if (!isRecord(value))
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
function validateLayout(value, path) {
  if (!isRecord(value))
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
  if (!isRecord(value))
    throw invalidElement(path, "invalid padding");
  for (const key of Object.keys(value))
    if (!PADDING_KEYS.has(key))
      throw invalidElement(path, "invalid padding");
  for (const side of PADDING_KEYS)
    if (typeof value[side] !== "number" || !Number.isFinite(value[side]) || value[side] < 0)
      throw invalidElement(path, "invalid padding");
}
function validateRect(value, path) {
  if (!isRecord(value))
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
    const input = clone2(settings);
    const result = { id: input.id, elements: input.elements.map((element) => clone2(element)) };
    if (input.layout !== undefined)
      result.layout = normalizeLayout(input.layout);
    if (input.visible !== undefined)
      result.visible = input.visible;
    return result;
  },
  button(settings) {
    return { ...clone2(settings), kind: "button", focusable: settings.focusable ?? true };
  },
  text(settings) {
    return { ...clone2(settings), kind: "text", focusable: false };
  },
  textInput(settings) {
    return { ...clone2(settings), kind: "textInput", focusable: true, value: settings.value ?? settings.text };
  },
  image(settings) {
    return { ...clone2(settings), kind: "image" };
  },
  container(settings) {
    let input;
    try {
      input = clone2(settings);
    } catch (error) {
      throw new Error(`UI container input must be acyclic JSON data: ${error instanceof Error ? error.message : String(error)}`);
    }
    const result = {
      kind: "container",
      id: input.id,
      rect: clone2(input.rect),
      layout: normalizeLayout(input.layout ?? { type: "absolute" }),
      elements: input.elements.map((element) => clone2(element))
    };
    if (input.visible !== undefined)
      result.visible = input.visible;
    if (input.enabled !== undefined)
      result.enabled = input.enabled;
    if (input.style !== undefined)
      result.style = input.style;
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
  ui,
  createDefaultUiFramework,
  UiRuntime,
  UiMenuBuilder
};
