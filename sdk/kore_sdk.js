class EffectModifySetting {
  settings;
  constructor({ typeValue }) {
    this.settings = typeValue;
  }
  apply(entity, override) {
    if (!isSettingMutable(entity))
      return;
    const settings = override ?? this.settings;
    switch (settings.operation) {
      case "set":
        entity.setSetting(settings.key, settings.value);
        break;
      case "add":
        entity.addSetting(settings.key, settings.value);
        break;
      case "remove":
        entity.removeSetting(settings.key, settings.value);
        break;
    }
  }
  getType() {
    return "EffectType.ModifySetting" /* ModifySetting */;
  }
  toSettings() {
    return {
      type: "EffectType.ModifySetting" /* ModifySetting */,
      typeValue: { ...this.settings }
    };
  }
}
function isSettingMutable(entity) {
  return "setSetting" in entity && "addSetting" in entity && "removeSetting" in entity;
}

class EffectDamage {
  damage;
  constructor({ typeValue }) {
    this.damage = typeValue.damage;
  }
  getType() {
    return "EffectType.Damage" /* Damage */;
  }
  apply(entity, override) {
    let dmg = this.damage;
    if (override)
      dmg = override.damage;
    new EffectModifySetting({ typeValue: { operation: "add" /* Add */, key: "hp", value: -dmg } }).apply(entity);
  }
  toSettings() {
    return { typeValue: { damage: this.damage }, type: "EffectType.Damage" /* Damage */ };
  }
}

class EffectModifyMass {
  mass;
  constructor({ typeValue }) {
    this.mass = typeValue.mass;
  }
  apply(entity, override) {
    let mass = this.mass;
    if (override) {
      mass = this.mass === 0 ? override.mass : mass;
    }
    entity.setMass(mass);
  }
  getType() {
    return "EffectType.ModifyMass" /* ModifyMass */;
  }
  toSettings() {
    return {
      type: "EffectType.ModifyMass" /* ModifyMass */,
      typeValue: { mass: this.mass }
    };
  }
}

class EffectModifyPosition {
  x;
  y;
  constructor({ typeValue }) {
    this.x = typeValue.x;
    this.y = typeValue.y;
  }
  apply(entity, override) {
    let posX = this.x;
    let posY = this.y;
    if (override) {
      posX = this.x === 0 ? override.x : posX;
      posY = this.y === 0 ? override.y : posY;
    }
    entity.setPos({ x: posX, y: posY });
  }
  getType() {
    return "EffectType.Position" /* Position */;
  }
  toSettings() {
    return {
      type: "EffectType.Position" /* Position */,
      typeValue: {
        x: this.x,
        y: this.y
      }
    };
  }
}

class EffectModifySize {
  size;
  constructor({ typeValue }) {
    this.size = typeValue.size;
  }
  isResizable(entity) {
    return entity !== null && typeof entity === "object" && "setSize" in entity && typeof entity.setSize === "function";
  }
  apply(entity, override) {
    let size = this.size;
    if (override) {
      size = this.size === 0 ? override.size : size;
    }
    if (this.isResizable(entity)) {
      entity.setSize(size);
    } else {
      console.warn("Dieses Objekt besitzt keine veränderbare Größe.");
    }
  }
  getType() {
    return "EffectType.ModifySize" /* ModifySize */;
  }
  toSettings() {
    return {
      type: "EffectType.ModifySize" /* ModifySize */,
      typeValue: {
        size: this.size
      }
    };
  }
}

class EffectModifyTeam {
  team;
  constructor({ typeValue }) {
    this.team = typeValue.team;
  }
  hasTeam(entity) {
    return entity !== null && typeof entity === "object" && "setTeam" in entity && typeof entity.setTeam === "function";
  }
  apply(entity, override) {
    let newTeam = this.team;
    if (override) {
      newTeam = this.team.length === 0 ? override.team : newTeam;
    }
    if (this.hasTeam(entity)) {
      entity.setTeam(newTeam);
    } else {
      console.warn("Dieses Objekt unterstützt keine Team-Zugehörigkeit.");
    }
  }
  getType() {
    return "EffectType.Team" /* Team */;
  }
  toSettings() {
    return {
      type: "EffectType.Team" /* Team */,
      typeValue: {
        team: this.team
      }
    };
  }
}

class EffectModifyVelocity {
  x;
  y;
  constructor({ typeValue }) {
    this.x = typeValue.x;
    this.y = typeValue.y;
  }
  apply(entity, override) {
    let velX = this.x;
    let velY = this.y;
    if (override) {
      velX = this.x === 0 ? override.x : velX;
      velY = this.y === 0 ? override.y : velY;
    }
    entity.setVel({ x: velX, y: velY });
  }
  getType() {
    return "EffectType.Velocity" /* Velocity */;
  }
  toSettings() {
    return {
      type: "EffectType.Velocity" /* Velocity */,
      typeValue: {
        x: this.x,
        y: this.y
      }
    };
  }
}

var PHYSICS_CONTACT_SLOP = 0.05;
var PHYSICS_CONTACT_PERCENT = 0.2;
var MAX_CONTACT_SOLVER_ITERATIONS = 16;
var CCD_MAX_STEP_SIZE = 4;
var MAX_CCD_SUBSTEPS = 16;
function forwardVectorFromRotation(rotation) {
  const radians = rotation * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}
function isStructureCollisionRole(value) {
  return value === "solid" || value === "containment" || value === "both";
}
function getShapeName(input) {
  switch (input) {
    case 0 /* CIRCLE */:
      return "circle";
    case 2 /* RECTANGLE */:
      return "rectangle";
    case 1 /* LINE */:
      return "line";
    default:
      return "TODO";
  }
}

class EffectMove {
  x = 0;
  y = 0;
  dt = 0;
  constructor({ typeValue }) {
    this.dt = typeValue.deltaTime;
    this.x = typeValue.x;
    this.y = typeValue.y;
  }
  apply(entity, override) {
    let vx = this.x;
    let vy = this.y;
    let dt = this.dt;
    if (override) {
      dt = this.dt !== 0 ? this.dt : override.deltaTime;
      vx = this.x !== 0 ? this.x : override.x;
      vy = this.y !== 0 ? this.y : override.y;
    }
    if (override?.rotation !== undefined && override.drift !== undefined) {
      const speed = Math.hypot(vx, vy);
      if (speed > (override.stopThreshold ?? 0) && override.drift > 0) {
        const forward = forwardVectorFromRotation(override.rotation);
        const blend = {
          x: vx / speed * (1 - override.drift) + forward.x * override.drift,
          y: vy / speed * (1 - override.drift) + forward.y * override.drift
        };
        const blendLength = Math.hypot(blend.x, blend.y);
        const direction = blendLength === 0 ? forward : { x: blend.x / blendLength, y: blend.y / blendLength };
        vx = direction.x * speed;
        vy = direction.y * speed;
        entity.setVel({ x: vx, y: vy });
      }
    }
    const { x, y } = entity.getPos();
    entity.setPos({
      x: x + vx * dt,
      y: y + vy * dt
    });
  }
  getType() {
    return "EffectType.Movement" /* Movement */;
  }
  toSettings() {
    return { type: "EffectType.Movement" /* Movement */, typeValue: { deltaTime: this.dt, x: this.x, y: this.y } };
  }
}

class defaultPhysics {
  friction;
  linearDrag;
  stopThreshold;
  constructor(settings) {
    const defaults = this.getDefaults();
    this.friction = settings?.friction ?? defaults.friction;
    this.linearDrag = settings?.linearDrag ?? defaults.linearDrag;
    this.stopThreshold = settings?.stopThreshold ?? defaults.stopThreshold;
  }
  getDefaults() {
    return {
      friction: 0.995,
      linearDrag: 0.01,
      stopThreshold: 0.1
    };
  }
  calculateBounce(vel, normal) {
    const n = this.normalize(normal);
    const dot = this.dot(vel, normal);
    return this.sub(vel, this.mult(n, 2 * dot));
  }
  add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
  }
  sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
  }
  mult(a, scalar) {
    return { x: a.x * scalar, y: a.y * scalar };
  }
  dot(a, b) {
    return a.x * b.x + a.y * b.y;
  }
  magSq(v) {
    return v.x * v.x + v.y * v.y;
  }
  mag(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }
  normalize(v) {
    const m = Math.sqrt(v.x * v.x + v.y * v.y);
    return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
  }
  dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  distSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }
  clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }
  checkCollision(entityA, entityB) {
    switch (true) {
      case (entityA.getShape() == 0 /* CIRCLE */ && entityB.getShape() == 0 /* CIRCLE */):
        return this.checkCollisionCircles(entityA, entityB);
      case (entityA.getShape() == 2 /* RECTANGLE */ && entityB.getShape() == 2 /* RECTANGLE */):
        return this.checkCollisionRects(entityA, entityB);
      case (entityA.getShape() == 0 /* CIRCLE */ && entityB.getShape() == 2 /* RECTANGLE */):
        return this.checkCollisionCircleRect(entityA, entityB);
      case (entityA.getShape() == 0 /* CIRCLE */ && entityB.getShape() == 1 /* LINE */):
        return this.checkCollisionCircleLine(entityA, entityB);
      case (entityA.getShape() == 1 /* LINE */ && entityB.getShape() == 0 /* CIRCLE */):
        return this.checkCollisionCircleLine(entityB, entityA);
      default:
        console.log(`Collision not implemented for ${getShapeName(entityA.getShape())} ${getShapeName(entityB.getShape())}`);
    }
    return false;
  }
  checkCollisionCircles(entityA, entityB) {
    const d2 = this.distSq(entityA.getPos(), entityB.getPos());
    const rSum = entityA.getBounds().x + entityB.getBounds().x;
    return d2 <= rSum * rSum;
  }
  checkCollisionRects(entityA, entityB) {
    const { x: Ax, y: Ay } = entityA.getPos();
    const { x: Bx, y: By } = entityB.getPos();
    return Ax <= Bx + entityB.getBounds().x && Ax + entityA.getBounds().x >= Bx && Ay <= By + entityB.getBounds().y && Ay + entityA.getBounds().y >= By;
  }
  checkCollisionCircleRect(entityA, entityB) {
    const { x: Ax, y: Ay } = entityA.getPos();
    const { x: Bx, y: By } = entityB.getPos();
    const closest = {
      x: this.clamp(Ax, Bx, Bx + entityB.getBounds().x),
      y: this.clamp(Ay, By, By + entityB.getBounds().y)
    };
    const d2 = this.distSq(entityA.getPos(), closest);
    return d2 <= entityA.getBounds().x * entityA.getBounds().x;
  }
  checkCollisionCircleLine(circle, line) {
    return this.distSq(circle.getPos(), this.closestPointOnLine(circle, line)) <= circle.getBounds().x ** 2;
  }
  handleCollision(entityA, entityB) {
    const posA = { ...entityA.getPos() };
    const posB = { ...entityB.getPos() };
    if (!Number.isFinite(posA.x) || !Number.isFinite(posA.y) || !Number.isFinite(posB.x) || !Number.isFinite(posB.y)) {
      return;
    }
    const dist = this.dist(posA, posB);
    switch (true) {
      case (entityA.getShape() === 0 /* CIRCLE */ && entityB.getShape() === 0 /* CIRCLE */): {
        const radiusA = entityA.getBounds().x;
        const radiusB = entityB.getBounds().x;
        const combinedRadius = radiusA + radiusB;
        let nx;
        let ny;
        let overlap;
        if (dist === 0) {
          nx = 1;
          ny = 0;
          overlap = combinedRadius;
        } else {
          nx = (posB.x - posA.x) / dist;
          ny = (posB.y - posA.y) / dist;
          overlap = combinedRadius - dist;
        }
        if (overlap > 0) {
          const invMassA = entityA.getMass() === Infinity ? 0 : 1 / entityA.getMass();
          const invMassB = entityB.getMass() === Infinity ? 0 : 1 / entityB.getMass();
          const totalInvMass = invMassA + invMassB;
          if (totalInvMass > 0) {
            const slop = PHYSICS_CONTACT_SLOP;
            const percent = PHYSICS_CONTACT_PERCENT;
            const moveMagnitude = Math.max(overlap - slop, 0) / totalInvMass * percent;
            const moveA = moveMagnitude * invMassA;
            const moveB = moveMagnitude * invMassB;
            entityA.setPos({ x: posA.x - nx * moveA, y: posA.y - ny * moveA });
            entityB.setPos({ x: posB.x + nx * moveB, y: posB.y + ny * moveB });
            const velA = entityA.getVel();
            const velB = entityB.getVel();
            const relVelX = velB.x - velA.x;
            const relVelY = velB.y - velA.y;
            const dotProduct = relVelX * nx + relVelY * ny;
            if (dotProduct < 0) {
              const restitution = Math.min(entityA.getBounceFactor(), entityB.getBounceFactor());
              const impulseMag = -(1 + restitution) * dotProduct / totalInvMass;
              entityA.setVel({
                x: velA.x - impulseMag * nx * invMassA,
                y: velA.y - impulseMag * ny * invMassA
              });
              entityB.setVel({
                x: velB.x + impulseMag * nx * invMassB,
                y: velB.y + impulseMag * ny * invMassB
              });
            }
          }
        }
        entityA.onCollision({ entity: entityB });
        entityB.onCollision({ entity: entityA });
        break;
      }
      case (entityA.getShape() === 0 /* CIRCLE */ && entityB.getShape() === 1 /* LINE */):
      case (entityA.getShape() === 1 /* LINE */ && entityB.getShape() === 0 /* CIRCLE */): {
        const circle = entityA.getShape() === 0 /* CIRCLE */ ? entityA : entityB;
        const line = entityA.getShape() === 1 /* LINE */ ? entityA : entityB;
        const closest = this.closestPointOnLine(circle, line);
        const position = circle.getPos();
        const normal = this.sub(position, closest);
        const distance = this.mag(normal);
        const radius = circle.getBounds().x;
        if (distance >= radius)
          break;
        let unitNormal;
        if (distance === 0) {
          const start = line.getPos();
          const end = line.getBounds();
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const length = Math.hypot(dx, dy);
          unitNormal = { x: -dy / length, y: dx / length };
        } else {
          unitNormal = this.mult(normal, 1 / distance);
        }
        circle.setPos(this.add(closest, this.mult(unitNormal, radius)));
        const velocity = circle.getVel();
        const normalVelocity = this.dot(velocity, unitNormal);
        if (normalVelocity < 0) {
          const restitution = Math.min(circle.getBounceFactor(), line.getBounceFactor());
          circle.setVel(this.sub(velocity, this.mult(unitNormal, (1 + restitution) * normalVelocity)));
        }
        circle.onCollision({ entity: line });
        line.onCollision({ entity: circle });
        break;
      }
      case (entityA.getShape() === 2 /* RECTANGLE */ && entityB.getShape() === 2 /* RECTANGLE */): {
        console.error("TODO! /phyics/defaultPhysics.ts", entityA.getShape(), entityB.getShape());
        break;
      }
      case (entityA.getShape() === 0 /* CIRCLE */ && entityB.getShape() === 2 /* RECTANGLE */):
      case (entityA.getShape() === 2 /* RECTANGLE */ && entityB.getShape() === 0 /* CIRCLE */): {
        const circle = entityA.getShape() === 0 /* CIRCLE */ ? entityA : entityB;
        const rectangle = entityA.getShape() === 2 /* RECTANGLE */ ? entityA : entityB;
        const cPos = circle.getPos();
        const rPos = rectangle.getPos();
        const rBounds = rectangle.getBounds();
        const radius = circle.getBounds().x;
        const closestX = Math.max(rPos.x, Math.min(cPos.x, rPos.x + rBounds.x));
        const closestY = Math.max(rPos.y, Math.min(cPos.y, rPos.y + rBounds.y));
        const dx = cPos.x - closestX;
        const dy = cPos.y - closestY;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq < radius * radius) {
          const distance = Math.sqrt(distanceSq);
          let nx;
          let ny;
          let overlap;
          if (distance > 0) {
            nx = dx / distance;
            ny = dy / distance;
            overlap = radius - distance;
          } else {
            const left = cPos.x - rPos.x;
            const right = rPos.x + rBounds.x - cPos.x;
            const top = cPos.y - rPos.y;
            const bottom = rPos.y + rBounds.y - cPos.y;
            if (left <= right && left <= top && left <= bottom) {
              nx = -1;
              ny = 0;
              overlap = left + radius;
            } else if (right <= top && right <= bottom) {
              nx = 1;
              ny = 0;
              overlap = right + radius;
            } else if (top <= bottom) {
              nx = 0;
              ny = -1;
              overlap = top + radius;
            } else {
              nx = 0;
              ny = 1;
              overlap = bottom + radius;
            }
          }
          const m1 = circle.getMass();
          const m2 = rectangle.getMass();
          const invM1 = 1 / m1;
          const invM2 = 1 / m2;
          const invMassSum = invM1 + invM2;
          const totalMove = overlap + 0.01;
          if (m2 === Infinity) {
            circle.setPos({
              x: cPos.x + nx * totalMove,
              y: cPos.y + ny * totalMove
            });
          } else {
            circle.setPos({
              x: cPos.x + nx * totalMove * (invM1 / invMassSum),
              y: cPos.y + ny * totalMove * (invM1 / invMassSum)
            });
            rectangle.setPos({
              x: rPos.x - nx * totalMove * (invM2 / invMassSum),
              y: rPos.y - ny * totalMove * (invM2 / invMassSum)
            });
          }
          if (distance > 0) {
            const v1 = circle.getVel();
            const v2 = rectangle.getVel();
            const relativeVelX = v1.x - v2.x;
            const relativeVelY = v1.y - v2.y;
            const dot = relativeVelX * nx + relativeVelY * ny;
            if (dot < 0) {
              const bounce = Math.min(circle.getBounceFactor(), rectangle.getBounceFactor());
              const maxImpulse = 50;
              const j = Math.max(Math.min(-(1 + bounce) * dot / invMassSum, maxImpulse), -maxImpulse);
              circle.setVel({
                x: v1.x + j * nx * invM1,
                y: v1.y + j * ny * invM1
              });
              if (m2 !== Infinity) {
                rectangle.setVel({
                  x: v2.x - j * nx * invM2,
                  y: v2.y - j * ny * invM2
                });
              }
            }
          }
          circle.setPos(circle.getPos());
          circle.setVel(circle.getVel());
          rectangle.setPos(rectangle.getPos());
          rectangle.setVel(rectangle.getVel());
          circle.onCollision({ entity: rectangle });
          rectangle.onCollision({ entity: circle });
        }
        break;
      }
    }
  }
  applyImpulse(entity, angle, power) {
    const mass = entity.getMass();
    if (mass === Infinity)
      return;
    const direction = forwardVectorFromRotation(angle);
    const force = this.mult(direction, power);
    const currentVel = entity.getVel();
    entity.setVel({
      x: currentVel.x + force.x / mass,
      y: currentVel.y + force.y / mass
    });
  }
  getFriction() {
    return this.friction;
  }
  getStopThreshold() {
    return this.stopThreshold;
  }
  applyFriction(entity, dt) {
    let { x: vx, y: vy } = entity.getVel();
    const f = Math.pow(this.friction, dt);
    vx *= f;
    vy *= f;
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > 0) {
      const newSpeed = Math.max(0, speed - this.linearDrag * dt);
      const factor = newSpeed / speed;
      vx *= factor;
      vy *= factor;
    }
    if (Math.sqrt(vx * vx + vy * vy) < this.stopThreshold) {
      vx = 0;
      vy = 0;
    }
    entity.setVel({ x: vx, y: vy });
  }
  printSettings(who) {
    console.info(who, "Set Physics to: ", { friction: this.friction, linearDrag: this.linearDrag, stopThreshold: this.stopThreshold });
  }
  calculateStopFromInput(startPos, angle, power) {
    const direction = forwardVectorFromRotation(angle);
    return this.calculateStop(startPos, this.mult(direction, power));
  }
  calculateStop(startPos, initialVel) {
    let x = startPos.x;
    let y = startPos.y;
    let vx = initialVel.x;
    let vy = initialVel.y;
    for (let i = 0;i < 2000; i++) {
      vx *= this.friction;
      vy *= this.friction;
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed < this.stopThreshold || speed === 0)
        break;
      const newSpeed = Math.max(0, speed - this.linearDrag);
      const factor = newSpeed / speed;
      vx *= factor;
      vy *= factor;
      x += vx;
      y += vy;
    }
    return { x, y };
  }
  toSettings() {
    return {
      friction: this.friction,
      linearDrag: this.linearDrag,
      stopThreshold: this.stopThreshold
    };
  }
  isStatic(entities) {
    const epsilon = 0.1;
    return entities.getEntities().every((e) => {
      const vel = e.getVel();
      return Math.abs(vel.x) < epsilon && Math.abs(vel.y) < epsilon;
    });
  }
  closestPointOnLine(circle, line) {
    const start = line.getPos();
    const end = line.getBounds();
    const segment = { x: end.x - start.x, y: end.y - start.y };
    const lengthSq = this.magSq(segment);
    const factor = lengthSq === 0 ? 0 : this.clamp(this.dot(this.sub(circle.getPos(), start), segment) / lengthSq, 0, 1);
    return this.add(start, this.mult(segment, factor));
  }
}

class EffectPhysics {
  friction;
  linearDrag;
  stopThreshold;
  physics;
  constructor({ typeValue }) {
    this.friction = typeValue.friction;
    this.linearDrag = typeValue.linearDrag;
    this.stopThreshold = typeValue.stopThreshold;
    this.friction = typeValue.friction;
    this.physics = new defaultPhysics(typeValue);
  }
  apply(entity, override) {
    let friction = this.friction;
    let dt = override?.dt ?? 1;
    if (override) {
      friction = this.friction === 0 ? override.friction : friction;
    }
    this.physics.applyFriction(entity, dt);
  }
  getType() {
    return "EffectType.Physics" /* Physics */;
  }
  toSettings() {
    return {
      type: "EffectType.Physics" /* Physics */,
      typeValue: {
        friction: this.friction,
        linearDrag: this.linearDrag,
        stopThreshold: this.stopThreshold
      }
    };
  }
}

function createRuntimeEffect(settings) {
  return new MetaEffect({ type: settings.type, typeValue: settings.typeValue });
}

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

var TRIGGER_KEYS = new Set(["trigger", "triggerValue"]);
function validateTriggerSettings(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Trigger settings must be an object");
  const trigger = value;
  for (const key of Object.keys(trigger))
    if (!TRIGGER_KEYS.has(key))
      throw new Error(`Trigger settings contain unknown field '${key}'`);
  if (trigger.trigger !== "EffectTrigger.Always" /* Always */ && trigger.trigger !== "EffectTrigger.Collision" /* Collision */ && trigger.trigger !== "EffectTrigger.Round" /* Round */)
    throw new Error(`Unknown effect trigger '${String(trigger.trigger)}'`);
  if (!Array.isArray(trigger.triggerValue) || trigger.triggerValue.length !== 0)
    throw new Error(`Trigger '${String(trigger.trigger)}' requires an empty payload`);
}

var CORE_EFFECT_KEYS = new Set(["type", "typeValue"]);
var FULL_EFFECT_KEYS = new Set(["type", "typeValue", "trigger", "triggerValue"]);
var ITEM_EFFECT_KEYS = new Set(["type", "typeValue", "itemId", "order"]);
var PLAYER_SETTING_KEYS = new Set(["hp", "mass", "size", "friction", "position", "velocity", "team", "dead", "physicsEnabled"]);
var CORE_EFFECT_TYPES = ["EffectType.Physics" /* Physics */, "EffectType.Damage" /* Damage */, "EffectType.Movement" /* Movement */, "EffectType.Multi" /* Multi */, "EffectType.ModifyMass" /* ModifyMass */, "EffectType.ModifySize" /* ModifySize */, "EffectType.Position" /* Position */, "EffectType.Velocity" /* Velocity */, "EffectType.Team" /* Team */, "EffectType.ModifySetting" /* ModifySetting */];
var ITEM_EFFECT_TYPES = ["modifyForce" /* ModifyForce */, "modifyRotation" /* ModifyRotation */, "lockRotation" /* LockRotation */, "applyTorque" /* ApplyTorque */, "spawnTrigger" /* SpawnTrigger */, "delayedEffect" /* DelayedEffect */, "shield" /* Shield */, "freeze" /* Freeze */, "swapPosition" /* SwapPosition */, "temporaryWall" /* TemporaryWall */, "ghostMode" /* GhostMode */, "magnet" /* Magnet */, "selectionLock" /* SelectionLock */, "aimVariance" /* AimVariance */];
function validateEffectSettings(value) {
  const effect = record(value, "Effect settings");
  knownKeys(effect, CORE_EFFECT_KEYS, "Effect settings");
  if (!CORE_EFFECT_TYPES.includes(effect.type))
    throw new Error(`Unknown effect type "${String(effect.type)}"`);
  if (effect.type === "EffectType.Multi" /* Multi */) {
    if (!Array.isArray(effect.typeValue))
      throw new Error("EffectType.Multi requires a typeValue array of effect settings");
    effect.typeValue.forEach(validateEffectSettings);
    return;
  }
  const payload = record(effect.typeValue, `Effect '${String(effect.type)}' payload`);
  switch (effect.type) {
    case "EffectType.Physics" /* Physics */:
      exactKeys(payload, ["friction", "linearDrag", "stopThreshold"], "Physics payload");
      finite(payload.friction, "Physics friction");
      finite(payload.linearDrag, "Physics linearDrag");
      finite(payload.stopThreshold, "Physics stopThreshold");
      return;
    case "EffectType.Damage" /* Damage */:
      exactKeys(payload, ["damage"], "Damage payload");
      finiteNonNegative(payload.damage, "Damage amount");
      return;
    case "EffectType.Movement" /* Movement */:
      exactKeys(payload, ["deltaTime", "x", "y"], "Movement payload");
      finite(payload.deltaTime, "Movement deltaTime");
      finite(payload.x, "Movement x");
      finite(payload.y, "Movement y");
      return;
    case "EffectType.ModifyMass" /* ModifyMass */:
      exactKeys(payload, ["mass"], "Mass payload");
      finitePositive(payload.mass, "Mass");
      return;
    case "EffectType.ModifySize" /* ModifySize */:
      exactKeys(payload, ["size"], "Size payload");
      finitePositive(payload.size, "Size");
      return;
    case "EffectType.Position" /* Position */:
    case "EffectType.Velocity" /* Velocity */:
      exactKeys(payload, ["x", "y"], `${String(effect.type)} payload`);
      finite(payload.x, "Vector x");
      finite(payload.y, "Vector y");
      return;
    case "EffectType.Team" /* Team */:
      exactKeys(payload, ["team"], "Team payload");
      if (!Array.isArray(payload.team) || !payload.team.every((team) => Number.isSafeInteger(team) && team >= 0))
        throw new Error("Team payload requires non-negative integer teams");
      return;
    case "EffectType.ModifySetting" /* ModifySetting */:
      validateModifySetting(payload);
      return;
    default:
      throw new Error(`Unsupported effect type '${String(effect.type)}'`);
  }
}
function validateFullEffectSettings(value) {
  const full = record(value, "Full effect settings");
  knownKeys(full, FULL_EFFECT_KEYS, "Full effect settings");
  validateTriggerSettings({ trigger: full.trigger, triggerValue: full.triggerValue });
  validateEffectSettings({ type: full.type, typeValue: full.typeValue });
}
function validateRuntimeItemEffectSettings(value) {
  const effect = record(value, "Item effect settings");
  knownKeys(effect, ITEM_EFFECT_KEYS, "Item effect settings");
  if (effect.itemId !== undefined && (typeof effect.itemId !== "string" || effect.itemId.length === 0))
    throw new Error("Item effect itemId must be a non-empty string");
  if (effect.order !== undefined && !Number.isSafeInteger(effect.order))
    throw new Error("Item effect order must be a safe integer");
  if (!ITEM_EFFECT_TYPES.includes(effect.type))
    throw new Error(`Unknown item effect type '${String(effect.type)}'`);
  const payload = record(effect.typeValue, `Item effect '${String(effect.type)}' payload`);
  switch (effect.type) {
    case "modifyForce" /* ModifyForce */:
      exactKeys(payload, ["factor"], "modifyForce payload");
      finiteNonNegative(payload.factor, "modifyForce factor");
      return;
    case "modifyRotation" /* ModifyRotation */:
      exactKeys(payload, ["degrees"], "modifyRotation payload");
      finite(payload.degrees, "modifyRotation degrees");
      return;
    case "lockRotation" /* LockRotation */:
    case "selectionLock" /* SelectionLock */:
      validateTurns(payload, String(effect.type));
      return;
    case "applyTorque" /* ApplyTorque */:
      exactKeys(payload, ["torque"], "applyTorque payload");
      finite(payload.torque, "applyTorque torque");
      return;
    case "spawnTrigger" /* SpawnTrigger */:
      knownKeys(payload, new Set(["triggerId", "delayTurns", "remainingTurns", "fired"]), "spawnTrigger payload");
      requiredKeys(payload, ["triggerId", "delayTurns"], "spawnTrigger payload");
      string(payload.triggerId, "spawnTrigger triggerId");
      boundedTurns(payload.delayTurns, payload.remainingTurns, "spawnTrigger");
      optionalBoolean(payload.fired, "spawnTrigger fired");
      return;
    case "delayedEffect" /* DelayedEffect */:
      knownKeys(payload, new Set(["effectType", "effectValue", "delayTicks", "remainingTicks", "fired"]), "delayedEffect payload");
      requiredKeys(payload, ["effectType", "delayTicks"], "delayedEffect payload");
      string(payload.effectType, "delayedEffect effectType");
      boundedTicks(payload.delayTicks, payload.remainingTicks, "delayedEffect");
      if (payload.effectValue !== undefined)
        assertJsonValue(payload.effectValue);
      optionalBoolean(payload.fired, "delayedEffect fired");
      return;
    case "shield" /* Shield */:
      knownKeys(payload, new Set(["capacity", "remainingCapacity", "blocksCollision"]), "shield payload");
      requiredKeys(payload, ["capacity"], "shield payload");
      finitePositive(payload.capacity, "shield capacity");
      if (payload.remainingCapacity !== undefined && (typeof payload.remainingCapacity !== "number" || !Number.isFinite(payload.remainingCapacity) || payload.remainingCapacity < 0 || payload.remainingCapacity > payload.capacity))
        throw new Error("shield remainingCapacity is outside capacity");
      optionalBoolean(payload.blocksCollision, "shield blocksCollision");
      return;
    case "freeze" /* Freeze */:
      knownKeys(payload, new Set(["speedFactor", "durationTurns", "remainingTurns"]), "freeze payload");
      requiredKeys(payload, ["speedFactor", "durationTurns"], "freeze payload");
      finiteRange(payload.speedFactor, 0, 1, "freeze speedFactor");
      boundedTurns(payload.durationTurns, payload.remainingTurns, "freeze");
      return;
    case "swapPosition" /* SwapPosition */:
      exactKeys(payload, [], "swapPosition payload");
      return;
    case "temporaryWall" /* TemporaryWall */:
      knownKeys(payload, new Set(["wallId", "x", "y", "w", "h", "color", "durationTurns", "remainingTurns", "active"]), "temporaryWall payload");
      requiredKeys(payload, ["wallId", "x", "y", "w", "h", "durationTurns"], "temporaryWall payload");
      string(payload.wallId, "temporaryWall wallId");
      finite(payload.x, "temporaryWall x");
      finite(payload.y, "temporaryWall y");
      finitePositive(payload.w, "temporaryWall w");
      finitePositive(payload.h, "temporaryWall h");
      if (payload.color !== undefined)
        string(payload.color, "temporaryWall color");
      boundedTurns(payload.durationTurns, payload.remainingTurns, "temporaryWall");
      optionalBoolean(payload.active, "temporaryWall active");
      return;
    case "ghostMode" /* GhostMode */:
      knownKeys(payload, new Set(["durationTurns", "remainingTurns"]), "ghostMode payload");
      requiredKeys(payload, ["durationTurns"], "ghostMode payload");
      boundedTurns(payload.durationTurns, payload.remainingTurns, "ghostMode");
      return;
    case "magnet" /* Magnet */:
      exactKeys(payload, ["mode", "force", "range"], "magnet payload");
      if (payload.mode !== "attract" && payload.mode !== "repel")
        throw new Error("magnet mode must be attract or repel");
      finiteNonNegative(payload.force, "magnet force");
      finitePositive(payload.range, "magnet range");
      return;
    case "aimVariance" /* AimVariance */:
      knownKeys(payload, new Set(["maxVarianceDegrees", "seed", "randomState"]), "aimVariance payload");
      requiredKeys(payload, ["maxVarianceDegrees"], "aimVariance payload");
      finiteNonNegative(payload.maxVarianceDegrees, "aimVariance maxVarianceDegrees");
      optionalSafeInteger(payload.seed, "aimVariance seed");
      optionalSafeInteger(payload.randomState, "aimVariance randomState");
      return;
  }
}
function validateModifySetting(payload) {
  exactKeys(payload, ["operation", "key", "value"], "ModifySetting payload");
  if (payload.operation !== "set" /* Set */ && payload.operation !== "add" /* Add */ && payload.operation !== "remove" /* Remove */)
    throw new Error("ModifySetting operation is invalid");
  if (typeof payload.key !== "string" || !PLAYER_SETTING_KEYS.has(payload.key))
    throw new Error("ModifySetting key is not allowlisted");
  validateSettingValue(payload.key, payload.value);
}
function validateSettingValue(key, value) {
  if (value === undefined)
    return;
  if (["hp", "mass", "size", "friction"].includes(key)) {
    finite(value, `ModifySetting ${key}`);
    return;
  }
  if (["position", "velocity"].includes(key)) {
    const vector = record(value, `ModifySetting ${key}`);
    exactKeys(vector, ["x", "y"], `ModifySetting ${key}`);
    finite(vector.x, `${key} x`);
    finite(vector.y, `${key} y`);
    return;
  }
  if (key === "team") {
    if (!Array.isArray(value) || !value.every((team) => Number.isSafeInteger(team) && team >= 0))
      throw new Error("ModifySetting team requires non-negative integer teams");
    return;
  }
  if (typeof value !== "boolean")
    throw new Error(`ModifySetting ${key} requires a boolean`);
}
function validateTurns(payload, label) {
  knownKeys(payload, new Set(["durationTurns", "remainingTurns"]), `${label} payload`);
  requiredKeys(payload, ["durationTurns"], `${label} payload`);
  boundedTurns(payload.durationTurns, payload.remainingTurns, label);
}
function boundedTurns(duration, remaining, label) {
  if (!Number.isSafeInteger(duration) || duration < 1)
    throw new Error(`${label} durationTurns must be a positive integer`);
  if (remaining !== undefined && (!Number.isSafeInteger(remaining) || remaining < 0 || remaining > duration))
    throw new Error(`${label} remainingTurns is outside durationTurns`);
}
function boundedTicks(duration, remaining, label) {
  if (!Number.isSafeInteger(duration) || duration < 0)
    throw new Error(`${label} delayTicks must be a non-negative integer`);
  if (remaining !== undefined && (!Number.isSafeInteger(remaining) || remaining < 0 || remaining > duration))
    throw new Error(`${label} remainingTicks is outside delayTicks`);
}
function record(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}
function knownKeys(value, allowed, label) {
  for (const key of Object.keys(value))
    if (!allowed.has(key))
      throw new Error(`${label} contains unknown field '${key}'`);
}
function exactKeys(value, allowed, label) {
  const set = new Set(allowed);
  for (const key of Object.keys(value))
    if (!set.has(key))
      throw new Error(`${label} contains unknown field '${key}'`);
  for (const key of allowed)
    if (!(key in value))
      throw new Error(`${label} is missing '${key}'`);
}
function requiredKeys(value, required, label) {
  for (const key of required)
    if (!(key in value))
      throw new Error(`${label} is missing '${key}'`);
}
function finite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${label} must be finite`);
}
function finitePositive(value, label) {
  finite(value, label);
  if (value <= 0)
    throw new Error(`${label} must be positive`);
}
function finiteNonNegative(value, label) {
  finite(value, label);
  if (value < 0)
    throw new Error(`${label} must be non-negative`);
}
function finiteRange(value, min, max, label) {
  finite(value, label);
  if (value < min || value > max)
    throw new Error(`${label} is outside range`);
}
function string(value, label) {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${label} must be a non-empty string`);
}
function optionalBoolean(value, label) {
  if (value !== undefined && typeof value !== "boolean")
    throw new Error(`${label} must be boolean`);
}
function optionalSafeInteger(value, label) {
  if (value !== undefined && !Number.isSafeInteger(value))
    throw new Error(`${label} must be a safe integer`);
}

function orderInstalledEffects(effects) {
  return effects.map((effect, index) => ({ effect, index })).sort((a, b) => (a.effect.order ?? 0) - (b.effect.order ?? 0) || a.index - b.index).map((entry) => entry.effect);
}
function preserveEffectDeclarationOrder(effects) {
  return [...effects];
}

class MultiEffect {
  children;
  constructor(effect) {
    const children = effect.typeValue;
    if (!Array.isArray(children))
      throw new Error("EffectType.Multi requires a typeValue array of effect settings");
    this.children = preserveEffectDeclarationOrder(children).map((child) => createRuntimeEffect(child));
  }
  apply(entity, override) {
    for (const child of this.children)
      child.apply(entity, override);
  }
  getType() {
    return "EffectType.Multi" /* Multi */;
  }
  toSettings() {
    return { type: "EffectType.Multi" /* Multi */, typeValue: this.children.map((child) => child.toSettings()) };
  }
}

class MetaEffect {
  eff;
  constructor(effect) {
    validateEffectSettings(effect);
    switch (effect.type) {
      case "EffectType.Damage" /* Damage */:
        this.eff = new EffectDamage(effect);
        return;
      case "EffectType.Movement" /* Movement */:
        this.eff = new EffectMove(effect);
        return;
      case "EffectType.Physics" /* Physics */:
        this.eff = new EffectPhysics(effect);
        return;
      case "EffectType.Multi" /* Multi */:
        this.eff = new MultiEffect(effect);
        return;
      case "EffectType.ModifyMass" /* ModifyMass */:
        this.eff = new EffectModifyMass(effect);
        return;
      case "EffectType.Position" /* Position */:
        this.eff = new EffectModifyPosition(effect);
        return;
      case "EffectType.ModifySize" /* ModifySize */:
        this.eff = new EffectModifySize(effect);
        return;
      case "EffectType.Team" /* Team */:
        this.eff = new EffectModifyTeam(effect);
        return;
      case "EffectType.Velocity" /* Velocity */:
        this.eff = new EffectModifyVelocity(effect);
        return;
      case "EffectType.ModifySetting" /* ModifySetting */:
        this.eff = new EffectModifySetting(effect);
        return;
      default: {
        throw new Error(`Unknown effect type "${String(effect.type)}"`);
      }
    }
  }
  apply(entity, override) {
    this.eff.apply(entity, override);
  }
  getType() {
    return this.eff.getType();
  }
  toSettings() {
    return this.eff.toSettings();
  }
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
  const state = record2(value, "Transform state");
  exactKeys2(state, ["schemaVersion", "position", "rotation"], "Transform state");
  if (state.schemaVersion !== 1)
    throw new Error("Unsupported Transform state schema version");
  validateVector(state.position, "Transform position");
  finite2(state.rotation, "Transform rotation");
}
function validateMovementState(value) {
  const state = record2(value, "Movement state");
  exactKeys2(state, ["schemaVersion", "velocity", "angularVelocity", "enabled"], "Movement state");
  if (state.schemaVersion !== 1)
    throw new Error("Unsupported Movement state schema version");
  validateVector(state.velocity, "Movement velocity");
  finite2(state.angularVelocity, "Movement angularVelocity");
  if (typeof state.enabled !== "boolean")
    throw new Error("Movement enabled must be boolean");
}
function validateVector(value, label) {
  const vector = record2(value, label);
  exactKeys2(vector, ["x", "y"], label);
  finite2(vector.x, `${label} x`);
  finite2(vector.y, `${label} y`);
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
function finite2(value, label) {
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
      this.screens.set(screen.id, { settings: clone3(screen), elements: screen.elements.map(createNode) });
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
    const screens = [...this.screens.values()].map((screen) => ({ ...clone3(screen.settings), elements: screen.elements.map((node) => node.toSettings()) }));
    return { ...clone3(this.settings), activeScreen: this.activeScreen, history: [...this.history], screens };
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
    this.applyAction(clone3(action));
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
    element.action = action ? clone3(action) : undefined;
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
    const commands = this.emitted.map(clone3);
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
      this.pendingActions.push(clone3(found.element.action));
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
      this.emitted.push({ command: action.command, ...action.payload === undefined ? {} : { payload: clone3(action.payload) } });
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
    this.localRect = clone3(settings.rect);
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
    const base = { ...clone3(this.settings), rect: clone3(this.localRect), text: this.text, visible: this.visible, enabled: this.enabled };
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
    this.localRect = clone3(settings.rect);
    this.visible = settings.visible ?? true;
    this.enabled = settings.enabled ?? true;
    this.layout = clone3(settings.layout);
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
    return { ...clone3(this.settings), rect: clone3(this.localRect), visible: this.visible, enabled: this.enabled, elements: this.elements.map((node) => node.toSettings()) };
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
    this.screens.push(clone3(screen));
    return this;
  }
  useFramework(framework) {
    this.framework = clone3(framework);
    return this;
  }
  build() {
    const settings = { schemaVersion: 1, id: this.id, size: clone3(this.size), activeScreen: this.screens[0]?.id ?? "", history: [], screens: clone3(this.screens), framework: clone3(this.framework) };
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
  const cloned = clone3(settings);
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
function clone3(value) {
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
    const input = clone3(settings);
    const result = { id: input.id, elements: input.elements.map((element) => clone3(element)) };
    if (input.layout !== undefined)
      result.layout = normalizeLayout(input.layout);
    if (input.visible !== undefined)
      result.visible = input.visible;
    return result;
  },
  button(settings) {
    return { ...clone3(settings), kind: "button", focusable: settings.focusable ?? true };
  },
  text(settings) {
    return { ...clone3(settings), kind: "text", focusable: false };
  },
  textInput(settings) {
    return { ...clone3(settings), kind: "textInput", focusable: true, value: settings.value ?? settings.text };
  },
  image(settings) {
    return { ...clone3(settings), kind: "image" };
  },
  container(settings) {
    let input;
    try {
      input = clone3(settings);
    } catch (error) {
      throw new Error(`UI container input must be acyclic JSON data: ${error instanceof Error ? error.message : String(error)}`);
    }
    const result = {
      kind: "container",
      id: input.id,
      rect: clone3(input.rect),
      layout: normalizeLayout(input.layout ?? { type: "absolute" }),
      elements: input.elements.map((element) => clone3(element))
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

var AssetPaths = {
  [0 /* pointertoonbPNG */]: "pointer_toon_b.png",
  [1 /* arena2PNG */]: "arena2.png",
  [2 /* slipStirkeMapIceJPG */]: "Slip_Stirke_Map_Ice.jpg",
  [3 /* penguinIdleFrame2SVG */]: "Penguin_Idle_Frame_2.svg",
  [4 /* copilot20260505233044PNG */]: "Copilot_20260505_233044.png",
  [5 /* copilot20260503025035PNG */]: "Copilot_20260503_025035.png",
  [6 /* slipstrikeTitelbildschirmPNG */]: "SlipstrikeTitelbildschirm.png",
  [7 /* magmaMapPNG */]: "MagmaMap.png",
  [8 /* lavaPNG */]: "lava.png",
  [9 /* billiardPNG */]: "billiard.png",
  [10 /* arenaPNG */]: "arena.png",
  [11 /* eisMapPNG */]: "EisMap.png",
  [12 /* billiardGrosserLochJungePNG */]: "BilliardGrosserLochJunge.png",
  [13 /* darkwoodPNG */]: "dark-wood.png",
  [14 /* eisPNG */]: "eis.png",
  [15 /* billiardMapPNG */]: "BilliardMap.png",
  [16 /* pictureReifenSVG */]: "picture/Reifen.svg",
  [17 /* pictureReifenPNG */]: "picture/Reifen.png",
  [18 /* pictureReifenWEBP */]: "picture/Reifen.webp",
  [19 /* picturePenguinPenguinHurtFrame2PNG */]: "picture/penguin/Penguin_Hurt_Frame_2.png",
  [20 /* picturePenguinPenguinStarsFrame2WEBP */]: "picture/penguin/Penguin_Stars_Frame_2.webp",
  [21 /* picturePenguinPenguinHurtFrame1WEBP */]: "picture/penguin/Penguin_Hurt_Frame_1.webp",
  [22 /* picturePenguinPenguinIdleFrame1WEBP */]: "picture/penguin/Penguin_Idle_Frame_1.webp",
  [23 /* picturePenguinPenguinStarsFrame2PNG */]: "picture/penguin/Penguin_Stars_Frame_2.png",
  [24 /* picturePenguinPenguinIdleFrame2PNG */]: "picture/penguin/Penguin_Idle_Frame_2.png",
  [25 /* picturePenguinPenguinStarsFrame1PNG */]: "picture/penguin/Penguin_Stars_Frame_1.png",
  [26 /* picturePenguinPenguinHurtFrame2WEBP */]: "picture/penguin/Penguin_Hurt_Frame_2.webp",
  [27 /* picturePenguinPenguinIdleFrame1PNG */]: "picture/penguin/Penguin_Idle_Frame_1.png",
  [28 /* picturePenguinPenguinIdleFrame2WEBP */]: "picture/penguin/Penguin_Idle_Frame_2.webp",
  [29 /* picturePenguinPenguinHurtFrame1PNG */]: "picture/penguin/Penguin_Hurt_Frame_1.png",
  [30 /* picturePenguinPenguinStarsFrame1WEBP */]: "picture/penguin/Penguin_Stars_Frame_1.webp",
  [31 /* picturePolarBearPolarBearStarsFrame2PNG */]: "picture/Polar_Bear/Polar_Bear_Stars_Frame_2.png",
  [32 /* picturePolarBearPolarBearStarsFrame1PNG */]: "picture/Polar_Bear/Polar_Bear_Stars_Frame_1.png",
  [33 /* picturePolarBearPolarBearStarsFrame2SVG */]: "picture/Polar_Bear/Polar_Bear_Stars_Frame_2.svg",
  [34 /* picturePolarBearPolarBearHurtFrame2WEBP */]: "picture/Polar_Bear/Polar_Bear_Hurt_Frame_2.webp",
  [35 /* picturePolarBearPolarBearIdleFrame2PNG */]: "picture/Polar_Bear/Polar_Bear_Idle_Frame_2.png",
  [36 /* picturePolarBearPolarBearIdleFrame2SVG */]: "picture/Polar_Bear/Polar_Bear_Idle_Frame_2.svg",
  [37 /* picturePolarBearPolarBearHurtFrame2SVG */]: "picture/Polar_Bear/Polar_Bear_Hurt_Frame_2.svg",
  [38 /* picturePolarBearPolarBearHurtFrame1PNG */]: "picture/Polar_Bear/Polar_Bear_Hurt_Frame_1.png",
  [39 /* picturePolarBearPolarBearIdleFrame2WEBP */]: "picture/Polar_Bear/Polar_Bear_Idle_Frame_2.webp",
  [40 /* picturePolarBearPolarBearIdleFrame1PNG */]: "picture/Polar_Bear/Polar_Bear_Idle_Frame_1.png",
  [41 /* picturePolarBearPolarBearHurtFrame2PNG */]: "picture/Polar_Bear/Polar_Bear_Hurt_Frame_2.png",
  [42 /* picturePolarBearPolarBearStarsFrame2WEBP */]: "picture/Polar_Bear/Polar_Bear_Stars_Frame_2.webp",
  [43 /* picturePolarBearPolarBearStarsFrame1SVG */]: "picture/Polar_Bear/Polar_Bear_Stars_Frame_1.svg",
  [44 /* picturePolarBearPolarBearHurtFrame1SVG */]: "picture/Polar_Bear/Polar_Bear_Hurt_Frame_1.svg",
  [45 /* picturePolarBearPolarBearStarsFrame1WEBP */]: "picture/Polar_Bear/Polar_Bear_Stars_Frame_1.webp",
  [46 /* picturePolarBearPolarBearIdleFrame1WEBP */]: "picture/Polar_Bear/Polar_Bear_Idle_Frame_1.webp",
  [47 /* picturePolarBearPolarBearIdleFrame1SVG */]: "picture/Polar_Bear/Polar_Bear_Idle_Frame_1.svg",
  [48 /* picturePolarBearPolarBearHurtFrame1WEBP */]: "picture/Polar_Bear/Polar_Bear_Hurt_Frame_1.webp"
};

function validatePlayerMass(mass) {
  if (!Number.isFinite(mass) || mass <= 0)
    throw new Error("Player mass must be a finite positive number");
}
function createPlayerSettings(overrides = {}) {
  const mass = overrides.mass ?? 1;
  validatePlayerMass(mass);
  return {
    id: overrides.id ?? crypto.randomUUID(),
    position: { x: overrides.position?.x ?? 0, y: overrides.position?.y ?? 0 },
    velocity: { x: overrides.velocity?.x ?? 0, y: overrides.velocity?.y ?? 0 },
    rotation: overrides.rotation ?? 0,
    angularVelocity: overrides.angularVelocity ?? 0,
    hp: overrides.hp ?? 30,
    bouncyness: overrides.bouncyness ?? 1,
    mass,
    size: overrides.size ?? 20,
    friction: overrides.friction,
    team: [...overrides.team ?? []],
    color: overrides.color ?? "red",
    playericon: overrides.playericon ?? 27 /* picturePenguinPenguinIdleFrame1PNG */,
    shape: 0 /* CIRCLE */,
    hoop: overrides.hoop ?? 17 /* pictureReifenPNG */,
    isPhysicsEnabled: overrides.isPhysicsEnabled ?? true,
    isDead: overrides.isDead ?? false,
    effects: (overrides.effects ?? []).map((effect) => ({ ...effect })),
    inventory: (overrides.inventory ?? []).map((item) => ({ ...item })),
    ...overrides.itemEffects ? { itemEffects: overrides.itemEffects.map((effect) => ({ ...effect, typeValue: structuredClone(effect.typeValue) })) } : {}
  };
}

class SeededRandom {
  state;
  constructor(seed) {
    if (!Number.isSafeInteger(seed))
      throw new RangeError("Seed must be a safe integer");
    this.state = seed >>> 0;
  }
  next() {
    this.state = this.state + 1831565813 >>> 0;
    let value = this.state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }
  nextInt(maxExclusive) {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError("Maximum must be a positive safe integer");
    }
    return Math.floor(this.next() * maxExclusive);
  }
  getState() {
    return this.state;
  }
  static fromState(state) {
    if (!Number.isSafeInteger(state) || state < 0 || state > 4294967295) {
      throw new RangeError("Random state must be an unsigned 32-bit integer");
    }
    const random = new SeededRandom(0);
    random.state = state;
    return random;
  }
}

class EffectAimVariance {
  maxVarianceDegrees;
  random;
  constructor(settings) {
    const { maxVarianceDegrees, seed = 1337, randomState } = settings.typeValue;
    if (!Number.isFinite(maxVarianceDegrees) || maxVarianceDegrees < 0) {
      throw new Error("aimVariance maxVarianceDegrees must be a finite non-negative number");
    }
    this.maxVarianceDegrees = maxVarianceDegrees;
    this.random = randomState !== undefined ? SeededRandom.fromState(randomState) : new SeededRandom(seed);
  }
  applyToForce(force) {
    if (!Number.isFinite(force.angle) || !Number.isFinite(force.power) || force.power < 0) {
      throw new Error("Force input must have a finite angle and non-negative power");
    }
    const rnd = this.random.next();
    const offset = (rnd * 2 - 1) * this.maxVarianceDegrees;
    return {
      angle: normalizeAngle(force.angle + offset),
      power: force.power
    };
  }
  toSettings() {
    return {
      type: "aimVariance" /* AimVariance */,
      typeValue: {
        maxVarianceDegrees: this.maxVarianceDegrees,
        randomState: this.random.getState()
      }
    };
  }
}
function normalizeAngle(angle) {
  return (angle % 360 + 360) % 360;
}

class EffectDelayed {
  effectType;
  effectValue;
  delayTicks;
  remainingTicks;
  fired;
  constructor(settings) {
    const { effectType, effectValue, delayTicks, remainingTicks = delayTicks, fired = false } = settings.typeValue;
    if (typeof effectType !== "string" || effectType.length === 0)
      throw new Error("delayedEffect requires a non-empty effectType");
    if (!Number.isSafeInteger(delayTicks) || delayTicks < 0)
      throw new Error("delayedEffect delayTicks must be a non-negative integer");
    if (!Number.isSafeInteger(remainingTicks) || remainingTicks < 0 || remainingTicks > delayTicks)
      throw new Error("delayedEffect remainingTicks must be between zero and delayTicks");
    if (typeof fired !== "boolean")
      throw new Error("delayedEffect fired must be boolean");
    if (fired && remainingTicks !== 0)
      throw new Error("A fired delayedEffect must have zero remaining ticks");
    this.effectType = effectType;
    this.effectValue = effectValue === undefined ? undefined : structuredClone(effectValue);
    this.delayTicks = delayTicks;
    this.remainingTicks = remainingTicks;
    this.fired = fired;
  }
  advanceTick() {
    if (this.fired)
      return false;
    if (this.remainingTicks > 0)
      this.remainingTicks--;
    if (this.remainingTicks !== 0)
      return false;
    this.fired = true;
    return true;
  }
  hasFired() {
    return this.fired;
  }
  getRemainingTicks() {
    return this.remainingTicks;
  }
  toSettings() {
    return {
      type: "delayedEffect" /* DelayedEffect */,
      typeValue: {
        effectType: this.effectType,
        effectValue: this.effectValue === undefined ? undefined : structuredClone(this.effectValue),
        delayTicks: this.delayTicks,
        remainingTicks: this.remainingTicks,
        fired: this.fired
      }
    };
  }
}

class EffectFreeze {
  speedFactor;
  durationTurns;
  remainingTurns;
  constructor(settings) {
    const { speedFactor, durationTurns, remainingTurns = durationTurns } = settings.typeValue;
    if (!Number.isFinite(speedFactor) || speedFactor < 0 || speedFactor > 1)
      throw new Error("freeze speedFactor must be between zero and one");
    if (!Number.isSafeInteger(durationTurns) || durationTurns < 1)
      throw new Error("freeze durationTurns must be a positive integer");
    if (!Number.isSafeInteger(remainingTurns) || remainingTurns < 0 || remainingTurns > durationTurns)
      throw new Error("freeze remainingTurns must be between zero and durationTurns");
    this.speedFactor = speedFactor;
    this.durationTurns = durationTurns;
    this.remainingTurns = remainingTurns;
  }
  applyToVelocity(velocity) {
    if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y))
      throw new Error("Freeze velocity must be finite");
    if (!this.isActive())
      return { ...velocity };
    return { x: velocity.x * this.speedFactor, y: velocity.y * this.speedFactor };
  }
  isActive() {
    return this.remainingTurns > 0;
  }
  getRemainingTurns() {
    return this.remainingTurns;
  }
  advanceTurn() {
    if (this.remainingTurns > 0)
      this.remainingTurns--;
  }
  toSettings() {
    return {
      type: "freeze" /* Freeze */,
      typeValue: { speedFactor: this.speedFactor, durationTurns: this.durationTurns, remainingTurns: this.remainingTurns }
    };
  }
}

class EffectGhostMode {
  durationTurns;
  remainingTurns;
  constructor(settings) {
    const { durationTurns, remainingTurns = durationTurns } = settings.typeValue;
    if (!Number.isSafeInteger(durationTurns) || durationTurns < 1)
      throw new Error("ghostMode durationTurns must be a positive integer");
    if (!Number.isSafeInteger(remainingTurns) || remainingTurns < 0 || remainingTurns > durationTurns)
      throw new Error("ghostMode remainingTurns must be between zero and durationTurns");
    this.durationTurns = durationTurns;
    this.remainingTurns = remainingTurns;
  }
  isActive() {
    return this.remainingTurns > 0;
  }
  shouldIgnoreCollision() {
    return this.isActive();
  }
  advanceTurn() {
    if (this.remainingTurns > 0)
      this.remainingTurns--;
  }
  getRemainingTurns() {
    return this.remainingTurns;
  }
  toSettings() {
    return { type: "ghostMode" /* GhostMode */, typeValue: { durationTurns: this.durationTurns, remainingTurns: this.remainingTurns } };
  }
}

class EffectMagnet {
  mode;
  force;
  range;
  constructor(settings) {
    const { mode, force, range: range2 } = settings.typeValue;
    if (mode !== "attract" && mode !== "repel")
      throw new Error("magnet mode must be attract or repel");
    if (!Number.isFinite(force) || force < 0)
      throw new Error("magnet force must be finite and non-negative");
    if (!Number.isFinite(range2) || range2 <= 0)
      throw new Error("magnet range must be finite and positive");
    this.mode = mode;
    this.force = force;
    this.range = range2;
  }
  calculateDelta(source, target) {
    validateVector2(source);
    validateVector2(target);
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0 || distance > this.range)
      return { x: 0, y: 0 };
    const direction = this.mode === "attract" ? 1 : -1;
    return { x: normalizeZero(dx / distance * this.force * direction), y: normalizeZero(dy / distance * this.force * direction) };
  }
  applyToVelocity(velocity, source, target) {
    validateVector2(velocity);
    const delta = this.calculateDelta(source, target);
    return { x: velocity.x + delta.x, y: velocity.y + delta.y };
  }
  toSettings() {
    return { type: "magnet" /* Magnet */, typeValue: { mode: this.mode, force: this.force, range: this.range } };
  }
}
function validateVector2(value) {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y))
    throw new Error("Magnet vectors must be finite");
}
function normalizeZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

class EffectModifyForce {
  factor;
  constructor(settings) {
    if (!Number.isFinite(settings.typeValue.factor) || settings.typeValue.factor < 0) {
      throw new Error("modifyForce factor must be a finite non-negative number");
    }
    this.factor = settings.typeValue.factor;
  }
  applyToForce(force) {
    if (!Number.isFinite(force.angle) || !Number.isFinite(force.power) || force.power < 0) {
      throw new Error("Force input must have a finite angle and non-negative power");
    }
    return { angle: normalizeAngle2(force.angle), power: force.power * this.factor };
  }
  toSettings() {
    return { type: "modifyForce" /* ModifyForce */, typeValue: { factor: this.factor } };
  }
}
function normalizeAngle2(angle) {
  return (angle % 360 + 360) % 360;
}

class EffectSelectionLock {
  durationTurns;
  remainingTurns;
  constructor(settings) {
    const { durationTurns, remainingTurns = durationTurns } = settings.typeValue;
    if (!Number.isSafeInteger(durationTurns) || durationTurns < 1) {
      throw new Error("selectionLock durationTurns must be a positive integer");
    }
    if (!Number.isSafeInteger(remainingTurns) || remainingTurns < 0 || remainingTurns > durationTurns) {
      throw new Error("selectionLock remainingTurns must be between zero and durationTurns");
    }
    this.durationTurns = durationTurns;
    this.remainingTurns = remainingTurns;
  }
  isLocked() {
    return this.remainingTurns > 0;
  }
  advanceTurn() {
    if (this.remainingTurns > 0)
      this.remainingTurns--;
  }
  getRemainingTurns() {
    return this.remainingTurns;
  }
  toSettings() {
    return {
      type: "selectionLock" /* SelectionLock */,
      typeValue: { durationTurns: this.durationTurns, remainingTurns: this.remainingTurns }
    };
  }
}

class EffectShield {
  capacity;
  blocksCollision;
  remainingCapacity;
  constructor(settings) {
    const { capacity, remainingCapacity = capacity, blocksCollision = true } = settings.typeValue;
    if (!Number.isFinite(capacity) || capacity <= 0)
      throw new Error("shield capacity must be a finite positive number");
    if (!Number.isFinite(remainingCapacity) || remainingCapacity < 0 || remainingCapacity > capacity)
      throw new Error("shield remainingCapacity must be between zero and capacity");
    if (typeof blocksCollision !== "boolean")
      throw new Error("shield blocksCollision must be boolean");
    this.capacity = capacity;
    this.remainingCapacity = remainingCapacity;
    this.blocksCollision = blocksCollision;
  }
  absorbDamage(damage) {
    if (!Number.isFinite(damage) || damage < 0)
      throw new Error("Shield damage must be finite and non-negative");
    const absorbed = Math.min(this.remainingCapacity, damage);
    this.remainingCapacity -= absorbed;
    return damage - absorbed;
  }
  isActive() {
    return this.remainingCapacity > 0;
  }
  shouldBlockCollision() {
    return this.isActive() && this.blocksCollision;
  }
  getRemainingCapacity() {
    return this.remainingCapacity;
  }
  toSettings() {
    return {
      type: "shield" /* Shield */,
      typeValue: {
        capacity: this.capacity,
        remainingCapacity: this.remainingCapacity,
        blocksCollision: this.blocksCollision
      }
    };
  }
}

class EffectSpawnTrigger {
  triggerId;
  delayTurns;
  remainingTurns;
  fired;
  constructor(settings) {
    const { triggerId, delayTurns, remainingTurns = delayTurns, fired = false } = settings.typeValue;
    if (typeof triggerId !== "string" || triggerId.length === 0)
      throw new Error("spawnTrigger requires a non-empty triggerId");
    if (!Number.isSafeInteger(delayTurns) || delayTurns < 0)
      throw new Error("spawnTrigger delayTurns must be a non-negative integer");
    if (!Number.isSafeInteger(remainingTurns) || remainingTurns < 0 || remainingTurns > delayTurns)
      throw new Error("spawnTrigger remainingTurns must be between zero and delayTurns");
    if (typeof fired !== "boolean")
      throw new Error("spawnTrigger fired must be boolean");
    if (fired && remainingTurns !== 0)
      throw new Error("A fired spawnTrigger must have zero remaining turns");
    this.triggerId = triggerId;
    this.delayTurns = delayTurns;
    this.remainingTurns = remainingTurns;
    this.fired = fired;
  }
  advanceTurn() {
    if (this.fired)
      return false;
    if (this.remainingTurns > 0)
      this.remainingTurns--;
    if (this.remainingTurns !== 0)
      return false;
    this.fired = true;
    return true;
  }
  hasFired() {
    return this.fired;
  }
  getRemainingTurns() {
    return this.remainingTurns;
  }
  toSettings() {
    return {
      type: "spawnTrigger" /* SpawnTrigger */,
      typeValue: {
        triggerId: this.triggerId,
        delayTurns: this.delayTurns,
        remainingTurns: this.remainingTurns,
        fired: this.fired
      }
    };
  }
}

class EffectSwapPosition {
  toSettings() {
    return { type: "swapPosition" /* SwapPosition */, typeValue: {} };
  }
  swap(first, second) {
    validateTarget(first);
    validateTarget(second);
    if (first.id === second.id)
      throw new Error("Cannot swap an entity with itself");
    return [{ ...second.position }, { ...first.position }];
  }
  teleport(target, destination) {
    validateTarget(target);
    if (!isVector(destination))
      throw new Error("Teleport destination must have finite coordinates");
    return { ...destination };
  }
}
function validateTarget(target) {
  if (typeof target.id !== "string" || target.id.length === 0)
    throw new Error("Position target requires a non-empty id");
  if (!target.active)
    throw new Error("Position target must be active");
  if (!isVector(target.position))
    throw new Error("Position target must have finite coordinates");
}
function isVector(value) {
  return typeof value === "object" && value !== null && typeof value.x === "number" && Number.isFinite(value.x) && typeof value.y === "number" && Number.isFinite(value.y);
}

class EffectTemporaryWall {
  wallId;
  x;
  y;
  w;
  h;
  color;
  durationTurns;
  remainingTurns;
  active;
  constructor(settings) {
    const value = settings.typeValue;
    if (typeof value.wallId !== "string" || value.wallId.length === 0)
      throw new Error("temporaryWall requires a non-empty wallId");
    if (![value.x, value.y].every(Number.isFinite) || ![value.w, value.h].every(Number.isFinite) || value.w <= 0 || value.h <= 0)
      throw new Error("temporaryWall requires finite position and positive dimensions");
    if (!Number.isSafeInteger(value.durationTurns) || value.durationTurns < 1)
      throw new Error("temporaryWall durationTurns must be a positive integer");
    const remainingTurns = value.remainingTurns ?? value.durationTurns;
    if (!Number.isSafeInteger(remainingTurns) || remainingTurns < 0 || remainingTurns > value.durationTurns)
      throw new Error("temporaryWall remainingTurns must be between zero and durationTurns");
    if (typeof value.active !== "undefined" && typeof value.active !== "boolean")
      throw new Error("temporaryWall active must be boolean");
    this.wallId = value.wallId;
    this.x = value.x;
    this.y = value.y;
    this.w = value.w;
    this.h = value.h;
    this.color = value.color;
    this.durationTurns = value.durationTurns;
    this.remainingTurns = remainingTurns;
    this.active = value.active ?? false;
  }
  spawn() {
    this.active = true;
    this.remainingTurns = this.durationTurns;
    return this.toWallState();
  }
  advanceTurn() {
    if (!this.active)
      return false;
    if (this.remainingTurns > 0)
      this.remainingTurns--;
    if (this.remainingTurns !== 0)
      return false;
    this.active = false;
    return true;
  }
  isActive() {
    return this.active;
  }
  getRemainingTurns() {
    return this.remainingTurns;
  }
  toWallState() {
    return { wallId: this.wallId, x: this.x, y: this.y, w: this.w, h: this.h, ...this.color === undefined ? {} : { color: this.color } };
  }
  toSettings() {
    return { type: "temporaryWall" /* TemporaryWall */, typeValue: { wallId: this.wallId, x: this.x, y: this.y, w: this.w, h: this.h, ...this.color === undefined ? {} : { color: this.color }, durationTurns: this.durationTurns, remainingTurns: this.remainingTurns, active: this.active } };
  }
}

function createRuntimeItemEffect(settings) {
  const value = settings.typeValue;
  switch (settings.type) {
    case "modifyForce" /* ModifyForce */:
      return new EffectModifyForce({ typeValue: { factor: numberValue(value, "factor", "multiplier") } });
    case "freeze" /* Freeze */:
      return new EffectFreeze({ typeValue: { speedFactor: numberValue(value, "speedFactor", "factor", 0.25), durationTurns: integerValue(value, "durationTurns"), ...value.remainingTurns === undefined ? {} : { remainingTurns: integerValue(value, "remainingTurns") } } });
    case "ghostMode" /* GhostMode */:
      return new EffectGhostMode({ typeValue: { durationTurns: integerValue(value, "durationTurns"), ...value.remainingTurns === undefined ? {} : { remainingTurns: integerValue(value, "remainingTurns") } } });
    case "magnet" /* Magnet */:
      return new EffectMagnet({ typeValue: { mode: value.mode === undefined ? "attract" : value.mode, force: numberValue(value, "force", "strength"), range: numberValue(value, "range") } });
    case "selectionLock" /* SelectionLock */:
      return new EffectSelectionLock({ typeValue: { durationTurns: integerValue(value, "durationTurns"), ...value.remainingTurns === undefined ? {} : { remainingTurns: integerValue(value, "remainingTurns") } } });
    case "shield" /* Shield */:
      return new EffectShield({ typeValue: { capacity: numberValue(value, "capacity") } });
    case "spawnTrigger" /* SpawnTrigger */:
      return new EffectSpawnTrigger({ typeValue: { triggerId: stringValue(value, "triggerId", "triggerType"), delayTurns: integerValue(value, "delayTurns", "delayTicks", 0), ...value.remainingTurns === undefined ? {} : { remainingTurns: integerValue(value, "remainingTurns") }, ...value.fired === undefined ? {} : { fired: value.fired } } });
    case "delayedEffect" /* DelayedEffect */: {
      const nested = value.effectValue ?? value.effect;
      return new EffectDelayed({ typeValue: { effectType: stringValue(value, "effectType"), effectValue: nested, delayTicks: integerValue(value, "delayTicks") } });
    }
    case "temporaryWall" /* TemporaryWall */:
      return new EffectTemporaryWall({ typeValue: {
        wallId: stringValue(value, "wallId"),
        x: numberValue(value, "x", undefined, 0),
        y: numberValue(value, "y", undefined, 0),
        w: numberValue(value, "w", undefined, 1),
        h: numberValue(value, "h", undefined, 1),
        durationTurns: integerValue(value, "durationTurns", "lifetimeTurns"),
        ...value.remainingTurns === undefined ? {} : { remainingTurns: integerValue(value, "remainingTurns") },
        ...value.active === undefined ? {} : { active: value.active }
      } });
    case "aimVariance" /* AimVariance */:
      return new EffectAimVariance({ typeValue: { maxVarianceDegrees: numberValue(value, "maxVarianceDegrees") } });
    case "swapPosition" /* SwapPosition */:
      return new EffectSwapPosition;
    default:
      throw new Error(`Unsupported runtime item effect '${String(settings.type)}'`);
  }
}
function resolveRuntimeItemEffects(effects) {
  return effects.map((effect) => createRuntimeItemEffect({ type: effect.type, typeValue: structuredClone(effect.value ?? {}) }));
}
function advanceRuntimeItemEffect(effect) {
  const runtime = createRuntimeItemEffect({ type: effect.type, typeValue: structuredClone(effect.typeValue) });
  const advance = runtime.advanceTurn;
  if (advance)
    advance.call(runtime);
  const next = runtime.toSettings();
  const value = next.typeValue;
  if (value.remainingTurns === 0 || value.active === false || value.fired === true)
    return;
  return { ...effect, typeValue: structuredClone(value) };
}
function applyRuntimeForceEffects(force, effects) {
  return effects.reduce((current, effect) => effect instanceof EffectModifyForce ? effect.applyToForce(current) : current, force);
}
function numberValue(value, key, alias, fallback) {
  const raw = value[key] ?? (alias ? value[alias] : undefined) ?? fallback;
  if (typeof raw !== "number")
    throw new Error(`Item effect requires numeric ${key}`);
  return raw;
}
function integerValue(value, key, alias, fallback) {
  const raw = numberValue(value, key, alias, fallback);
  if (!Number.isSafeInteger(raw))
    throw new Error(`Item effect requires integer ${key}`);
  return raw;
}
function stringValue(value, key, alias) {
  const raw = value[key] ?? (alias ? value[alias] : undefined);
  if (typeof raw !== "string" || raw.length === 0)
    throw new Error(`Item effect requires non-empty ${key}`);
  return raw;
}

function createItemDocument(overrides = {}) {
  return {
    schemaVersion: 1,
    id: overrides.id ?? "test-item",
    name: overrides.name ?? "Test Item",
    type: overrides.type ?? "utility",
    effects: overrides.effects ?? [],
    targetType: overrides.targetType ?? "self",
    duration: overrides.duration ?? { type: "instant", value: 0 },
    useLimit: overrides.useLimit ?? { perTurn: 1, perGame: 1 },
    interaction: overrides.interaction ?? { mode: "stack", order: 0 },
    ...overrides
  };
}
function createInventoryItem(overrides = {}) {
  return {
    itemId: overrides.itemId ?? "test-item",
    remainingUses: overrides.remainingUses ?? 1,
    usesThisTurn: overrides.usesThisTurn ?? 0
  };
}
var VALID_DURATION_TYPES = ["instant", "turns", "rounds"];
var VALID_TARGET_TYPES = ["self", "entity", "position", "zone"];
var VALID_ACTIVATION_TYPES = ["collision", "proximity"];
var VALID_INTERACTION_MODES = ["stack", "replace", "reject"];
function validateItemDocument(document) {
  if (typeof document !== "object" || document === null)
    throw new Error("Item document must be a non-null object");
  const doc = document;
  if (doc.schemaVersion !== 1)
    throw new Error("Item document must have schema version 1");
  if (typeof doc.id !== "string" || !doc.id)
    throw new Error("Item document must have a non-empty string id");
  if (typeof doc.name !== "string" || !doc.name)
    throw new Error("Item document must have a non-empty string name");
  if (typeof doc.type !== "string")
    throw new Error("Item document must have a string type");
  if (!Array.isArray(doc.effects))
    throw new Error("Item document must have an effects array");
  if (!VALID_TARGET_TYPES.includes(doc.targetType))
    throw new Error("Item document must have a valid target type");
  if (typeof doc.duration !== "object" || doc.duration === null)
    throw new Error("Item document must have a duration object");
  const duration = doc.duration;
  if (!VALID_DURATION_TYPES.includes(duration.type))
    throw new Error("Item duration must have a valid type");
  if (typeof duration.value !== "number" || !Number.isFinite(duration.value) || duration.value < 0)
    throw new Error("Item duration value must be a non-negative finite number");
  if (typeof doc.useLimit !== "object" || doc.useLimit === null)
    throw new Error("Item document must have a useLimit object");
  const useLimit = doc.useLimit;
  if (typeof useLimit.perTurn !== "number" || !Number.isSafeInteger(useLimit.perTurn) || useLimit.perTurn < 0)
    throw new Error("Item use-limit perTurn must be a non-negative integer");
  if (typeof useLimit.perGame !== "number" || !Number.isSafeInteger(useLimit.perGame) || useLimit.perGame < 0)
    throw new Error("Item use-limit perGame must be a non-negative integer");
  for (const effect of doc.effects) {
    if (typeof effect !== "object" || effect === null)
      throw new Error("Each item effect must be a non-null object");
    const eff = effect;
    if (typeof eff.type !== "string" || !eff.type)
      throw new Error("Each item effect must have a non-empty string type");
  }
  if (doc.targetValidation !== undefined && doc.targetValidation !== null) {
    if (typeof doc.targetValidation !== "object")
      throw new Error("Item targetValidation must be an object");
    const tv = doc.targetValidation;
    if (typeof tv.allowSelf !== "boolean")
      throw new Error("Item targetValidation must have a boolean allowSelf");
    if (typeof tv.allowAlly !== "boolean")
      throw new Error("Item targetValidation must have a boolean allowAlly");
    if (typeof tv.allowEnemy !== "boolean")
      throw new Error("Item targetValidation must have a boolean allowEnemy");
    if (tv.maxRange !== undefined && (typeof tv.maxRange !== "number" || !Number.isFinite(tv.maxRange) || tv.maxRange < 0))
      throw new Error("Item targetValidation maxRange must be a non-negative finite number");
  }
  if (doc.cooldown !== undefined && (typeof doc.cooldown !== "number" || !Number.isSafeInteger(doc.cooldown) || doc.cooldown < 0))
    throw new Error("Item cooldown must be a non-negative integer");
  if (doc.interaction !== undefined) {
    if (typeof doc.interaction !== "object" || doc.interaction === null)
      throw new Error("Item interaction must be an object");
    const interaction = doc.interaction;
    if (!VALID_INTERACTION_MODES.includes(interaction.mode))
      throw new Error("Item interaction must have a valid mode");
    if (interaction.order !== undefined && (!Number.isSafeInteger(interaction.order) || interaction.order < 0))
      throw new Error("Item interaction order must be a non-negative integer");
    if (interaction.with !== undefined) {
      if (typeof interaction.with !== "object" || interaction.with === null || Array.isArray(interaction.with))
        throw new Error("Item interaction overrides must be an object");
      for (const [itemId, mode] of Object.entries(interaction.with)) {
        if (!itemId || !VALID_INTERACTION_MODES.includes(mode))
          throw new Error("Item interaction overrides must contain valid item IDs and modes");
      }
    }
  }
}
function validateItemPickup(pickup) {
  if (typeof pickup !== "object" || pickup === null)
    throw new Error("Item pickup must be a non-null object");
  const p = pickup;
  if (typeof p.itemId !== "string" || !p.itemId)
    throw new Error("Item pickup must have a non-empty string itemId");
  if (typeof p.spawnRegion !== "object" || p.spawnRegion === null)
    throw new Error("Item pickup must have a spawnRegion object");
  const region = p.spawnRegion;
  if (typeof region.x !== "number" || !Number.isFinite(region.x) || typeof region.y !== "number" || !Number.isFinite(region.y) || typeof region.w !== "number" || !Number.isFinite(region.w) || typeof region.h !== "number" || !Number.isFinite(region.h))
    throw new Error("Item pickup spawnRegion must have finite numeric x, y, w, h");
  if (region.w <= 0 || region.h <= 0)
    throw new Error("Item pickup spawnRegion w and h must be positive");
  if (!VALID_ACTIVATION_TYPES.includes(p.activationType))
    throw new Error("Item pickup must have a valid activation type");
  if (p.maxPickupsPerTurn !== undefined && (typeof p.maxPickupsPerTurn !== "number" || !Number.isSafeInteger(p.maxPickupsPerTurn) || p.maxPickupsPerTurn < 0))
    throw new Error("Item pickup maxPickupsPerTurn must be a non-negative integer");
  if (p.respawnerCountdown !== undefined && (typeof p.respawnerCountdown !== "number" || !Number.isSafeInteger(p.respawnerCountdown) || p.respawnerCountdown < 0))
    throw new Error("Item pickup respawnerCountdown must be a non-negative integer");
  if (p.respawnConfig !== undefined) {
    if (typeof p.respawnConfig !== "object" || p.respawnConfig === null)
      throw new Error("Item pickup respawnConfig must be an object");
    const config = p.respawnConfig;
    if (typeof config.intervalRounds !== "number" || !Number.isSafeInteger(config.intervalRounds) || config.intervalRounds < 1)
      throw new Error("Item pickup respawnConfig intervalRounds must be a positive integer");
  }
}
function validateItemPickupState(state, pickupCount) {
  if (typeof state !== "object" || state === null)
    throw new Error("Item pickup state must be a non-null object");
  const value = state;
  if (typeof value.turnNumber !== "number" || !Number.isSafeInteger(value.turnNumber) || value.turnNumber < 0)
    throw new Error("Item pickup state must have a non-negative turn number");
  if (!Array.isArray(value.pickups) || value.pickups.length !== pickupCount)
    throw new Error("Item pickup state must match configured pickups");
  for (const pickup of value.pickups) {
    if (typeof pickup !== "object" || pickup === null)
      throw new Error("Item pickup state must contain pickup entries");
    const entry = pickup;
    if (typeof entry.collected !== "number" || !Number.isSafeInteger(entry.collected) || entry.collected < 0)
      throw new Error("Item pickup state must have non-negative collection counts");
    if (!Array.isArray(entry.occupants) || !entry.occupants.every((id) => typeof id === "string") || new Set(entry.occupants).size !== entry.occupants.length)
      throw new Error("Item pickup state must have unique occupant IDs");
    if (entry.respawnCountdown !== undefined && (typeof entry.respawnCountdown !== "number" || !Number.isSafeInteger(entry.respawnCountdown) || entry.respawnCountdown < 0))
      throw new Error("Item pickup state must have a non-negative respawn countdown");
  }
}

function createFixedLoadoutInventory(loadout, documents) {
  const documentsById = new Map(documents.map((document) => [document.id, document]));
  const requestedUses = new Map;
  for (const { itemId, uses } of loadout.items) {
    if (!documentsById.has(itemId))
      throw new Error(`Fixed loadout references unknown item '${itemId}'`);
    requestedUses.set(itemId, (requestedUses.get(itemId) ?? 0) + uses);
  }
  return [...requestedUses].map(([itemId, uses]) => createInventoryItem({
    itemId,
    remainingUses: Math.min(uses, documentsById.get(itemId).useLimit.perGame)
  }));
}
function consumeInventoryItem(inventory, item) {
  const entry = inventory.find((candidate) => candidate.itemId === item.id);
  if (!entry)
    throw new Error(`Item '${item.id}' is not in this inventory`);
  if (entry.remainingUses === 0)
    throw new Error(`Item '${item.id}' has no remaining uses`);
  if (entry.usesThisTurn >= item.useLimit.perTurn)
    throw new Error(`Item '${item.id}' has reached its per-turn limit`);
  entry.remainingUses--;
  entry.usesThisTurn++;
}
function resetInventoryTurnUses(inventory) {
  for (const item of inventory)
    item.usesThisTurn = 0;
}
function addDrawnInventoryItem(inventory, item) {
  const entry = inventory.find((candidate) => candidate.itemId === item.id);
  if (entry) {
    entry.remainingUses = Math.min(entry.remainingUses + 1, item.useLimit.perGame);
    return;
  }
  inventory.push(createInventoryItem({ itemId: item.id, remainingUses: Math.min(1, item.useLimit.perGame) }));
}

class Player {
  hp = 30;
  id;
  position;
  velocity;
  rotation = 0;
  angularVelocity = 0;
  bouncyness;
  mass = 1;
  size = 1;
  friction;
  team = [];
  color;
  playericon;
  shape = 0 /* CIRCLE */;
  hoop;
  isPhysicsEnabled = true;
  dead = false;
  items = [];
  itemEffects = [];
  effectAlways = [];
  effectCollision = [];
  effectRound = [];
  constructor(settings) {
    const normalized = createPlayerSettings(settings);
    this.id = normalized.id;
    this.position = { x: 0, y: 0 };
    this.velocity = { x: 0, y: 0 };
    this.bouncyness = 1;
    this.color = "red";
    this.playericon = normalized.playericon;
    this.hoop = normalized.hoop;
    this.applySettings(normalized);
  }
  applySettings(settings) {
    this.id = settings.id;
    this.position = { ...settings.position };
    this.velocity = { ...settings.velocity };
    this.rotation = settings.rotation;
    this.angularVelocity = settings.angularVelocity;
    this.hp = settings.hp;
    this.bouncyness = settings.bouncyness;
    this.setMass(settings.mass);
    this.size = settings.size;
    this.friction = settings.friction;
    this.team = [...settings.team];
    this.color = settings.color;
    this.playericon = settings.playericon;
    this.shape = settings.shape;
    this.hoop = settings.hoop;
    this.isPhysicsEnabled = settings.isPhysicsEnabled;
    this.dead = settings.isDead;
    this.items = settings.inventory.map((item) => ({ ...item }));
    for (const effect of settings.itemEffects ?? [])
      validateRuntimeItemEffectSettings(effect);
    this.itemEffects = (settings.itemEffects ?? []).map((effect) => ({ ...effect, typeValue: structuredClone(effect.typeValue) }));
    this.effectAlways = [];
    this.effectCollision = [];
    this.effectRound = [];
    for (const effect of settings.effects)
      this.addEffect(effect.trigger, createRuntimeEffect(effect));
  }
  draw(ctx) {
    if (this.dead)
      return;
    ctx.drawImage(this.hoop, this.position.x - this.size, this.position.y - this.size, this.size * 2, this.size * 2);
    ctx.drawImage(this.playericon, this.position.x - this.size, this.position.y - this.size, this.size * 2, this.size * 2);
  }
  tick(_deltaTime, _globalFriction, _drift = 0, _stopThreshold = 0) {
    if (this.dead || !this.isPhysicsEnabled)
      return;
    this.effectAlways.forEach((effect) => {
      if (effect.getType() == "EffectType.Physics" /* Physics */)
        effect.apply(this, 12);
    });
  }
  setId(id) {
    this.id = id;
  }
  getId() {
    return this.id;
  }
  setMass(inertia) {
    validatePlayerMass(inertia);
    this.mass = Math.min(inertia, 1);
  }
  getMass() {
    return this.mass;
  }
  setVel(v) {
    this.velocity.x = v.x;
    this.velocity.y = v.y;
  }
  getVel() {
    return { x: this.velocity.x, y: this.velocity.y };
  }
  setRotation(rotation) {
    this.rotation = rotation;
  }
  getRotation() {
    return this.rotation;
  }
  setAngularVelocity(angularVelocity) {
    this.angularVelocity = angularVelocity;
  }
  getAngularVelocity() {
    return this.angularVelocity;
  }
  setBounceFactor(bounce) {
    this.bouncyness = bounce;
  }
  getBounds() {
    return { x: this.size, y: this.size };
  }
  getBounceFactor() {
    return this.bouncyness;
  }
  setPos(pos) {
    this.position = { x: pos.x, y: pos.y };
  }
  getPos() {
    return { x: this.position.x, y: this.position.y };
  }
  setFriction(friction) {
    this.friction = friction;
  }
  getFriction() {
    return this.friction;
  }
  getSize() {
    return { x: this.size, y: this.size };
  }
  addHP(hp) {
    this.hp += hp;
    if (this.hp <= 0)
      this.setIsDead(true);
  }
  getHP() {
    return this.hp;
  }
  setColor(color) {
    this.color = color;
  }
  getColor() {
    return this.color;
  }
  setPlayerIcon(icon) {
    this.playericon = icon;
  }
  setSize(size) {
    this.size = size;
  }
  getShape() {
    return this.shape;
  }
  onCollision({ entity }) {
    this.effectCollision.forEach((effect) => effect.apply(entity));
  }
  getTeam() {
    return this.team;
  }
  isActive() {
    return !this.dead;
  }
  physicsEnabled() {
    return this.isPhysicsEnabled;
  }
  setHP(hp) {
    this.hp = hp;
  }
  setPhysicsEnabled(physicsEnabled) {
    this.isPhysicsEnabled = physicsEnabled;
  }
  use(item) {
    consumeInventoryItem(this.items, item);
  }
  setSetting(key, value) {
    switch (key) {
      case "hp":
        if (typeof value === "number")
          this.setHPAndDeath(value);
        break;
      case "mass":
        if (typeof value === "number")
          this.setMass(value);
        break;
      case "size":
        if (typeof value === "number")
          this.setSize(value);
        break;
      case "friction":
        if (typeof value === "number" || value === undefined)
          this.setFriction(value);
        break;
      case "position":
        if (isVector2(value))
          this.setPos(value);
        break;
      case "velocity":
        if (isVector2(value))
          this.setVel(value);
        break;
      case "team":
        if (Array.isArray(value) && value.every(Number.isFinite))
          this.setTeam([...value]);
        break;
      case "dead":
        if (typeof value === "boolean")
          this.setIsDead(value);
        break;
      case "physicsEnabled":
        if (typeof value === "boolean")
          this.setPhysicsEnabled(value);
        break;
    }
  }
  addSetting(key, value) {
    if (typeof value === "number") {
      switch (key) {
        case "hp":
          this.setHPAndDeath(this.hp + value);
          return;
        case "mass":
          this.setMass(this.mass + value);
          return;
        case "size":
          this.setSize(this.size + value);
          return;
        case "friction":
          this.setFriction((this.friction ?? 0) + value);
          return;
      }
    }
    if (isVector2(value)) {
      if (key === "position")
        this.setPos({ x: this.position.x + value.x, y: this.position.y + value.y });
      if (key === "velocity")
        this.setVel({ x: this.velocity.x + value.x, y: this.velocity.y + value.y });
    }
    if (key === "team" && Array.isArray(value) && value.every(Number.isFinite))
      this.team = [...new Set([...this.team, ...value])];
  }
  removeSetting(key, value) {
    if (typeof value === "number") {
      switch (key) {
        case "hp":
          this.setHPAndDeath(this.hp - value);
          return;
        case "mass":
          this.setMass(this.mass - value);
          return;
        case "size":
          this.setSize(this.size - value);
          return;
        case "friction":
          this.setFriction((this.friction ?? 0) - value);
          return;
      }
    }
    if (isVector2(value)) {
      if (key === "position")
        this.setPos({ x: this.position.x - value.x, y: this.position.y - value.y });
      if (key === "velocity")
        this.setVel({ x: this.velocity.x - value.x, y: this.velocity.y - value.y });
    }
    if (key === "team" && Array.isArray(value) && value.every(Number.isFinite))
      this.team = this.team.filter((team) => !value.includes(team));
    if (key === "dead")
      this.setIsDead(false);
    if (key === "physicsEnabled")
      this.setPhysicsEnabled(false);
  }
  toSettings() {
    const sett0 = this.effectAlways.map((x) => {
      return { ...x.toSettings(), trigger: "EffectTrigger.Always" /* Always */, triggerValue: [] };
    });
    const sett1 = this.effectCollision.map((x) => {
      return { ...x.toSettings(), trigger: "EffectTrigger.Collision" /* Collision */, triggerValue: [] };
    });
    const sett2 = this.effectRound.map((x) => {
      return { ...x.toSettings(), trigger: "EffectTrigger.Round" /* Round */, triggerValue: [] };
    });
    return {
      id: this.getId(),
      position: { ...this.position },
      velocity: { ...this.velocity },
      rotation: this.rotation,
      angularVelocity: this.angularVelocity,
      playericon: this.playericon,
      team: this.team,
      hoop: this.hoop,
      color: this.color,
      size: this.size,
      hp: this.hp,
      bouncyness: this.bouncyness,
      mass: this.mass,
      friction: this.friction,
      shape: this.shape,
      isPhysicsEnabled: this.isPhysicsEnabled,
      isDead: this.dead,
      effects: [
        ...sett0,
        ...sett1,
        ...sett2
      ],
      inventory: this.items.map((item) => ({ ...item })),
      ...this.itemEffects.length ? { itemEffects: this.itemEffects.map((effect) => ({ ...effect, typeValue: structuredClone(effect.typeValue) })) } : {}
    };
  }
  setTeam(team) {
    this.team = team;
  }
  setHoop(asset) {
    this.hoop = asset;
  }
  setBouncyness(bouncyness) {
    this.bouncyness = bouncyness;
  }
  setIsDead(dead) {
    this.dead = dead;
    if (dead)
      this.setVel({ x: 0, y: 0 });
  }
  AddItem(item) {
    this.items.push({ ...item });
  }
  setInventory(items) {
    this.items = items.map((item) => ({ ...item }));
  }
  resetItemUses() {
    resetInventoryTurnUses(this.items);
  }
  getInventory() {
    return this.items.map((item) => ({ ...item }));
  }
  isDead() {
    return this.dead;
  }
  getEffects() {
    return [...this.effectAlways, ...this.effectCollision];
  }
  getAlwaysEffects() {
    return [...this.effectAlways];
  }
  addItemEffect(effect, source) {
    this.itemEffects.push({ ...effect, ...source ?? {}, typeValue: structuredClone(effect.typeValue) });
    this.itemEffects = orderInstalledEffects(this.itemEffects);
  }
  removeItemEffects(itemIds) {
    this.itemEffects = this.itemEffects.filter((effect) => !effect.itemId || !itemIds.has(effect.itemId));
  }
  advanceItemEffectsTurn() {
    this.itemEffects = this.itemEffects.flatMap((effect) => {
      const next = advanceRuntimeItemEffect(effect);
      return next ? [{ ...next, ...effect.itemId ? { itemId: effect.itemId } : {}, ...effect.order === undefined ? {} : { order: effect.order } }] : [];
    });
  }
  getItemEffects() {
    return this.itemEffects.map((effect) => ({ ...effect, typeValue: structuredClone(effect.typeValue) }));
  }
  addEffect(trigger, effect) {
    switch (trigger) {
      case "EffectTrigger.Always" /* Always */:
        this.effectAlways.push(effect);
        break;
      case "EffectTrigger.Collision" /* Collision */:
        this.effectCollision.push(effect);
        break;
      case "EffectTrigger.Round" /* Round */:
        this.effectRound.push(effect);
        break;
      default:
        console.error("TODO", trigger);
    }
  }
  setHPAndDeath(hp) {
    this.hp = hp;
    if (hp <= 0)
      this.setIsDead(true);
  }
}
function isVector2(value) {
  return typeof value === "object" && value !== null && "x" in value && "y" in value && typeof value.x === "number" && typeof value.y === "number";
}

function createRuntimePlayer(settings) {
  return new Player(settings);
}

class EntityManager {
  entities = [];
  constructor(entities = []) {
    this.entities = entities.map((entity) => createRuntimePlayer(entity));
  }
  addEntity(entity) {
    if (Array.isArray(entity))
      entity.forEach((e) => this.entities.push(e));
    else
      this.entities.push(entity);
  }
  getEntities() {
    return this.entities;
  }
  getEntityById(id) {
    return this.entities.find((e) => e.getId() === id);
  }
  getEntityAt(x, y, padding = 0) {
    return this.entities.find((e) => {
      if (e.isDead())
        return false;
      const dist = Math.hypot(e.getPos().x - x, e.getPos().y - y);
      return dist < e.getBounds().x + padding;
    });
  }
  resetSpeeds() {
    this.entities.forEach((entity) => entity.setVel({ x: 0, y: 0 }));
  }
  serialize() {
    return this.entities.map((player) => player.toSettings());
  }
  applySerializedState(state) {
    this.applySettings(state);
  }
  applySettings(state) {
    const existing = new Map(this.entities.map((entity) => [entity.getId(), entity]));
    this.entities = state.map((settings) => {
      const entity = existing.get(settings.id);
      if (entity instanceof Player) {
        entity.applySettings(settings);
        return entity;
      }
      return createRuntimePlayer(settings);
    });
  }
  addPlayer(data) {
    this.entities.push(createRuntimePlayer(data));
  }
  tick(dt, friction) {
    this.entities.forEach((e) => e.tick(dt, friction));
  }
  draw(ctx) {
    this.entities.forEach((entity) => entity.draw(ctx));
  }
  clone() {
    const settings = this.toSettings();
    return new EntityManager(settings);
  }
  toSettings() {
    return this.entities.map((player) => player.toSettings());
  }
}

class PlaybackSystem {
  systemId = "core.playback";
  remainingFrames = 0;
  syncPending = false;
  completionPending = false;
  finalState;
  cb;
  start(frames, finalState, cb) {
    this.finalState = finalState;
    this.remainingFrames = frames;
    this.syncPending = frames === 0;
    this.cb = cb;
  }
  toSettings() {
    return { systemId: this.systemId, schemaVersion: 1, state: { remainingFrames: this.remainingFrames, syncPending: this.syncPending, completionPending: this.completionPending, finalState: this.finalState ? JSON.parse(JSON.stringify(this.finalState)) : null } };
  }
  ticker(ctx) {
    if (ctx.state !== "GameState.Playing" /* Playing */)
      return;
    if (this.remainingFrames > 0) {
      this.remainingFrames--;
      if (this.remainingFrames === 0)
        this.syncPending = true;
    }
  }
  flush(ctx) {
    if (!this.syncPending || this.finalState === undefined)
      return;
    this.applyHardSync(ctx.entities);
    this.completionPending = true;
    if (ctx.state === "GameState.Playing" /* Playing */)
      ctx.state = "GameState.Playing_done" /* Playing_done */;
  }
  drainCompletion() {
    if (!this.completionPending)
      return;
    this.completionPending = false;
    if (this.cb)
      this.cb();
  }
  applyHardSync(entities) {
    if (!this.finalState)
      return;
    entities.applySettings(this.finalState);
    this.finalState = undefined;
  }
  getRemainingFrames() {
    return this.remainingFrames;
  }
}

var DEFAULT_ITEM_ECONOMY = {
  fixedLoadouts: [],
  mapPickups: []
};
function validateItemEconomySettings(settings) {
  if (!isRecord2(settings) || !Array.isArray(settings.fixedLoadouts) || !Array.isArray(settings.mapPickups)) {
    throw new Error("Item economy requires fixed loadouts and map pickups arrays");
  }
  const teams = new Set;
  for (const loadout of settings.fixedLoadouts) {
    if (!isRecord2(loadout))
      throw new Error("Item loadouts require a non-negative team and items array");
    const team = loadout.team;
    const items = loadout.items;
    if (typeof team !== "number" || !Number.isSafeInteger(team) || team < 0 || !Array.isArray(items)) {
      throw new Error("Item loadouts require a non-negative team and items array");
    }
    if (teams.has(team))
      throw new Error("Item economy allows only one loadout per team");
    teams.add(team);
    for (const item of items) {
      if (!isRecord2(item))
        throw new Error("Fixed loadout items require an id and positive use count");
      const itemId = item.itemId;
      const uses = item.uses;
      if (typeof itemId !== "string" || !itemId || typeof uses !== "number" || !Number.isSafeInteger(uses) || uses < 1) {
        throw new Error("Fixed loadout items require an id and positive use count");
      }
    }
  }
  for (const pickup of settings.mapPickups)
    validateItemPickup(pickup);
  if (settings.randomDraw !== undefined) {
    const draw = settings.randomDraw;
    if (!isRecord2(draw))
      throw new Error("Seeded item draws require a safe seed, non-empty item pool, and positive draws per turn");
    const seed = draw.seed;
    const itemIds = draw.itemIds;
    const drawsPerTurn = draw.drawsPerTurn;
    if (typeof seed !== "number" || !Number.isSafeInteger(seed) || !Array.isArray(itemIds) || itemIds.length === 0 || !itemIds.every((itemId) => typeof itemId === "string" && itemId) || typeof drawsPerTurn !== "number" || !Number.isSafeInteger(drawsPerTurn) || drawsPerTurn < 1) {
      throw new Error("Seeded item draws require a safe seed, non-empty item pool, and positive draws per turn");
    }
  }
  if (settings.mysteryBox !== undefined) {
    const box = settings.mysteryBox;
    if (!isRecord2(box) || !Array.isArray(box.candidatePool) || box.candidatePool.length === 0 || !box.candidatePool.every((itemId) => typeof itemId === "string" && itemId)) {
      throw new Error("Mystery box rewards require a non-empty candidate pool");
    }
    if (box.allowMysteryBoxReward !== undefined && typeof box.allowMysteryBoxReward !== "boolean") {
      throw new Error("Mystery box recursion flag must be a boolean");
    }
  }
}
function isRecord2(value) {
  return typeof value === "object" && value !== null;
}

function isValidInput(input) {
  if (!input || typeof input !== "object")
    return false;
  const candidate = input;
  return typeof candidate.actorId === "string" && candidate.actorId.length > 0 && typeof candidate.angle === "number" && Number.isFinite(candidate.angle) && candidate.angle >= 0 && candidate.angle < 360 && typeof candidate.power === "number" && Number.isFinite(candidate.power) && candidate.power > 0 && candidate.power <= 10;
}

class AiTurnEmitter {
  producer;
  constructor(producer) {
    this.producer = producer;
  }
  executeTurn(handler, aiSettings, targetEmitter) {
    const decision = this.producer.computeTurn(handler, aiSettings);
    if (!decision)
      return false;
    let actionSubmitted = false;
    if (decision.itemUse) {
      const { actorId, itemId, target } = decision.itemUse;
      const actor = handler.getEntityManager().getEntityById(actorId);
      if (actor && !actor.isDead() && actor.getTeam().includes(aiSettings.team)) {
        targetEmitter.sendItemUse?.(actorId, itemId, target);
        actionSubmitted = true;
      }
    }
    if (decision.shot) {
      const { actorId, angle, power } = decision.shot;
      const actor = handler.getEntityManager().getEntityById(actorId);
      if (actor && !actor.isDead() && actor.getTeam().includes(aiSettings.team) && isValidInput({ actorId, angle, power })) {
        targetEmitter.sendShot(actorId, angle, power);
        actionSubmitted = true;
      }
    }
    return actionSubmitted;
  }
}

class EasyAi {
  computeTurn(handler, aiSettings) {
    const aiActors = handler.getEntityManager().getEntities().filter((e) => !e.isDead() && e.getTeam().includes(aiSettings.team));
    if (aiActors.length === 0)
      return;
    const random = new SeededRandom(aiSettings.seed + handler.getTurnNumber() * 31);
    const actorIndex = random.nextInt(aiActors.length);
    const actor = aiActors[actorIndex];
    const angle = random.nextInt(360);
    const power = 1 + random.nextInt(10);
    return {
      shot: {
        actorId: actor.getId(),
        angle,
        power
      }
    };
  }
}

class HardAi {
  computeTurn(handler, aiSettings) {
    const random = new SeededRandom(aiSettings.seed);
    const entities = handler.getEntityManager().getEntities();
    const aiActors = entities.filter((e) => !e.isDead() && e.getTeam().includes(aiSettings.team));
    const enemyActors = entities.filter((e) => !e.isDead() && !e.getTeam().includes(aiSettings.team));
    if (aiActors.length === 0 || enemyActors.length === 0)
      return;
    const maxSimulations = aiSettings.decisionLimits?.maxSimulations ?? 36;
    const maxAngleSamples = aiSettings.decisionLimits?.maxAngleSamples ?? 12;
    const maxForceSamples = aiSettings.decisionLimits?.maxForceSamples ?? 3;
    const forceSamples = [4, 7, 10].slice(0, maxForceSamples);
    const angleOffset = random.nextInt(360);
    let simCount = 0;
    let bestScore = -Infinity;
    const bestChoices = [];
    for (const aiActor of aiActors) {
      if (simCount >= maxSimulations)
        break;
      const aiPos = aiActor.getPos();
      const candidateAngles = [];
      for (const enemy of enemyActors) {
        const enemyPos = enemy.getPos();
        const dx = enemyPos.x - aiPos.x;
        const dy = enemyPos.y - aiPos.y;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle < 0)
          angle += 360;
        candidateAngles.push({ angle: Math.round(angle) % 360, aimedAtEnemy: true });
      }
      let angleStep = 360 / Math.max(1, maxAngleSamples);
      for (let i = 0;i < maxAngleSamples; i++) {
        candidateAngles.push({ angle: Math.round((i * angleStep + angleOffset) % 360) % 360, aimedAtEnemy: false });
      }
      for (const candidate of candidateAngles) {
        if (simCount >= maxSimulations)
          break;
        for (const power of forceSamples) {
          if (simCount >= maxSimulations)
            break;
          simCount++;
          let score = 0;
          try {
            const sim = handler.simulateTurn(aiActor.getId(), candidate.angle, power);
            for (const pSnapshot of sim.finalState) {
              if (pSnapshot.team.includes(aiSettings.team)) {
                if (pSnapshot.isDead)
                  score -= 1e4;
              } else {
                if (pSnapshot.isDead)
                  score += 5000;
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
              aimedAtEnemy: candidate.aimedAtEnemy
            });
          }
        }
      }
    }
    if (bestChoices.length === 0)
      return;
    let tieGroup = bestChoices;
    if (bestScore === 0) {
      const aimed = tieGroup.filter((choice2) => choice2.aimedAtEnemy);
      if (aimed.length > 0)
        tieGroup = aimed;
    }
    const choice = tieGroup[random.nextInt(tieGroup.length)];
    return {
      shot: { actorId: choice.actorId, angle: choice.angle, power: choice.power }
    };
  }
}

class MediumAi {
  computeTurn(handler, aiSettings) {
    const entities = handler.getEntityManager().getEntities();
    const aiActors = entities.filter((e) => !e.isDead() && e.getTeam().includes(aiSettings.team));
    const enemyActors = entities.filter((e) => !e.isDead() && !e.getTeam().includes(aiSettings.team));
    if (aiActors.length === 0 || enemyActors.length === 0)
      return;
    const random = new SeededRandom(aiSettings.seed + handler.getTurnNumber() * 37);
    const worldSize = handler.getContext().worldSize;
    let bestScore = -Infinity;
    let bestChoice;
    for (const aiActor of aiActors) {
      const aiPos = aiActor.getPos();
      for (const enemyActor of enemyActors) {
        const enemyPos = enemyActor.getPos();
        const dx = enemyPos.x - aiPos.x;
        const dy = enemyPos.y - aiPos.y;
        const dist = Math.hypot(dx, dy);
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle < 0)
          angle += 360;
        let score = 1000 - dist;
        if (worldSize.x > 0 && worldSize.y > 0) {
          const nearLeftEdge = aiPos.x < 60 && dx < 0;
          const nearRightEdge = aiPos.x > worldSize.x - 60 && dx > 0;
          const nearTopEdge = aiPos.y < 60 && dy < 0;
          const nearBottomEdge = aiPos.y > worldSize.y - 60 && dy > 0;
          if (nearLeftEdge || nearRightEdge || nearTopEdge || nearBottomEdge) {
            score -= 500;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          const calculatedPower = Math.min(10, Math.max(2, Math.round(dist / 30)));
          bestChoice = {
            actorId: aiActor.getId(),
            angle: Math.round(angle) % 360,
            power: calculatedPower
          };
        }
      }
    }
    if (!bestChoice)
      return;
    const angleVariance = random.nextInt(5) - 2;
    const finalAngle = (bestChoice.angle + angleVariance + 360) % 360;
    return {
      shot: {
        actorId: bestChoice.actorId,
        angle: finalAngle,
        power: bestChoice.power
      }
    };
  }
}

function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validateAiSettings(settings) {
  if (!isRecord3(settings)) {
    throw new Error("AI settings must be an object");
  }
  if (settings.difficulty !== "easy" && settings.difficulty !== "medium" && settings.difficulty !== "hard") {
    throw new Error("AI difficulty must be 'easy', 'medium', or 'hard'");
  }
  if (typeof settings.seed !== "number" || !Number.isSafeInteger(settings.seed)) {
    throw new Error("AI seed must be an integer");
  }
  if (typeof settings.team !== "number" || !Number.isSafeInteger(settings.team) || settings.team < 0) {
    throw new Error("AI team must be a non-negative integer");
  }
  if (settings.decisionLimits !== undefined) {
    if (!isRecord3(settings.decisionLimits)) {
      throw new Error("AI decision limits must be an object");
    }
    const { maxSimulations, maxAngleSamples, maxForceSamples } = settings.decisionLimits;
    if (maxSimulations !== undefined && (typeof maxSimulations !== "number" || !Number.isSafeInteger(maxSimulations) || maxSimulations <= 0)) {
      throw new Error("maxSimulations must be a positive integer");
    }
    if (maxAngleSamples !== undefined && (typeof maxAngleSamples !== "number" || !Number.isSafeInteger(maxAngleSamples) || maxAngleSamples <= 0)) {
      throw new Error("maxAngleSamples must be a positive integer");
    }
    if (maxForceSamples !== undefined && (typeof maxForceSamples !== "number" || !Number.isSafeInteger(maxForceSamples) || maxForceSamples <= 0)) {
      throw new Error("maxForceSamples must be a positive integer");
    }
  }
}

function createAiSettings(input) {
  const settings = {
    difficulty: input.difficulty,
    seed: input.seed,
    team: input.team,
    ...input.decisionLimits === undefined ? {} : { decisionLimits: { ...input.decisionLimits } }
  };
  validateAiSettings(settings);
  return structuredClone(settings);
}
function createAiProducer(settings) {
  validateAiSettings(settings);
  switch (settings.difficulty) {
    case "easy":
      return new EasyAi;
    case "medium":
      return new MediumAi;
    case "hard":
      return new HardAi;
  }
}
function createAiTurnEmitter(settings) {
  return new AiTurnEmitter(createAiProducer(settings));
}
var koreAi = {
  createSettings: createAiSettings,
  createProducer: createAiProducer,
  createTurnEmitter: createAiTurnEmitter
};

class AiBattleSystem {
  handler;
  targetEmitter;
  systemId = "ai.battle";
  emitter0;
  emitter1;
  settings0;
  settings1;
  constructor(handler, targetEmitter, aiTeam0, aiTeam1) {
    this.handler = handler;
    this.targetEmitter = targetEmitter;
    this.emitter0 = koreAi.createTurnEmitter(aiTeam0);
    this.emitter1 = koreAi.createTurnEmitter(aiTeam1);
    this.settings0 = aiTeam0;
    this.settings1 = aiTeam1;
  }
  static fromSettings(state) {
    const team0 = state.team0;
    const team1 = state.team1;
    if (!team0 || !team1 || !Number.isFinite(team0.seed) || !Number.isFinite(team1.seed) || !Number.isSafeInteger(team0.team) || !Number.isSafeInteger(team1.team))
      throw new Error("Malformed AI battle settings");
    return new AiBattleSystem(undefined, undefined, structuredClone(team0), structuredClone(team1));
  }
  toSettings() {
    return {
      systemId: this.systemId,
      schemaVersion: 1,
      state: { team0: { ...this.settings0 }, team1: { ...this.settings1 } }
    };
  }
  ticker(ctx, _dt, _friction) {
    if (!this.handler || !this.targetEmitter)
      return;
    if (ctx.state !== "GameState.Your_turn" /* Your_turn */)
      return;
    const team = this.handler.getActiveTeam();
    const rule = this.handler.getRuleState();
    if (rule.phase === "item" /* Item */) {
      if (!this.targetEmitter.skipPhase)
        throw new Error("KI vs KI requires an emitter with phase skipping");
      this.targetEmitter.skipPhase();
      return;
    }
    if (rule.phase !== "physics" /* Physics */)
      return;
    const emitter = team === 0 ? this.emitter0 : this.emitter1;
    const aiSettings = team === 0 ? this.settings0 : this.settings1;
    const submitted = emitter.executeTurn(this.handler, aiSettings, this.targetEmitter);
    if (!submitted) {
      console.warn(`KI vs KI: team ${team} produced no action in the physics phase; submitting a neutral shot`);
      const actor = this.handler.getEntityManager().getEntities().find((entity) => !entity.isDead() && entity.getTeam().includes(team));
      if (actor)
        this.targetEmitter.sendShot(actor.getId(), 0, 4);
    }
  }
  getEmitter() {
    return this.targetEmitter;
  }
  handleMousePressed() {}
  handleMouseReleased() {}
  handleMouseWheel(_event) {}
  updateMouse(_x, _y) {}
  reset() {}
}

class AiOpponentSystem {
  handler;
  targetEmitter;
  settings;
  systemId = "ai.opponent";
  emitter;
  constructor(handler, targetEmitter, settings) {
    this.handler = handler;
    this.targetEmitter = targetEmitter;
    this.settings = settings;
    this.emitter = koreAi.createTurnEmitter(settings);
  }
  static fromSettings(state) {
    const ai = state.ai;
    if (!ai || !Number.isFinite(ai.seed) || !Number.isSafeInteger(ai.team) || ai.difficulty !== "easy" && ai.difficulty !== "medium" && ai.difficulty !== "hard")
      throw new Error("Malformed AI opponent settings");
    return new AiOpponentSystem(undefined, undefined, structuredClone(ai));
  }
  toSettings() {
    return { systemId: this.systemId, schemaVersion: 1, state: { ai: structuredClone(this.settings) } };
  }
  ticker(ctx, _dt, _friction) {
    if (!this.handler || !this.targetEmitter || ctx.state !== "GameState.Your_turn" /* Your_turn */ && ctx.state !== "GameState.Opponents_turn" /* Opponents_turn */ || this.handler.getActiveTeam() !== this.settings.team)
      return;
    const rule = this.handler.getRuleState();
    if (rule.phase === "item" /* Item */) {
      this.targetEmitter.skipPhase?.();
      return;
    }
    if (rule.phase !== "physics" /* Physics */)
      return;
    if (this.emitter.executeTurn(this.handler, this.settings, this.targetEmitter))
      return;
    const actor = this.handler.getEntityManager().getEntities().find((entity) => !entity.isDead() && entity.getTeam().includes(this.settings.team));
    if (actor)
      this.targetEmitter.sendShot(actor.getId(), 0, 4);
  }
}

function getCollisionRole(structure) {
  return structure.getCollisionRole();
}
function getOuterContainmentBoundaries(structures) {
  const explicit = structures.filter((structure) => {
    if (structure.getShape() === 1 /* LINE */)
      return false;
    const role = getCollisionRole(structure);
    return role === "containment" || role === "both";
  });
  const inferred = structures.filter((candidate) => {
    if (candidate.getShape() === 1 /* LINE */)
      return false;
    if (getCollisionRole(candidate) === "solid")
      return false;
    const boundary = candidate;
    const enclosedStructures = structures.filter((structure) => structure !== candidate && structure.getShape() !== 1 /* LINE */);
    return enclosedStructures.length > 0 && enclosedStructures.every((structure) => containsPoint(boundary, structure.getPos()));
  });
  const seen = new Set;
  for (const boundary of explicit)
    seen.add(boundary);
  return [...explicit, ...inferred.filter((boundary) => !seen.has(boundary))];
}
function containsCircle(boundary, circle) {
  const center = circle.getPos();
  const radius = circle.getBounds().x;
  if (boundary.getShape() === 0 /* CIRCLE */) {
    const outerRadius = boundary.getBounds().x - radius;
    const outerCenter = boundary.getPos();
    return outerRadius >= 0 && (center.x - outerCenter.x) ** 2 + (center.y - outerCenter.y) ** 2 <= outerRadius ** 2;
  }
  const position = boundary.getPos();
  const bounds = boundary.getBounds();
  return center.x - radius >= position.x && center.x + radius <= position.x + bounds.x && center.y - radius >= position.y && center.y + radius <= position.y + bounds.y;
}
function containsPoint(boundary, point) {
  if (boundary.getShape() === 0 /* CIRCLE */) {
    const center = boundary.getPos();
    return (point.x - center.x) ** 2 + (point.y - center.y) ** 2 <= boundary.getBounds().x ** 2;
  }
  const position = boundary.getPos();
  const bounds = boundary.getBounds();
  return point.x >= position.x && point.x <= position.x + bounds.x && point.y >= position.y && point.y <= position.y + bounds.y;
}

class BoundarySystem {
  systemId = "core.boundary";
  toSettings() {
    return { systemId: this.systemId, schemaVersion: 1, state: {} };
  }
  ticker(ctx, _dt, _friction) {
    const boundaries = getOuterContainmentBoundaries(ctx.structures);
    if (boundaries.length === 0)
      return;
    for (const entity of ctx.entities.getEntities()) {
      if (!entity.isDead() && !boundaries.every((boundary) => containsCircle(boundary, entity)))
        entity.setIsDead(true);
    }
  }
}

class LogEmitter {
  sendShot(actorId, angle, power) {
    console.debug("Log Emitter", { actorId, angle, power });
  }
  sendItemUse(actorId, itemId, target) {
    console.log("sendItemUse", JSON.stringify({ actorId, itemId, target }));
  }
}

class EmitterSystem {
  onError;
  systemId = "core.emitter";
  emitter;
  constructor(em, onError) {
    this.onError = onError;
    if (em)
      this.emitter = em;
    else
      this.emitter = new LogEmitter;
  }
  setErrorHandler(onError) {
    this.onError = onError;
  }
  toSettings() {
    return { systemId: this.systemId, schemaVersion: 1, state: {} };
  }
  ticker(ctx, _dt, _friction) {
    if (ctx.state !== "GameState.Turn_done" /* Turn_done */)
      return;
    if (!ctx.mouse.turn) {
      return;
    }
    const { actorId, angle, power } = ctx.mouse.turn;
    try {
      this.emitter.sendShot(actorId, angle, power);
    } catch (error) {
      this.onError?.(error);
      ctx.state = "GameState.Your_turn" /* Your_turn */;
      return;
    }
    if (ctx.state === "GameState.Turn_done" /* Turn_done */)
      ctx.state = "GameState.Waiting_for_server" /* Waiting_for_server */;
  }
}

class EffectSystem {
  systemId = "core.effects";
  newRound;
  constructor(newRound = false) {
    this.newRound = newRound;
  }
  toSettings() {
    return { systemId: this.systemId, schemaVersion: 1, state: { newRound: this.newRound } };
  }
  ticker(ctx, _dt, _friction) {
    if (ctx.state === "GameState.Turn_done" /* Turn_done */) {
      this.newRound = true;
      return;
    }
    if (!this.newRound)
      return;
    console.log("new Round", this.newRound);
  }
  preTick(_ctx, _deltatime, _globalfriction) {}
  tick(_ctx, _deltatime, _globalfriction) {}
  postTick(_ctx, _deltatime, _globalfriction) {}
}

class GameStateManager {
  systemId = "core.game-state-manager";
  constructor() {}
  ticker(ctx, _dt, _friction) {
    switch (ctx.state) {
      case "GameState.Starting" /* Starting */:
        ctx.state = "GameState.Waiting_for_Players" /* Waiting_for_Players */;
        break;
      case "GameState.Waiting_for_Players" /* Waiting_for_Players */:
        ctx.state = "GameState.ChooseTeam" /* ChooseTeam */;
        break;
      case "GameState.ChooseTeam" /* ChooseTeam */:
        ctx.state = "GameState.Waiting_for_Players" /* Waiting_for_Players */;
        break;
      case "GameState.Your_turn" /* Your_turn */:
        break;
      case "GameState.Opponents_turn" /* Opponents_turn */:
        break;
      case "GameState.Turn_done" /* Turn_done */:
        break;
      case "GameState.Round_done" /* Round_done */:
        break;
      case "GameState.Simulating" /* Simulating */:
        break;
      case "GameState.Simulating_done" /* Simulating_done */:
        break;
      case "GameState.Playing" /* Playing */:
        break;
      case "GameState.Playing_done" /* Playing_done */:
        ctx.state = "GameState.Waiting_for_server" /* Waiting_for_server */;
        break;
      case "GameState.Waiting_for_server" /* Waiting_for_server */:
        ctx.state = "GameState.ChooseTeam" /* ChooseTeam */;
        break;
      case "GameState.Game_over" /* Game_over */:
        break;
      case "GameState.Goal_scored" /* Goal_scored */:
        ctx.state = "GameState.Error" /* Error */;
        break;
      case "GameState.Error" /* Error */:
        break;
    }
  }
  toSettings() {
    return { systemId: this.systemId, schemaVersion: 1, state: {} };
  }
}

class MatchStateIndicator {
  input;
  getRulePhase;
  getSelectedItem;
  systemId = "ui.match-state-indicator";
  context;
  rulePhase = "physics";
  selectedItemId = null;
  constructor(input, getRulePhase, getSelectedItem) {
    this.input = input;
    this.getRulePhase = getRulePhase;
    this.getSelectedItem = getSelectedItem;
  }
  toSettings() {
    return { systemId: this.systemId, schemaVersion: 1, state: { rulePhase: this.rulePhase, selectedItemId: this.selectedItemId } };
  }
  ticker(ctx, _dt, _friction) {
    this.context = ctx;
  }
  setRulePhase(phase) {
    this.rulePhase = phase;
  }
  setSelectedItem(itemId) {
    this.selectedItemId = itemId;
  }
  draw(renderer) {
    const context = this.context;
    if (!context)
      return;
    const team = context.activeTeam;
    const turn = context.currTurn + 1;
    const phase = this.getRulePhase ? this.getRulePhase() : this.rulePhase;
    const force = this.input?.chargePower ?? 0;
    const item = this.getSelectedItem ? this.getSelectedItem() : this.selectedItemId ?? "None";
    renderer.push();
    renderer.setFillColor("#1e293b");
    const lines = [
      `Team: ${team + 1}`,
      `Phase: ${phase}`,
      `Turn: ${turn}`,
      `Force: ${Math.round(force * 10) / 10}`,
      `Item: ${item}`
    ];
    let y = 36;
    for (const line of lines) {
      renderer.drawText(line, 20, y, 16);
      y += 22;
    }
    renderer.pop();
  }
}

class PhysicsSystem {
  systemId = "core.physics";
  onCollision;
  STOP_THRESHOLD = 0.01;
  strategy;
  DEFAULTFPS;
  activeContactPairs = new Set;
  objectIdentities = new WeakMap;
  nextObjectIdentity = 1;
  constructor(strategy, fps = 1) {
    this.strategy = strategy;
    this.DEFAULTFPS = fps;
  }
  toSettings() {
    return { systemId: this.systemId, schemaVersion: 1, state: { fps: this.DEFAULTFPS, contacts: [...this.activeContactPairs].sort() } };
  }
  ticker(ctx, dt = this.DEFAULTFPS, _friction) {
    this.registerContactIdentities(ctx);
    const activeEntities = ctx.entities.getEntities().filter((e) => !e.isDead() && e.physicsEnabled());
    let maxDisplacement = 0;
    for (const e of activeEntities) {
      const vel = e.getVel();
      const disp = Math.hypot(vel.x, vel.y) * dt;
      if (disp > maxDisplacement) {
        maxDisplacement = disp;
      }
    }
    const stepSize = CCD_MAX_STEP_SIZE;
    const substeps = maxDisplacement > stepSize ? Math.min(Math.ceil(maxDisplacement / stepSize), MAX_CCD_SUBSTEPS) : 1;
    const contactedPairsThisTick = new Set;
    if (substeps <= 1) {
      this.resolveAllCollisions(ctx, contactedPairsThisTick);
    } else {
      for (const e of activeEntities) {
        const vel = e.getVel();
        const pos = e.getPos();
        e.setPos({
          x: pos.x - vel.x * dt,
          y: pos.y - vel.y * dt
        });
      }
      const subDt = dt / substeps;
      for (let step = 0;step < substeps; step++) {
        for (const e of activeEntities) {
          if (e.isDead() || !e.physicsEnabled())
            continue;
          const vel = e.getVel();
          const pos = e.getPos();
          e.setPos({
            x: pos.x + vel.x * subDt,
            y: pos.y + vel.y * subDt
          });
        }
        this.resolveAllCollisions(ctx, contactedPairsThisTick);
      }
    }
    let totalMovement = 0;
    ctx.entities.getEntities().forEach((entity) => {
      if (entity.isDead() || !entity.physicsEnabled())
        return;
      const speed = Math.sqrt(entity.getVel().x ** 2 + entity.getVel().y ** 2);
      if (speed < this.STOP_THRESHOLD) {
        entity.setVel({ x: 0, y: 0 });
      } else {
        totalMovement += speed;
      }
    });
    this.activeContactPairs = this.collectCurrentContactPairs(ctx);
  }
  resolveAllCollisions(ctx, contactedPairsThisTick = new Set) {
    const { entities, structures } = ctx;
    const enitityArr = entities.getEntities().filter((entity) => !entity.isDead() && entity.physicsEnabled());
    const containmentBoundaries = new Set(getOuterContainmentBoundaries(structures));
    let prevTotalOverlap = Infinity;
    for (let iter = 0;iter < MAX_CONTACT_SOLVER_ITERATIONS; iter++) {
      for (let i = 0;i < enitityArr.length; i++) {
        const entityA = enitityArr[i];
        for (let j = i + 1;j < enitityArr.length; j++) {
          const entityB = enitityArr[j];
          if (this.strategy.checkCollision(entityA, entityB)) {
            this.handlePairCollision(entityA, entityB, contactedPairsThisTick);
          }
        }
        for (let j = 0;j < structures.length; j++) {
          const structureB = structures[j];
          if (!structureB.physicsEnabled())
            continue;
          if (this.isContainmentOnly(structureB, containmentBoundaries))
            continue;
          if (this.strategy.checkCollision(entityA, structureB)) {
            this.handlePairCollision(entityA, structureB, contactedPairsThisTick);
          }
        }
      }
      let totalOverlap = 0;
      for (let i = 0;i < enitityArr.length; i++) {
        const entityA = enitityArr[i];
        for (let j = i + 1;j < enitityArr.length; j++) {
          const entityB = enitityArr[j];
          totalOverlap += this.getOverlapDistance(entityA, entityB);
        }
        for (let j = 0;j < structures.length; j++) {
          const structureB = structures[j];
          if (!structureB.physicsEnabled() || this.isContainmentOnly(structureB, containmentBoundaries))
            continue;
          totalOverlap += this.getOverlapDistance(entityA, structureB);
        }
      }
      if (totalOverlap <= 0.0001) {
        break;
      }
      const progress = prevTotalOverlap - totalOverlap;
      if (iter === MAX_CONTACT_SOLVER_ITERATIONS - 1 && totalOverlap > PHYSICS_CONTACT_SLOP && progress < 0.0001) {
        throw new Error("Unresolved penetration after max solver iterations");
      }
      prevTotalOverlap = totalOverlap;
    }
  }
  toSnapshotState() {
    return { activePairs: [...this.activeContactPairs].sort() };
  }
  restoreSnapshotState(state, ctx) {
    this.registerContactIdentities(ctx);
    if (!state) {
      this.activeContactPairs.clear();
      return;
    }
    if (!Array.isArray(state.activePairs) || !state.activePairs.every((pair) => typeof pair === "string")) {
      throw new Error("Invalid physics contact snapshot");
    }
    const available = this.collectCurrentContactPairs(ctx);
    const restored = new Set;
    let previous = "";
    for (const pair of state.activePairs) {
      if (pair <= previous || restored.has(pair) || !available.has(pair))
        throw new Error("Invalid physics contact snapshot pair");
      restored.add(pair);
      previous = pair;
    }
    this.activeContactPairs = restored;
  }
  registerContactIdentities(ctx) {
    for (const entity of ctx.entities.getEntities()) {
      const id = typeof entity.getId === "function" ? entity.getId() : this.nextObjectIdentity++;
      this.objectIdentities.set(entity, `entity:${id}`);
    }
    ctx.structures.forEach((structure, index) => {
      this.objectIdentities.set(structure, `structure:${index}`);
    });
  }
  getObjectIdentity(obj) {
    let id = this.objectIdentities.get(obj);
    if (id === undefined) {
      id = `runtime:${this.nextObjectIdentity++}`;
      this.objectIdentities.set(obj, id);
    }
    return id;
  }
  getPairKey(a, b) {
    const idA = this.getObjectIdentity(a);
    const idB = this.getObjectIdentity(b);
    return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
  }
  handlePairCollision(entityA, entityB, contactedPairs) {
    const pairKey = this.getPairKey(entityA, entityB);
    if (contactedPairs.has(pairKey) || this.activeContactPairs.has(pairKey)) {
      const origA = entityA.onCollision;
      const origB = entityB.onCollision;
      entityA.onCollision = () => {};
      entityB.onCollision = () => {};
      try {
        this.strategy.handleCollision(entityA, entityB);
      } finally {
        entityA.onCollision = origA;
        entityB.onCollision = origB;
      }
    } else {
      contactedPairs.add(pairKey);
      this.onCollision?.(entityA, entityB);
      this.strategy.handleCollision(entityA, entityB);
    }
  }
  collectCurrentContactPairs(ctx) {
    const contacts = new Set;
    const entities = ctx.entities.getEntities().filter((entity) => !entity.isDead() && entity.physicsEnabled());
    const containmentBoundaries = new Set(getOuterContainmentBoundaries(ctx.structures));
    for (let i = 0;i < entities.length; i++) {
      const entity = entities[i];
      for (let j = i + 1;j < entities.length; j++) {
        const other = entities[j];
        if (this.strategy.checkCollision(entity, other))
          contacts.add(this.getPairKey(entity, other));
      }
      for (const structure of ctx.structures) {
        if (!structure.physicsEnabled() || this.isContainmentOnly(structure, containmentBoundaries))
          continue;
        if (this.strategy.checkCollision(entity, structure))
          contacts.add(this.getPairKey(entity, structure));
      }
    }
    return contacts;
  }
  getOverlapDistance(entityA, entityB) {
    const shapeA = entityA.getShape();
    const shapeB = entityB.getShape();
    if (shapeA === 0 /* CIRCLE */ && shapeB === 0 /* CIRCLE */) {
      const cA = entityA;
      const cB = entityB;
      const dx = cB.getPos().x - cA.getPos().x;
      const dy = cB.getPos().y - cA.getPos().y;
      const dist = Math.hypot(dx, dy);
      const rSum = cA.getBounds().x + cB.getBounds().x;
      const overlap = rSum - dist;
      return Math.max(overlap - PHYSICS_CONTACT_SLOP, 0);
    }
    if (shapeA === 0 /* CIRCLE */ && shapeB === 2 /* RECTANGLE */) {
      const c = entityA;
      const r = entityB;
      const cPos = c.getPos();
      const rPos = r.getPos();
      const rBounds = r.getBounds();
      const radius = c.getBounds().x;
      const closestX = Math.max(rPos.x, Math.min(cPos.x, rPos.x + rBounds.x));
      const closestY = Math.max(rPos.y, Math.min(cPos.y, rPos.y + rBounds.y));
      const dx = cPos.x - closestX;
      const dy = cPos.y - closestY;
      const distance = Math.hypot(dx, dy);
      const overlap = radius - distance;
      return Math.max(overlap - 0.01, 0);
    }
    if (shapeA === 2 /* RECTANGLE */ && shapeB === 0 /* CIRCLE */) {
      return this.getOverlapDistance(entityB, entityA);
    }
    if (shapeA === 0 /* CIRCLE */ && shapeB === 1 /* LINE */) {
      const c = entityA;
      const l = entityB;
      const start = l.getPos();
      const end = l.getBounds();
      const segmentX = end.x - start.x;
      const segmentY = end.y - start.y;
      const lengthSq = segmentX * segmentX + segmentY * segmentY;
      const cPos = c.getPos();
      const factor = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((cPos.x - start.x) * segmentX + (cPos.y - start.y) * segmentY) / lengthSq));
      const closestX = start.x + segmentX * factor;
      const closestY = start.y + segmentY * factor;
      const dx = cPos.x - closestX;
      const dy = cPos.y - closestY;
      const distance = Math.hypot(dx, dy);
      const radius = c.getBounds().x;
      const overlap = radius - distance;
      return Math.max(overlap - 0.01, 0);
    }
    if (shapeA === 1 /* LINE */ && shapeB === 0 /* CIRCLE */) {
      return this.getOverlapDistance(entityB, entityA);
    }
    return 0;
  }
  isContainmentOnly(structureB, containmentBoundaries) {
    const role = structureB.getCollisionRole();
    if (role === "both" || role === "solid")
      return false;
    if (role === "containment")
      return true;
    return containmentBoundaries.has(structureB);
  }
  constrainToMap(entity, _ctx) {
    const pos = entity.getPos();
    const radius = entity.getBounds().x;
    const bounds = { minX: 0, maxX: 800, minY: 0, maxY: 450 };
    if (pos.x - radius < bounds.minX) {
      entity.setPos({ x: bounds.minX + radius, y: pos.y });
      entity.setVel({ x: 0, y: entity.getVel().y });
    } else if (pos.x + radius > bounds.maxX) {
      entity.setPos({ x: bounds.maxX - radius, y: pos.y });
      entity.setVel({ x: 0, y: entity.getVel().y });
    }
    if (pos.y - radius < bounds.minY) {
      entity.setPos({ x: bounds.minY + radius, y: pos.y });
      entity.setVel({ x: 0, y: entity.getVel().y });
    } else if (pos.y + radius > bounds.maxY) {
      entity.setPos({ x: bounds.maxY - radius, y: pos.y });
      entity.setVel({ x: 0, y: entity.getVel().y });
    }
  }
}

class MovementSystem {
  systemId = "core.movement";
  preTick(ctx, dt) {
    for (const entity of ctx.entities.getEntities()) {
      if (entity.isDead() || !entity.physicsEnabled())
        continue;
      const settings = entity.toSettings();
      let movement = createMovementState({ velocity: entity.getVel(), angularVelocity: settings.angularVelocity, enabled: entity.physicsEnabled() });
      for (const effect of entity.getAlwaysEffects()) {
        if (effect.getType() !== "EffectType.Movement" /* Movement */)
          continue;
        effect.apply(entity, { x: movement.velocity.x, y: movement.velocity.y, deltaTime: dt, rotation: settings.rotation, drift: ctx.drift ?? 0, stopThreshold: ctx.physics.getStopThreshold() });
        movement = createMovementState({ velocity: entity.getVel(), angularVelocity: settings.angularVelocity, enabled: entity.physicsEnabled() });
      }
    }
  }
  ticker(_ctx, _dt, _friction) {}
  toSettings() {
    return { systemId: this.systemId, schemaVersion: 1, state: {} };
  }
}

var currentTurnMode = {
  id: "current-turn",
  phases: ["physics" /* Physics */],
  maxItemsPerTurn: 0,
  winCondition: "last-team-standing" /* LastTeamStanding */,
  itemEconomy: DEFAULT_ITEM_ECONOMY
};

class RuleInterpreter {
  phases;
  maxItemsPerTurn;
  constructor(mode) {
    if (mode.phases.length === 0)
      throw new Error("A game mode requires at least one rule phase");
    if (mode.phases.includes("complete" /* Complete */))
      throw new Error("Complete cannot be a configured rule phase");
    if (!Number.isSafeInteger(mode.maxItemsPerTurn) || mode.maxItemsPerTurn < 0)
      throw new Error("Item allowance must be a non-negative integer");
    const hasItemPhase = mode.phases.includes("item" /* Item */);
    if (mode.phases.filter((phase) => phase === "item" /* Item */).length > 1)
      throw new Error("Item phase may occur only once");
    if (hasItemPhase && mode.phases[0] !== "item" /* Item */)
      throw new Error("Item phase must start a turn");
    if (hasItemPhase && mode.maxItemsPerTurn === 0)
      throw new Error("Item phase requires a positive item allowance");
    if (!hasItemPhase && mode.maxItemsPerTurn !== 0)
      throw new Error("Item allowance requires an item phase");
    validateItemEconomySettings(mode.itemEconomy);
    const shotPhases = mode.phases.filter((phase) => phase !== "item" /* Item */);
    const requiredShotPhases = ["aim" /* Aim */, "charge" /* Charge */, "push" /* Push */, "physics" /* Physics */];
    const isLegacyPhysicsOnly = shotPhases.length === 1 && shotPhases[0] === "physics" /* Physics */;
    if (!isLegacyPhysicsOnly && (shotPhases.length !== requiredShotPhases.length || !requiredShotPhases.every((phase, index) => shotPhases[index] === phase))) {
      throw new Error("Staged shots must use aim, charge, push, then physics phases");
    }
    this.phases = [...mode.phases];
    this.maxItemsPerTurn = mode.maxItemsPerTurn;
  }
  initialState(activeTeam = 0, turnNumber = 0) {
    return { phase: this.phases[0], activeTeam, turnNumber, itemUses: 0 };
  }
  getMaxItemsPerTurn() {
    return this.maxItemsPerTurn;
  }
  advancePhase(state) {
    if (state.phase === "complete" /* Complete */)
      return state;
    const phaseIndex = this.phases.indexOf(state.phase);
    if (phaseIndex < 0)
      throw new Error(`Phase ${state.phase} is not configured for this game mode`);
    return { ...state, phase: this.phases[phaseIndex + 1] ?? "complete" /* Complete */ };
  }
  useItem(state) {
    if (state.phase !== "item" /* Item */)
      throw new Error("Items may only be used during the item phase");
    if (state.itemUses >= this.maxItemsPerTurn)
      throw new Error("Item allowance has been exhausted");
    return { ...state, itemUses: state.itemUses + 1 };
  }
  nextActiveTeam(activeTeam, teamCount) {
    if (!Number.isInteger(activeTeam) || !Number.isInteger(teamCount) || teamCount < 1) {
      throw new Error("RuleInterpreter requires at least one team");
    }
    return (activeTeam + 1) % teamCount;
  }
  startNextTurn(state, teamCount) {
    if (state.phase !== "complete" /* Complete */)
      throw new Error("A turn must complete before the next turn starts");
    return {
      phase: this.phases[0],
      activeTeam: this.nextActiveTeam(state.activeTeam, teamCount),
      turnNumber: state.turnNumber + 1,
      itemUses: 0
    };
  }
}

class TurnSystem {
  static stateForTeam(activeTeam, controlledTeams) {
    return controlledTeams.includes(activeTeam) ? "GameState.Your_turn" /* Your_turn */ : "GameState.Opponents_turn" /* Opponents_turn */;
  }
}

class RoundPlayerSystem {
  systemId = "core.round-player";
  teams;
  rules = new RuleInterpreter(currentTurnMode);
  constructor(teams) {
    this.teams = teams;
  }
  toSettings() {
    return { systemId: this.systemId, schemaVersion: 1, state: { teams: [...this.teams] } };
  }
  ticker(ctx, _dt) {
    if (ctx.state !== "GameState.ChooseTeam" /* ChooseTeam */)
      return;
    const nextTurn = this.rules.startNextTurn({ phase: "complete" /* Complete */, activeTeam: ctx.activeTeam, turnNumber: ctx.currTurn, itemUses: 0 }, this.teams.length);
    ctx.activeTeam = nextTurn.activeTeam;
    ctx.currTurn = nextTurn.turnNumber;
    ctx.state = TurnSystem.stateForTeam(ctx.activeTeam, [ctx.myTeamNumber]);
  }
}

class Simulator {
  systemId = "core.simulator";
  physics;
  constructor(physics) {
    this.physics = physics;
  }
  toSettings() {
    return { systemId: this.systemId, schemaVersion: 1, state: {} };
  }
  isStatic(entities) {
    const epsilon = 0.1;
    return entities.getEntities().every((e) => {
      const vel = e.getVel();
      return Math.abs(vel.x) < epsilon && Math.abs(vel.y) < epsilon;
    });
  }
  ticker(ctx, dt, friction) {
    if (ctx.state != "GameState.Simulating" /* Simulating */)
      return;
    this.physics.ticker(ctx, dt, friction);
  }
}

function evaluateLastTeamStanding(entities, teamCount) {
  if (!Number.isSafeInteger(teamCount) || teamCount < 1)
    throw new Error("Winning evaluation requires at least one team");
  const aliveTeams = new Set;
  for (const entity of entities) {
    if (entity.isDead())
      continue;
    for (const team of entity.getTeam())
      if (team >= 0 && team < teamCount)
        aliveTeams.add(team);
  }
  if (aliveTeams.size === 0)
    return { status: "draw" /* Draw */ };
  if (aliveTeams.size === 1)
    return { status: "winner" /* Winner */, winnerTeam: [...aliveTeams][0] };
  return { status: "ongoing" /* Ongoing */ };
}

class WinningSystem {
  teamCount;
  systemId = "core.winning";
  pending;
  constructor(teamCount) {
    this.teamCount = teamCount;
  }
  toSettings() {
    return { systemId: this.systemId, schemaVersion: 1, state: { teamCount: this.teamCount, pending: this.pending ? { ...this.pending } : null } };
  }
  ticker(ctx, _dt, _friction) {
    if (ctx.state === "GameState.Game_over" /* Game_over */)
      return;
    const evaluation = evaluateLastTeamStanding(ctx.entities.getEntities(), this.teamCount);
    if (evaluation.status === "ongoing" /* Ongoing */)
      return;
    if (ctx.state === "GameState.Playing" /* Playing */) {
      this.pending = { evaluation, turn: ctx.currTurn };
      return;
    }
    this.finalize(ctx, evaluation, ctx.currTurn);
  }
  flush(ctx) {
    if (ctx.state === "GameState.Playing" /* Playing */ || ctx.state === "GameState.Game_over" /* Game_over */)
      return;
    if (this.pending === undefined && ctx.state !== "GameState.Playing_done" /* Playing_done */)
      return;
    const evaluation = evaluateLastTeamStanding(ctx.entities.getEntities(), this.teamCount);
    if (evaluation.status !== "ongoing" /* Ongoing */) {
      this.finalize(ctx, evaluation, ctx.currTurn);
    } else if (this.pending !== undefined) {
      this.finalize(ctx, this.pending.evaluation, this.pending.turn);
    }
    this.pending = undefined;
  }
  finalize(ctx, evaluation, turnNumber) {
    const result = evaluation.status === "winner" /* Winner */ ? {
      status: "winner" /* Winner */,
      winnerTeam: evaluation.winnerTeam,
      reason: "last-team-standing" /* LastTeamStanding */,
      turnNumber
    } : {
      status: "draw" /* Draw */,
      winnerTeam: null,
      reason: "draw" /* Draw */,
      turnNumber
    };
    ctx.finishMatch(result);
  }
}

var KoreInputAction;
((KoreInputAction2) => {
  KoreInputAction2["Aim"] = "aim";
  KoreInputAction2["Charge"] = "charge";
  KoreInputAction2["Push"] = "push";
  KoreInputAction2["ItemUse"] = "itemUse";
})(KoreInputAction ||= {});
function validateKoreInputMessage(value) {
  if (!isRecord4(value) || typeof value.command !== "string" || !isRecord4(value.payload))
    throw new Error("Invalid KORE input command");
  const payload = value.payload;
  if (value.command === "kore.input.action-pressed" /* ActionPressed */) {
    if (!Object.values(KoreInputAction).includes(payload.action))
      throw new Error("Invalid KORE input action");
    return;
  }
  if (value.command === "kore.input.pointer-down" /* PointerDown */ || value.command === "kore.input.pointer-move" /* PointerMove */ || value.command === "kore.input.pointer-up" /* PointerUp */) {
    if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y))
      throw new Error("Pointer coordinates must be finite");
    return;
  }
  if (value.command === "kore.input.item-use" /* ItemUse */) {
    if (typeof payload.actorId !== "string" || payload.actorId.length === 0 || typeof payload.itemId !== "string" || payload.itemId.length === 0 || !isJsonValue(payload.target))
      throw new Error("Invalid KORE item-use command");
    return;
  }
  if (value.command === "kore.input.menu" /* Menu */) {
    if (typeof payload.action !== "string" || payload.action.length === 0)
      throw new Error("Invalid KORE menu command");
    return;
  }
  throw new Error(`Unknown KORE input command '${value.command}'`);
}
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isJsonValue(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number")
    return Number.isFinite(value);
  if (Array.isArray(value))
    return value.every(isJsonValue);
  return isRecord4(value) && Object.values(value).every(isJsonValue);
}

class UiSystem {
  systemId = "ui.pointer-input";
  static MIN_DRAG_DISTANCE = 8;
  start = null;
  end = null;
  currentMouse = { x: 0, y: 0 };
  aimAngle = null;
  chargePower = null;
  selectedActorId = null;
  constructor() {}
  toSettings() {
    return { systemId: this.systemId, schemaVersion: 1, state: { start: this.start, end: this.end, currentMouse: this.currentMouse, aimAngle: this.aimAngle, chargePower: this.chargePower, selectedActorId: this.selectedActorId } };
  }
  getLocalInput(start, now) {
    if (![start.x, start.y, now.x, now.y].every(Number.isFinite))
      return;
    const dx = now.x - start.x;
    const dy = now.y - start.y;
    let rawPower = Math.sqrt(dx * dx + dy * dy);
    if (rawPower < UiSystem.MIN_DRAG_DISTANCE) {
      return;
    }
    const DISTANCE_FOR_MAX_POWER = 100;
    const factor = Math.min(rawPower / DISTANCE_FOR_MAX_POWER, 1);
    const MAX_POWER_VALUE = 10;
    const power = factor * MAX_POWER_VALUE;
    let angleRad = Math.atan2(dy, dx);
    let angleDeg = angleRad * (180 / Math.PI);
    let finalAngle = angleDeg + 180;
    finalAngle = (finalAngle % 360 + 360) % 360;
    return {
      angle: finalAngle,
      power
    };
  }
  setAimAngle(actorId, angle) {
    if (!actorId || !Number.isFinite(angle))
      throw new Error("Actor and aim angle must be valid");
    this.selectedActorId = actorId;
    this.aimAngle = (angle % 360 + 360) % 360;
  }
  setChargePower(power) {
    if (!Number.isFinite(power) || power < 0)
      throw new Error("Power must be a non-negative finite number");
    this.chargePower = Math.min(power, 10);
  }
  dispatchInput(message) {
    validateKoreInputMessage(message);
    if (message.command === "kore.input.pointer-down" /* PointerDown */) {
      this.updateMouse(message.payload.x, message.payload.y);
      this.handleMousePressed();
    } else if (message.command === "kore.input.pointer-move" /* PointerMove */) {
      this.updateMouse(message.payload.x, message.payload.y);
    } else if (message.command === "kore.input.pointer-up" /* PointerUp */) {
      this.updateMouse(message.payload.x, message.payload.y);
      this.handleMouseReleased();
    }
  }
  ticker(ctx, _dt, _friction) {
    if (ctx.state !== "GameState.Your_turn" /* Your_turn */) {
      this.clearInput();
      this.clearAimAndCharge();
      return;
    }
    if (this.aimAngle !== null && this.chargePower !== null && this.selectedActorId !== null) {
      const actor2 = ctx.entities.getEntityById(this.selectedActorId);
      if (actor2 && !actor2.isDead() && (actor2.getTeam().length === 0 || actor2.getTeam().includes(ctx.activeTeam))) {
        const input2 = { actorId: this.selectedActorId, angle: this.aimAngle, power: this.chargePower };
        if (!isValidInput(input2)) {
          this.clearAimAndCharge();
          return;
        }
        actor2.setRotation(input2.angle);
        ctx.mouse.turn = input2;
        ctx.state = "GameState.Turn_done" /* Turn_done */;
        this.clearAimAndCharge();
        this.clearInput();
        return;
      }
      this.clearAimAndCharge();
    }
    if (!this.start)
      return;
    const actor = ctx.entities.getEntityAt(this.start.x, this.start.y);
    if (!actor || actor.isDead() || actor.getTeam().length > 0 && !actor.getTeam().includes(ctx.activeTeam)) {
      this.clearInput();
      return;
    }
    if (!this.end)
      return;
    const e = this.getLocalInput(this.start, this.end);
    if (!e) {
      this.clearInput();
      return;
    }
    const input = { ...e, actorId: actor.getId() };
    if (!isValidInput(input)) {
      this.clearInput();
      return;
    }
    actor.setRotation(input.angle);
    ctx.mouse.turn = input;
    ctx.state = "GameState.Turn_done" /* Turn_done */;
    this.clearInput();
  }
  draw(_ctx) {}
  handleMouseWheel(event) {
    console.log(event);
  }
  handleMousePressed() {
    if (this.start)
      return;
    this.start = { ...this.currentMouse };
  }
  handleMouseReleased() {
    if (!this.start || this.end)
      return;
    this.end = { ...this.currentMouse };
  }
  updateMouse(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y))
      return;
    const pos = { x, y };
    this.currentMouse = { ...pos };
  }
  clearInput() {
    this.start = null;
    this.end = null;
  }
  clearAimAndCharge() {
    this.aimAngle = null;
    this.chargePower = null;
    this.selectedActorId = null;
  }
}

class EnvironmentalSystem {
  mechanics;
  structureIndexes;
  systemId = "core.environmental";
  state;
  constructor(mechanics, state, structureIndexes = []) {
    this.mechanics = mechanics;
    this.structureIndexes = structureIndexes;
    this.state = state ? structuredClone(state) : { tick: 0, active: mechanics.map((mechanic) => mechanic.type !== "triggered-zone"), triggerUntil: mechanics.map(() => 0), cooldownUntil: mechanics.map(() => 0), cyclePhase: mechanics.map(() => 0) };
    if (this.state.active.length !== mechanics.length || this.state.triggerUntil.length !== mechanics.length || this.state.cooldownUntil.length !== mechanics.length || this.state.cyclePhase.length !== mechanics.length)
      throw new Error("Malformed environmental state");
    if (!Number.isSafeInteger(this.state.tick) || !this.state.active.every(isBoolean) || !this.state.triggerUntil.every(Number.isSafeInteger) || !this.state.cooldownUntil.every(Number.isSafeInteger) || !this.state.cyclePhase.every(Number.isSafeInteger))
      throw new Error("Malformed environmental lifecycle state");
  }
  toSettings() {
    return { systemId: this.systemId, schemaVersion: 1, state: { ...structuredClone(this.state), mechanics: structuredClone(this.mechanics), structureIndexes: [...this.structureIndexes] } };
  }
  ticker(ctx) {
    this.state.tick++;
    for (let index = 0;index < this.mechanics.length; index++) {
      const mechanic = this.mechanics[index];
      let active = this.state.active[index];
      if (mechanic.type === "timed-hazard")
        active = this.state.tick >= mechanic.startTick && (this.state.tick - mechanic.startTick) % mechanic.intervalTicks < mechanic.durationTicks;
      else if (mechanic.type === "triggered-zone")
        active = this.updateTrigger(mechanic, index, ctx);
      else if (mechanic.type === "environmental-cycle") {
        const total = mechanic.phases.reduce((sum, phase2) => sum + phase2.durationTicks, 0);
        let offset = this.state.tick % total;
        let phase = 0;
        while (offset >= mechanic.phases[phase].durationTicks)
          offset -= mechanic.phases[phase].durationTicks, phase++;
        this.state.cyclePhase[index] = phase;
        active = mechanic.phases[phase].enabled;
      }
      this.state.active[index] = active;
      const structure = ctx.structures[this.structureIndexes[index]];
      if (!structure)
        continue;
      if (mechanic.type === "moving-structure" && "getPos" in structure && "setPos" in structure)
        this.move(structure, mechanic);
      if ("setPhysicsEnabled" in structure)
        structure.setPhysicsEnabled(active);
    }
  }
  updateTrigger(mechanic, index, ctx) {
    if (this.state.triggerUntil[index] > this.state.tick)
      return true;
    if (this.state.cooldownUntil[index] > this.state.tick)
      return false;
    const entered = ctx.entities.getEntities().some((entity) => {
      if (mechanic.ownerTeam !== undefined && !entity.getTeam().includes(mechanic.ownerTeam))
        return false;
      const p = entity.getPos();
      const dx = p.x - mechanic.triggerZone.x;
      const dy = p.y - mechanic.triggerZone.y;
      return dx * dx + dy * dy <= mechanic.triggerZone.r * mechanic.triggerZone.r;
    });
    if (entered) {
      this.state.triggerUntil[index] = this.state.tick + mechanic.durationTicks;
      this.state.cooldownUntil[index] = this.state.triggerUntil[index] + (mechanic.cooldownTicks ?? 0);
    }
    return entered;
  }
  move(structure, mechanic) {
    const origin = mechanic.structure;
    const progress = this.state.tick % mechanic.periodTicks / mechanic.periodTicks;
    const t = mechanic.loop === false && this.state.tick >= mechanic.periodTicks ? 1 : progress;
    const base = { x: origin.x, y: origin.y };
    structure.setPos({ x: base.x + (mechanic.to.x - base.x) * t, y: base.y + (mechanic.to.y - base.y) * t });
  }
}
function isBoolean(value) {
  return typeof value === "boolean";
}

var ENVIRONMENT_SCHEMA_VERSION = 1;
function validateEnvironmentalMechanics(value) {
  if (!Array.isArray(value))
    throw new Error("Invalid environmental mechanics");
  const ids = new Set;
  for (const mechanic of value) {
    if (!isRecord5(mechanic) || mechanic.schemaVersion !== ENVIRONMENT_SCHEMA_VERSION || typeof mechanic.id !== "string" || !mechanic.id || ids.has(mechanic.id))
      throw new Error("Invalid environmental mechanic identity");
    ids.add(mechanic.id);
    if (!isBoundary(mechanic.structure) || !Array.isArray(mechanic.effects ?? []))
      throw new Error(`Invalid environmental structure '${mechanic.id}'`);
    if (mechanic.ownerTeam !== undefined && (!Number.isSafeInteger(mechanic.ownerTeam) || mechanic.ownerTeam < 0))
      throw new Error("Invalid environmental ownership");
    switch (mechanic.type) {
      case "force-field":
        break;
      case "timed-hazard":
        if (!positiveInteger(mechanic.startTick) || !positiveInteger(mechanic.intervalTicks) || !positiveInteger(mechanic.durationTicks))
          throw new Error("Invalid timed hazard timing");
        break;
      case "triggered-zone":
        if (!isZone(mechanic.triggerZone) || !positiveInteger(mechanic.durationTicks) || mechanic.cooldownTicks !== undefined && !positiveInteger(mechanic.cooldownTicks))
          throw new Error("Invalid triggered zone timing");
        break;
      case "moving-structure":
        if (!isVector3(mechanic.to) || !positiveInteger(mechanic.periodTicks) || mechanic.loop !== undefined && typeof mechanic.loop !== "boolean")
          throw new Error("Invalid moving structure path");
        break;
      case "environmental-cycle":
        if (!Array.isArray(mechanic.phases) || mechanic.phases.length === 0 || mechanic.phases.some((phase) => !isRecord5(phase) || !positiveInteger(phase.durationTicks) || typeof phase.enabled !== "boolean"))
          throw new Error("Invalid environmental cycle");
        break;
      default:
        throw new Error(`Unsupported environmental mechanic '${String(mechanic.type)}'`);
    }
  }
}
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finite3(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function positiveInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function isVector3(value) {
  return isRecord5(value) && finite3(value.x) && finite3(value.y);
}
function isZone(value) {
  return isRecord5(value) && finite3(value.x) && finite3(value.y) && finite3(value.r) && value.r > 0;
}
function isBoundary(value) {
  if (!isRecord5(value) || !finite3(value.x) || !finite3(value.y) || !Array.isArray(value.effects))
    return false;
  if (value.type === 0 /* CIRCLE */)
    return finite3(value.r) && value.r > 0;
  if (value.type === 2 /* RECTANGLE */)
    return finite3(value.w) && finite3(value.h) && value.w > 0 && value.h > 0;
  return value.type === 1 /* LINE */ && finite3(value.x2) && finite3(value.y2);
}

function validateSystemSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Malformed system settings");
  const settings = value;
  if (typeof settings.systemId !== "string" || !/^[a-z0-9.-]{1,80}$/.test(settings.systemId))
    throw new Error("Malformed system ID");
  if (settings.schemaVersion !== 1 || !settings.state || typeof settings.state !== "object" || Array.isArray(settings.state))
    throw new Error("Unsupported or malformed system settings");
  const check = (entry) => {
    if (entry === null || typeof entry === "boolean" || typeof entry === "string")
      return;
    if (typeof entry === "number") {
      if (!Number.isFinite(entry))
        throw new Error("System settings must be finite JSON data");
      return;
    }
    if (typeof entry === "function" || typeof entry === "symbol" || typeof entry === "bigint" || typeof entry === "undefined")
      throw new Error("System settings cannot contain executable values");
    if (Array.isArray(entry)) {
      entry.forEach(check);
      return;
    }
    if (typeof entry === "object")
      Object.values(entry).forEach(check);
  };
  check(settings.state);
}
function validateSystemSettingsList(settings, order) {
  if (!Array.isArray(settings) || !Array.isArray(order) || !order.every((id) => typeof id === "string"))
    throw new Error("Malformed system snapshot");
  const ids = new Set;
  for (const entry of settings) {
    validateSystemSettings(entry);
    if (ids.has(entry.systemId))
      throw new Error("Duplicate system ID");
    ids.add(entry.systemId);
  }
  if (order.length !== settings.length || new Set(order).size !== order.length || order.some((id) => !ids.has(id)))
    throw new Error("Invalid system order");
}
function createSystemFromSettings(settings, restored = new Map) {
  validateSystemSettings(settings);
  const state = settings.state;
  switch (settings.systemId) {
    case "core.movement":
      if (Object.keys(state).length)
        throw new Error("Malformed movement settings");
      return new MovementSystem;
    case "core.playback": {
      const system = new PlaybackSystem;
      if (!Number.isSafeInteger(state.remainingFrames) || typeof state.syncPending !== "boolean" || typeof state.completionPending !== "boolean" || !(state.finalState === null || Array.isArray(state.finalState)))
        throw new Error("Malformed playback settings");
      Object.assign(system, { remainingFrames: state.remainingFrames, syncPending: state.syncPending, completionPending: state.completionPending, finalState: state.finalState === null ? undefined : structuredClone(state.finalState) });
      return system;
    }
    case "core.physics":
      if (!Number.isFinite(state.fps) || !Array.isArray(state.contacts) || !state.contacts.every((contact) => typeof contact === "string"))
        throw new Error("Malformed physics settings");
      return new PhysicsSystem(new defaultPhysics, state.fps);
    case "core.boundary":
      if (Object.keys(state).length)
        throw new Error("Malformed boundary settings");
      return new BoundarySystem;
    case "core.game-state-manager":
      if (Object.keys(state).length)
        throw new Error("Malformed game state manager settings");
      return new GameStateManager;
    case "core.winning": {
      if (typeof state.teamCount !== "number" || !Number.isSafeInteger(state.teamCount) || state.teamCount < 1 || !(state.pending === null || typeof state.pending === "object" && state.pending !== null))
        throw new Error("Malformed winning settings");
      const system = new WinningSystem(state.teamCount);
      Object.assign(system, { pending: state.pending === null ? undefined : structuredClone(state.pending) });
      return system;
    }
    case "ui.pointer-input": {
      for (const key of ["start", "end", "currentMouse", "aimAngle", "chargePower", "selectedActorId"])
        if (!(key in state))
          throw new Error("Malformed UI settings");
      const system = new UiSystem;
      Object.assign(system, structuredClone(state));
      return system;
    }
    case "core.emitter":
      if (Object.keys(state).length)
        throw new Error("Malformed emitter settings");
      return new EmitterSystem;
    case "core.effects":
      if (typeof state.newRound !== "boolean")
        throw new Error("Malformed effects settings");
      return new EffectSystem(state.newRound);
    case "core.round-player": {
      if (!Array.isArray(state.teams) || !state.teams.every((team) => typeof team === "string"))
        throw new Error("Malformed round settings");
      return new RoundPlayerSystem(state.teams);
    }
    case "core.simulator": {
      if (Object.keys(state).length)
        throw new Error("Malformed simulator settings");
      const physics = restored.get("core.physics");
      if (!(physics instanceof PhysicsSystem))
        throw new Error("Simulator requires serialized physics");
      return new Simulator(physics);
    }
    case "ui.match-state-indicator": {
      if (typeof state.rulePhase !== "string" || !(state.selectedItemId === null || typeof state.selectedItemId === "string"))
        throw new Error("Malformed match indicator settings");
      const system = new MatchStateIndicator;
      Object.assign(system, { rulePhase: state.rulePhase, selectedItemId: state.selectedItemId });
      return system;
    }
    case "ai.battle":
      return AiBattleSystem.fromSettings(state);
    case "ai.opponent":
      return AiOpponentSystem.fromSettings(state);
    case "core.environmental": {
      if (!Array.isArray(state.mechanics) || !Array.isArray(state.structureIndexes) || !state.structureIndexes.every((index) => Number.isSafeInteger(index) && index >= 0))
        throw new Error("Malformed environmental settings");
      validateEnvironmentalMechanics(state.mechanics);
      const lifecycle = { tick: state.tick, active: state.active, triggerUntil: state.triggerUntil, cooldownUntil: state.cooldownUntil, cyclePhase: state.cyclePhase };
      if (!Number.isSafeInteger(lifecycle.tick) || !Array.isArray(lifecycle.active) || !Array.isArray(lifecycle.triggerUntil) || !Array.isArray(lifecycle.cooldownUntil) || !Array.isArray(lifecycle.cyclePhase))
        throw new Error("Malformed environmental lifecycle state");
      return new EnvironmentalSystem(state.mechanics, lifecycle, state.structureIndexes);
    }
    default:
      throw new Error(`Unknown system ID '${settings.systemId}'`);
  }
}

var debug = true;
var [x, y] = [800, 450];
var debugColorStruct = debug ? "blue" : undefined;
function createPlayerStartPoints(team, players) {
  players.forEach((player) => player.size = 12);
  const teamNr = [{ x: 120, y: 150, w: 200, h: 450 - 150 }, { x: 800 - 120 * 2, y: 120, w: 200, h: 450 - 100 }];
  arrangeInGrid(players, teamNr[team], 46);
}
var friction = { friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 };
var defaultEffects = [{ trigger: "EffectTrigger.Always" /* Always */, triggerValue: [], ...new EffectMove({ typeValue: { deltaTime: 10, x: 0, y: 0 } }).toSettings() }, { trigger: "EffectTrigger.Always" /* Always */, triggerValue: [], ...new EffectPhysics({ typeValue: { ...friction } }).toSettings() }];
var deadly = { trigger: "EffectTrigger.Collision" /* Collision */, triggerValue: [], ...new EffectModifySetting({ typeValue: { operation: "set" /* Set */, key: "dead", value: true } }).toSettings() };
var IceMap = {
  schemaVersion: 1,
  screenResolution: { x, y },
  worldSize: { x, y },
  background: { type: "image", url: 2 /* slipStirkeMapIceJPG */ },
  drift: 0,
  mapBoundarys: [
    { type: 2 /* RECTANGLE */, x: 66, y: 90, w: 10, h: 270, color: debugColorStruct, effects: [...defaultEffects] },
    { type: 2 /* RECTANGLE */, x: 100, y: 50, w: 270, h: 10, color: debugColorStruct, effects: [...defaultEffects] },
    { type: 2 /* RECTANGLE */, x: 425, y: 55, w: 270, h: 10, color: debugColorStruct, effects: [...defaultEffects] },
    { type: 2 /* RECTANGLE */, x: 100, y: 385, w: 270, h: 10, color: debugColorStruct, effects: [...defaultEffects] },
    { type: 2 /* RECTANGLE */, x: 425, y: 385, w: 270, h: 10, color: debugColorStruct, effects: [...defaultEffects] },
    { type: 2 /* RECTANGLE */, x: 725, y: 90, w: 10, h: 270, color: debugColorStruct, effects: [...defaultEffects] },
    { type: 2 /* RECTANGLE */, x: 400, y: 150, w: 10, h: 150, color: debugColorStruct, effects: [...defaultEffects] },
    { type: 0 /* CIRCLE */, x: 60, y: 45, r: 10, color: debugColorStruct, effects: [...defaultEffects, deadly] },
    { type: 0 /* CIRCLE */, x: 720, y: 50, r: 10, color: debugColorStruct, effects: [...defaultEffects, deadly] },
    { type: 0 /* CIRCLE */, x: 720, y: 385, r: 10, color: debugColorStruct, effects: [...defaultEffects, deadly] },
    { type: 0 /* CIRCLE */, x: 60, y: 385, r: 10, color: debugColorStruct, effects: [...defaultEffects, deadly] },
    { type: 0 /* CIRCLE */, x: 390, y: 35, r: 10, color: debugColorStruct, effects: [...defaultEffects, deadly] },
    { type: 0 /* CIRCLE */, x: 390, y: 400, r: 10, color: debugColorStruct, effects: [...defaultEffects, deadly] }
  ]
};
var iceMap_default = { createPlayerStartPoints, IceMap };

var DEFAULT_DRIFT = 0;
function validateDrift(drift) {
  if (!Number.isFinite(drift) || drift < 0 || drift > 1)
    throw new Error("Map drift must be a finite number between 0 and 1");
}
function validateFigureCounts(playerCount, figuresPerPlayer) {
  if (!Number.isSafeInteger(playerCount) || playerCount < 1 || !Number.isSafeInteger(figuresPerPlayer) || figuresPerPlayer < 1) {
    throw new Error("Player count and figures per player must be positive integers");
  }
}
function validateGameSettings(settings) {
  if (!isRecord6(settings) || settings.schemaVersion !== 1 || typeof settings.id !== "string")
    throw new Error("Invalid game settings document");
  if (!isVector4(settings.screenResolution) || settings.screenResolution.x <= 0 || settings.screenResolution.y <= 0)
    throw new Error("Invalid screen resolution");
  if (!isRecord6(settings.friction) || ![settings.friction.friction, settings.friction.linearDrag, settings.friction.stopThreshold].every(Number.isFinite))
    throw new Error("Invalid friction settings");
  validateDrift(settings.drift);
  validateFigureCounts(settings.playerCount, settings.figuresPerPlayer);
  if (!Array.isArray(settings.myTeam) || !settings.myTeam.every(isTeam))
    throw new Error("Invalid team settings");
  if (!Array.isArray(settings.players) || !settings.players.every((player) => isRecord6(player) && isVector4(player.position) && isVector4(player.velocity) && Array.isArray(player.team) && player.team.every(isTeam) && Array.isArray(player.effects) && player.effects.every(isEffect)))
    throw new Error("Invalid player settings");
  if (!isBackground(settings.background))
    throw new Error("Invalid background settings");
  if (!Array.isArray(settings.mapBoundarys) || !settings.mapBoundarys.every(isBoundary2))
    throw new Error("Invalid map boundary settings");
  if (!Array.isArray(settings.effects) || !settings.effects.every(isEffect))
    throw new Error("Invalid effect settings");
  if (!Array.isArray(settings.items))
    throw new Error("Invalid item settings");
  try {
    settings.items.forEach(validateItemDocument);
  } catch {
    throw new Error("Invalid item settings");
  }
  if (settings.gameMode !== undefined) {
    if (settings.gameMode.schemaVersion !== undefined && settings.gameMode.schemaVersion !== 1)
      throw new Error("Unsupported game mode schema version");
    validateItemEconomySettings(settings.gameMode.itemEconomy);
    const draw = settings.gameMode.itemEconomy.randomDraw;
    if (draw && !draw.itemIds.every((itemId) => settings.items.some((item) => item.id === itemId))) {
      throw new Error("Seeded item draw references an unknown item");
    }
    const mysteryBox = settings.gameMode.itemEconomy.mysteryBox;
    if (mysteryBox && !mysteryBox.candidatePool.every((itemId) => settings.items.some((item) => item.id === itemId))) {
      throw new Error("Mystery Box pool references an unknown item");
    }
  }
  if (settings.ai !== undefined)
    validateAiSettings(settings.ai);
  if (settings.environmentalMechanics !== undefined)
    validateEnvironmentalMechanics(settings.environmentalMechanics);
}
function isRecord6(value) {
  return typeof value === "object" && value !== null;
}
function isVector4(value) {
  return isRecord6(value) && Number.isFinite(value.x) && Number.isFinite(value.y);
}
function isBackground(value) {
  if (!isRecord6(value))
    return false;
  if (value.type === "color")
    return typeof value.color === "string";
  if (value.type !== "image" || typeof value.url !== "number" && typeof value.url !== "string")
    return false;
  if (typeof value.url !== "string")
    return true;
  try {
    const url = new URL(value.url, "https://kore.invalid");
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
function isTeam(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function isEffect(value) {
  try {
    validateFullEffectSettings(value);
    return true;
  } catch {
    return false;
  }
}
function isBoundary2(value) {
  if (!isRecord6(value) || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Array.isArray(value.effects) || !value.effects.every(isEffect))
    return false;
  if (value.role !== undefined && !isStructureCollisionRole(value.role))
    return false;
  if (value.type === 0 /* CIRCLE */)
    return Number.isFinite(value.r) && value.r > 0;
  if (value.type === 2 /* RECTANGLE */)
    return Number.isFinite(value.w) && Number.isFinite(value.h) && value.w > 0 && value.h > 0;
  return value.type === 1 /* LINE */ && Number.isFinite(value.x2) && Number.isFinite(value.y2);
}
var FRICTION_TABLE = {
  ice: { friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 },
  tiles: { friction: 0.98, linearDrag: 0.05, stopThreshold: 0.15 },
  wood: { friction: 0.96, linearDrag: 0.1, stopThreshold: 0.2 },
  billiards: { friction: 0.94, linearDrag: 0.15, stopThreshold: 0.2 },
  carpet_office: { friction: 0.91, linearDrag: 0.25, stopThreshold: 0.3 },
  gym: { friction: 0.88, linearDrag: 0.4, stopThreshold: 0.4 },
  turf: { friction: 0.82, linearDrag: 0.8, stopThreshold: 0.5 },
  asphalt: { friction: 0.75, linearDrag: 1.2, stopThreshold: 0.6 },
  grass: { friction: 0.6, linearDrag: 2.5, stopThreshold: 1 },
  sand: { friction: 0.4, linearDrag: 5, stopThreshold: 2 }
};
var playerSize = 14;
var defaultHoop = 18 /* pictureReifenWEBP */;
var defaultEffects2 = [
  {
    trigger: "EffectTrigger.Always" /* Always */,
    triggerValue: [],
    ...new EffectMove({ typeValue: { deltaTime: 0, x: 0, y: 0 } }).toSettings()
  },
  {
    trigger: "EffectTrigger.Always" /* Always */,
    triggerValue: [],
    ...new EffectPhysics({ typeValue: { ...FRICTION_TABLE.ice } }).toSettings()
  }
];
function createDefaultPlayers(playerCount, figuresPerPlayer) {
  validateFigureCounts(playerCount, figuresPerPlayer);
  if (playerCount > 2)
    throw new Error("The ice map supports at most two players");
  const icons = [22 /* picturePenguinPenguinIdleFrame1WEBP */, 46 /* picturePolarBearPolarBearIdleFrame1WEBP */];
  return Array.from({ length: playerCount }, (_, team) => {
    const players = Array.from({ length: figuresPerPlayer }, () => createPlayerSettings({
      position: { x: 0, y: 0 },
      playericon: icons[team],
      team: [team],
      size: playerSize,
      hoop: defaultHoop,
      effects: defaultEffects2
    }));
    iceMap_default.createPlayerStartPoints(team, players);
    return players;
  }).flat();
}
function createDefaultGameSettings(playerCount = 2, figuresPerPlayer = 6) {
  return {
    id: "8a67d1b0-5c76-4348-bc7a-012d8c9746cc",
    players: createDefaultPlayers(playerCount, figuresPerPlayer),
    friction: FRICTION_TABLE.ice,
    items: [],
    effects: [],
    minPlayers: 2,
    maxPlayers: 2,
    allTeams: ["1bafa3d2-b0e3-4e66-8c4f-e8da14278123", "5935f4b2-b3bd-4792-a356-fdf74f20ca2e"],
    allTeamSize: 2,
    playerCount,
    figuresPerPlayer,
    gameMode: currentTurnMode,
    myTeam: [],
    ...iceMap_default.IceMap
  };
}
var GameSettings = createDefaultGameSettings();
function arrangeInGrid(players, rect, padding = 0) {
  if (players.length === 0)
    return;
  const size = players[0].size * 2;
  const cellSize = size + padding + 1;
  const cols = Math.max(1, Math.floor(rect.w / cellSize));
  const rows = Math.max(1, Math.floor(rect.h / cellSize));
  if (cols * rows < players.length)
    throw new Error("Nicht genug Platz für alle Spieler!");
  players.forEach((player, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    player.position.x = rect.x + col * cellSize + size / 2;
    player.position.y = rect.y + row * cellSize + size / 2;
  });
}

class StructureCircle {
  position;
  r;
  shape;
  mass = Infinity;
  color;
  bounce;
  vel;
  isPhysicsEnabled = true;
  friction;
  collisionEffects = [];
  alwaysEffects = [];
  roundEffects = [];
  collisionRole;
  constructor(x2, y2, r, color, effects, role) {
    this.position = { x: x2, y: y2 };
    this.r = r;
    this.shape = 0 /* CIRCLE */;
    this.color = color;
    this.bounce = Infinity;
    this.vel = { x: 0, y: 0 };
    this.collisionRole = role;
    for (const eff of effects) {
      switch (eff.trigger) {
        case "EffectTrigger.Collision" /* Collision */:
          this.collisionEffects.push(createRuntimeEffect(eff));
          continue;
        case "EffectTrigger.Round" /* Round */:
          this.roundEffects.push(createRuntimeEffect(eff));
          continue;
        case "EffectTrigger.Always" /* Always */:
          this.alwaysEffects.push(createRuntimeEffect(eff));
          continue;
        default:
          console.trace("this is not implemted yet");
          continue;
      }
    }
    this.toSettings();
  }
  draw(ctx) {
    if (!this.color)
      return;
    ctx.push();
    ctx.setFillColor(this.color);
    const { x: x2, y: y2 } = this.getPos();
    ctx.drawCircle(x2, y2, this.r);
    ctx.pop();
  }
  tick(_dt) {}
  setPos(pos) {
    if (this.position.x > pos.x * 1.1 || this.position.x < pos.x * 0.9 || (this.position.y > pos.y * 1.1 || this.position.y < pos.y * 0.9)) {
      console.error("STRUCTURE: Position weicht massiv ab!");
    }
    this.position.x = pos.x;
    this.position.y = pos.y;
  }
  getPos() {
    return { x: this.position.x, y: this.position.y };
  }
  setVel(vel) {
    this.vel = vel;
  }
  getVel() {
    return this.vel;
  }
  setMass(mass) {
    this.mass = mass;
  }
  getMass() {
    return this.mass;
  }
  setFriction(_friction) {}
  getFriction() {
    return 0;
  }
  getShape() {
    return this.shape;
  }
  getBounds() {
    return { x: this.r, y: this.r };
  }
  setBounceFactor(bounce) {
    this.bounce = bounce;
  }
  getBounceFactor() {
    return this.bounce;
  }
  onCollision({ entity }) {
    this.collisionEffects.forEach((effect) => effect.apply(entity));
  }
  getColor() {
    return this.color;
  }
  physicsEnabled() {
    return this.isPhysicsEnabled;
  }
  setPhysicsEnabled(physicsEnabled) {
    this.isPhysicsEnabled = physicsEnabled;
  }
  setColor(color) {
    this.color = color;
  }
  getCollisionRole() {
    return this.collisionRole;
  }
  setCollisionRole(role) {
    this.collisionRole = role;
  }
  toSettings() {
    const effects = [];
    this.alwaysEffects.forEach((eff) => effects.push({ trigger: "EffectTrigger.Always" /* Always */, triggerValue: [], ...eff.toSettings() }));
    this.roundEffects.forEach((eff) => effects.push({ trigger: "EffectTrigger.Round" /* Round */, triggerValue: [], ...eff.toSettings() }));
    this.collisionEffects.forEach((eff) => effects.push({ trigger: "EffectTrigger.Collision" /* Collision */, triggerValue: [], ...eff.toSettings() }));
    const out = {
      type: this.shape,
      x: this.position.x,
      y: this.position.y,
      r: this.r,
      color: this.color,
      effects
    };
    if (this.collisionRole !== undefined)
      out.role = this.collisionRole;
    return out;
  }
  getType() {
    return this.shape;
  }
  getX() {
    return this.position.x;
  }
  getY() {
    return this.position.y;
  }
}
class StructureLine {
  position;
  w;
  h;
  shape;
  mass = Infinity;
  bounce;
  color;
  vel;
  isPhysicsEnabled = true;
  effects = [];
  friction;
  constructor(x2, y2, x22, y22, color, effects = []) {
    if (!Number.isFinite(x2) || !Number.isFinite(y2) || !Number.isFinite(x22) || !Number.isFinite(y22)) {
      throw new Error("Line structures must have finite coordinates");
    }
    if (x2 === x22 && y2 === y22) {
      throw new Error("Line structures must have non-zero length");
    }
    this.position = { x: x2, y: y2 };
    this.w = x22;
    this.h = y22;
    this.color = color || "green";
    this.shape = 1 /* LINE */;
    this.vel = { x: 0, y: 0 };
    this.bounce = Infinity;
    this.effects = [];
    for (const effect of effects) {
      switch (effect.type) {
        default:
          console.log(`Effect not implemented in ${getShapeName(this.shape)}`, effect);
      }
    }
  }
  draw(ctx) {
    if (!this.color)
      return;
    ctx.setFillColor(this.color);
    ctx.setStrokeColor(this.color);
    ctx.line(this.position.x, this.position.y, this.w, this.h);
  }
  setBounceFactor(bounce) {
    this.bounce = bounce;
  }
  getBounceFactor() {
    return this.bounce;
  }
  getBounds() {
    return { x: this.w, y: this.h };
  }
  getPos() {
    return { x: this.position.x, y: this.position.y };
  }
  getVel() {
    return this.vel;
  }
  onCollision({}) {}
  setVel(vel) {
    this.vel = vel;
  }
  setMass(mass) {
    this.mass = mass;
  }
  getMass() {
    return this.mass;
  }
  setPos(pos) {
    this.position = { ...pos };
  }
  setFriction(friction2) {
    this.friction = friction2;
  }
  getFriction() {
    return this.friction ?? 1;
  }
  tick(_deltatime, _globalfriction) {}
  getShape() {
    return this.shape;
  }
  physicsEnabled() {
    return this.isPhysicsEnabled;
  }
  setPhysicsEnabled(physicsEnabled) {
    this.isPhysicsEnabled = physicsEnabled;
  }
  setColor(color) {
    this.color = color;
  }
  getCollisionRole() {
    return;
  }
  toSettings() {
    return { type: 1 /* LINE */, x: this.position.x, y: this.position.y, x2: this.w, y2: this.h, color: this.color, effects: [] };
  }
  getEffects() {
    return [];
  }
  getType() {
    return this.shape;
  }
  getX() {
    return this.position.x;
  }
  getY() {
    return this.position.y;
  }
  apply(settings) {
    throw new Error("TODO!" + settings);
  }
}
class StructureRectangle {
  x;
  y;
  w;
  h;
  collisionEffects = [];
  roundEffects = [];
  alwaysEffects = [];
  shape;
  mass = Infinity;
  bounce;
  color;
  vel;
  isPhysicsEnabled = true;
  collisionRole;
  friction;
  constructor(x2, y2, w, h, color, effects = [], role) {
    this.x = x2;
    this.y = y2;
    this.w = w;
    this.h = h;
    this.color = color;
    this.shape = 2 /* RECTANGLE */;
    this.vel = { x: 0, y: 0 };
    this.bounce = Infinity;
    this.collisionRole = role;
    for (const eff of effects) {
      switch (eff.trigger) {
        case "EffectTrigger.Collision" /* Collision */:
          this.collisionEffects.push(createRuntimeEffect(eff));
          continue;
        case "EffectTrigger.Round" /* Round */:
          this.roundEffects.push(createRuntimeEffect(eff));
          continue;
        case "EffectTrigger.Always" /* Always */:
          this.alwaysEffects.push(createRuntimeEffect(eff));
          continue;
        default:
          console.log("this is not implemted yet");
          continue;
      }
    }
  }
  draw(ctx) {
    if (!this.color)
      return;
    ctx.push();
    ctx.setFillColor(this.color);
    ctx.setStrokeColor(this.color);
    ctx.drawRect(this.x, this.y, this.w, this.h);
    ctx.pop();
  }
  setBounceFactor(bounce) {
    this.bounce = bounce;
  }
  getBounceFactor() {
    return this.bounce;
  }
  getBounds() {
    return { x: this.w, y: this.h };
  }
  getPos() {
    return { x: this.x, y: this.y };
  }
  getVel() {
    return this.vel;
  }
  onCollision({ entity }) {
    this.collisionEffects.forEach((effect) => effect.apply(entity));
  }
  setVel(vel) {
    this.vel = vel;
  }
  setMass(mass) {
    this.mass = mass;
  }
  getMass() {
    return this.mass;
  }
  setPos(pos) {
    this.x = pos.x;
    this.y = pos.y;
  }
  getFriction() {
    return this.friction ?? 1;
  }
  setFriction(friction2) {
    this.friction = friction2;
  }
  tick(_deltatime, _globalfriction) {}
  getShape() {
    return this.shape;
  }
  physicsEnabled() {
    return this.isPhysicsEnabled;
  }
  setPhysicsEnabled(physicsEnabled) {
    this.isPhysicsEnabled = physicsEnabled;
  }
  setColor(color) {
    this.color = color;
  }
  getCollisionRole() {
    return this.collisionRole;
  }
  setCollisionRole(role) {
    this.collisionRole = role;
  }
  toSettings() {
    const effects = [];
    this.alwaysEffects.forEach((effect) => effects.push({ trigger: "EffectTrigger.Always" /* Always */, triggerValue: [], ...effect.toSettings() }));
    this.collisionEffects.forEach((effect) => effects.push({ trigger: "EffectTrigger.Collision" /* Collision */, triggerValue: [], ...effect.toSettings() }));
    this.roundEffects.forEach((effect) => effects.push({ trigger: "EffectTrigger.Round" /* Round */, triggerValue: [], ...effect.toSettings() }));
    const out = {
      type: 2 /* RECTANGLE */,
      x: this.x,
      y: this.y,
      w: this.w,
      h: this.h,
      color: this.color,
      effects
    };
    if (this.collisionRole !== undefined)
      out.role = this.collisionRole;
    return out;
  }
  getType() {
    return this.shape;
  }
  getX() {
    return this.x;
  }
  getY() {
    return this.y;
  }
}
class FullStructure {
  str;
  constructor(str) {
    switch (str.type) {
      case 0 /* CIRCLE */:
        this.str = new StructureCircle(str.x, str.y, str.r, str.color, str.effects, str.role);
        break;
      case 2 /* RECTANGLE */:
        this.str = new StructureRectangle(str.x, str.y, str.w, str.h, str.color, str.effects, str.role);
        break;
      case 1 /* LINE */:
        this.str = new StructureLine(str.x, str.y, str.x2, str.y2, str.color ?? "green", str.effects);
        break;
    }
  }
  tick(deltatime, globalfriction) {
    this.str.tick(deltatime, globalfriction);
  }
  getShape() {
    return this.str.getShape();
  }
  draw(ctx) {
    this.str.draw(ctx);
  }
  getFriction() {
    return this.str.getFriction();
  }
  getPos() {
    return this.str.getPos();
  }
  getVel() {
    return this.str.getVel();
  }
  getBounceFactor() {
    return this.str.getBounceFactor();
  }
  getBounds() {
    return this.str.getBounds();
  }
  getMass() {
    return this.str.getMass();
  }
  onCollision({ entity }) {
    this.str.onCollision({ entity });
  }
  physicsEnabled() {
    return this.str.physicsEnabled();
  }
  setBounceFactor(bounce) {
    this.str.setBounceFactor(bounce);
  }
  setFriction(friction2) {
    this.str.setFriction(friction2);
  }
  setMass(mass) {
    this.str.setMass(mass);
  }
  setPhysicsEnabled(physicsEnabled) {
    this.str.setPhysicsEnabled(physicsEnabled);
  }
  setPos(pos) {
    this.str.setPos(pos);
  }
  setVel(vel) {
    this.str.setVel(vel);
  }
  getEffects() {
    return [];
  }
  toSettings() {
    return this.str.toSettings();
  }
  getCollisionRole() {
    return this.str.getCollisionRole();
  }
  isPhysicsObj() {
    return typeof this.str.getShape() === "function";
  }
}

function getBackgoundSystem(settings) {
  switch (settings?.type) {
    case "color":
      return new BackgroundColorSystem(settings.color);
    case "image":
      return new BackgroundImageSystem(settings.url);
    default:
      return new BackgroundColorSystem("cyan");
  }
}

class BackgroundImageSystem {
  url;
  constructor(url) {
    this.url = url;
  }
  tick(_deltatime, _globalfriction) {}
  draw(ctx) {
    ctx.push();
    ctx.drawImage(this.url, 0, 0, ctx.WORLD_SIZE_X, ctx.WORLD_SIZE_Y);
    ctx.pop();
  }
}

class BackgroundColorSystem {
  color;
  constructor(color) {
    this.color = color;
  }
  tick(_deltatime, _globalfriction) {}
  draw(ctx) {
    ctx.clear(this.color);
  }
  getColor() {
    return this.color;
  }
}

class MapPickupSystem {
  pickups = [];
  items = new Map;
  state;
  configure(pickups, items) {
    this.pickups = structuredClone(pickups);
    this.items = new Map(items.map((item) => [item.id, item]));
    for (const pickup of this.pickups) {
      if (!this.items.has(pickup.itemId))
        throw new Error(`Map pickup references unknown item '${pickup.itemId}'`);
    }
    this.state = this.pickups.length === 0 ? undefined : createItemPickupState(this.pickups.length);
  }
  restore(state) {
    if (this.pickups.length === 0) {
      if (state)
        throw new Error("Map pickup state requires configured map pickups");
      return;
    }
    if (!state)
      throw new Error("Configured map pickups require a serialized pickup state");
    validateItemPickupState(state, this.pickups.length);
    this.state = clonePickupState(state);
  }
  reset() {
    this.state = this.pickups.length === 0 ? undefined : createItemPickupState(this.pickups.length);
  }
  toState() {
    return this.state && clonePickupState(this.state);
  }
  getPickups() {
    return structuredClone(this.pickups);
  }
  ticker(ctx, _dt, _friction) {
    if (!this.state)
      return;
    if (this.state.turnNumber !== ctx.currTurn) {
      this.advanceRound(ctx.currTurn);
    }
    for (let pickupIndex = 0;pickupIndex < this.pickups.length; pickupIndex++) {
      const pickup = this.pickups[pickupIndex];
      const pickupState = this.state.pickups[pickupIndex];
      if (pickupState.respawnCountdown !== undefined)
        continue;
      const entitiesInRegion = ctx.entities.getEntities().filter((entity) => this.canCollect(entity, pickup, ctx.activeTeam));
      const occupants = new Set(entitiesInRegion.map((entity) => entity.getId()));
      const item = this.items.get(pickup.itemId);
      const limit = pickup.maxPickupsPerTurn ?? 1;
      for (const entity of entitiesInRegion) {
        if (pickupState.collected >= limit || pickupState.occupants.includes(entity.getId()))
          continue;
        const inventory = entity.getInventory();
        addDrawnInventoryItem(inventory, item);
        entity.setInventory(inventory);
        pickupState.collected++;
      }
      pickupState.occupants = [...occupants];
      if (pickup.respawnConfig && pickupState.collected >= limit) {
        pickupState.respawnCountdown = pickup.respawnConfig.intervalRounds;
      }
    }
  }
  advanceRound(turnNumber) {
    if (!this.state)
      return;
    const elapsedRounds = Math.max(1, turnNumber - this.state.turnNumber);
    for (let index = 0;index < this.pickups.length; index++) {
      const pickup = this.pickups[index];
      const state = this.state.pickups[index];
      state.occupants = [];
      if (!pickup.respawnConfig) {
        state.collected = 0;
        continue;
      }
      if (state.respawnCountdown !== undefined) {
        state.respawnCountdown -= elapsedRounds;
        if (state.respawnCountdown <= 0) {
          state.collected = 0;
          state.respawnCountdown = undefined;
        }
      }
    }
    this.state.turnNumber = turnNumber;
  }
  canCollect(entity, pickup, activeTeam) {
    if (entity.isDead() || !entity.getTeam().includes(activeTeam))
      return false;
    const position = entity.getPos();
    const radius = entity.getSize().x;
    const nearestX = Math.max(pickup.spawnRegion.x, Math.min(position.x, pickup.spawnRegion.x + pickup.spawnRegion.w));
    const nearestY = Math.max(pickup.spawnRegion.y, Math.min(position.y, pickup.spawnRegion.y + pickup.spawnRegion.h));
    const dx = position.x - nearestX;
    const dy = position.y - nearestY;
    return dx * dx + dy * dy <= radius * radius;
  }
}
function createItemPickupState(pickupCount, turnNumber = 0) {
  return { turnNumber, pickups: Array.from({ length: pickupCount }, () => ({ collected: 0, occupants: [] })) };
}
function clonePickupState(state) {
  return {
    turnNumber: state.turnNumber,
    pickups: state.pickups.map((pickup) => ({ collected: pickup.collected, occupants: [...pickup.occupants], ...pickup.respawnCountdown === undefined ? {} : { respawnCountdown: pickup.respawnCountdown } }))
  };
}

var ALLOW_ALL_TARGETS = {
  allowSelf: true,
  allowAlly: true,
  allowEnemy: true
};
function validateItemTarget(item, target, context) {
  const validation = item.targetValidation ?? ALLOW_ALL_TARGETS;
  if (!isRecord7(target) || typeof target.type !== "string") {
    throw new Error("Item target must be an object with a valid type");
  }
  if (target.type !== item.targetType) {
    throw new Error(`Item requires a ${item.targetType} target`);
  }
  switch (target.type) {
    case "self":
      if (!validation.allowSelf)
        throw new Error("Item does not allow self targets");
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
function validateEntityTarget(target, validation, context) {
  if (typeof target.entityId !== "string" || target.entityId.length === 0) {
    throw new Error("Entity targets require a non-empty entityId");
  }
  const entity = context.entities.find((candidate) => candidate.getId() === target.entityId);
  if (!entity || entity.isDead())
    throw new Error("Entity target must be an active entity");
  if (entity === context.actor || entity.getId() === context.actor.getId()) {
    if (!validation.allowSelf)
      throw new Error("Item does not allow self targets");
  } else if (sharesTeam(context.actor, entity)) {
    if (!validation.allowAlly)
      throw new Error("Item does not allow ally targets");
  } else if (!validation.allowEnemy) {
    throw new Error("Item does not allow enemy targets");
  }
  validateRange(context.actor.getPos(), entity.getPos(), validation.maxRange);
}
function validatePositionTarget(position, maxRange, context) {
  if (!isVector5(position))
    throw new Error("Position targets require finite x and y coordinates");
  validateWorldPosition(position, context.worldSize);
  validateRange(context.actor.getPos(), position, maxRange);
}
function validateZoneTarget(target, maxRange, context) {
  if (!isVector5(target.center) || typeof target.radius !== "number" || !Number.isFinite(target.radius) || target.radius <= 0) {
    throw new Error("Zone targets require a finite center and positive radius");
  }
  validateWorldPosition(target.center, context.worldSize);
  if (target.center.x - target.radius < 0 || target.center.y - target.radius < 0 || target.center.x + target.radius > context.worldSize.x || target.center.y + target.radius > context.worldSize.y) {
    throw new Error("Zone target must be contained within the world");
  }
  validateRange(context.actor.getPos(), target.center, maxRange);
}
function validateRange(origin, target, maxRange) {
  if (maxRange !== undefined && Math.hypot(origin.x - target.x, origin.y - target.y) > maxRange) {
    throw new Error("Item target is outside the maximum range");
  }
}
function validateWorldPosition(position, worldSize) {
  if (position.x < 0 || position.y < 0 || position.x > worldSize.x || position.y > worldSize.y) {
    throw new Error("Item target must be inside the world");
  }
}
function sharesTeam(first, second) {
  return first.getTeam().some((team) => second.getTeam().includes(team));
}
function isRecord7(value) {
  return typeof value === "object" && value !== null;
}
function isVector5(value) {
  return isRecord7(value) && typeof value.x === "number" && Number.isFinite(value.x) && typeof value.y === "number" && Number.isFinite(value.y);
}

function itemInteractionMode(item, otherItemId) {
  return item.interaction?.with?.[otherItemId] ?? item.interaction?.mode ?? "stack";
}
function validateItemCombination(item, installed, itemsById) {
  const removeItemIds = new Set;
  for (const effect of installed) {
    if (!effect.itemId)
      continue;
    const other = itemsById.get(effect.itemId);
    const mode = itemInteractionMode(item, effect.itemId);
    const reverse = other?.interaction?.with?.[item.id];
    const resolved = reverse ?? mode;
    if (resolved === "reject")
      throw new Error(`Item '${item.id}' conflicts with '${effect.itemId}'`);
    if (resolved === "replace")
      removeItemIds.add(effect.itemId);
  }
  return { removeItemIds };
}
function itemOrder(item) {
  return item.interaction?.order ?? 0;
}

class ItemLoader {
  validator;
  items = new Map;
  constructor(validator) {
    this.validator = validator;
  }
  registerBuiltIn(document) {
    return this.register(document, "built-in");
  }
  registerLocalMod(document) {
    return this.register(document, "local-mod");
  }
  get(id) {
    const item = this.items.get(id);
    return item ? structuredClone(item.document) : undefined;
  }
  getAll() {
    return [...this.items.values()].map((item) => structuredClone(item.document));
  }
  getSource(id) {
    return this.items.get(id)?.source;
  }
  register(document, source) {
    const item = this.validator.validate(document);
    if (this.items.has(item.id)) {
      throw new Error(`Item id '${item.id}' is already registered`);
    }
    const stored = structuredClone(item);
    this.items.set(stored.id, { document: stored, source });
    return structuredClone(stored);
  }
}

var ITEM_FIELDS = new Set([
  "schemaVersion",
  "id",
  "name",
  "description",
  "type",
  "effects",
  "targetType",
  "duration",
  "useLimit",
  "targetValidation",
  "cooldown",
  "interaction"
]);
var EFFECT_FIELDS = new Set(["type", "value"]);
var DURATION_FIELDS = new Set(["type", "value"]);
var USE_LIMIT_FIELDS = new Set(["perTurn", "perGame"]);
var TARGET_VALIDATION_FIELDS = new Set([
  "allowSelf",
  "allowAlly",
  "allowEnemy",
  "maxRange"
]);
var INTERACTION_FIELDS = new Set(["mode", "with", "order"]);
function isPlainObject(value) {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function formatPath(path, key) {
  return path ? `${path}.${key}` : key;
}
function assertEnumerableDataProperties(object, path) {
  const keys = Reflect.ownKeys(object);
  for (const key of keys) {
    if (typeof key !== "string") {
      throw new Error(`${path} must not contain symbol keys`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      throw new Error(`${formatPath(path, key)} must be an enumerable data property`);
    }
  }
  return keys;
}
function assertKnownObject(value, path, allowedFields) {
  if (typeof value !== "object" || value === null || !isPlainObject(value)) {
    throw new Error(`${path} must be a plain object`);
  }
  for (const key of assertEnumerableDataProperties(value, path)) {
    if (!allowedFields.has(key)) {
      throw new Error(`${formatPath(path, key)} is not allowed`);
    }
  }
  return value;
}
function isExecutableKey(key) {
  return key === "script" || key === "code" || key === "handler" || key === "eval" || key === "exec" || key === "function" || key === "__proto__" || key === "constructor" || key === "prototype" || /^on[a-zA-Z]/i.test(key);
}
function assertJsonValue2(value, path, ancestors) {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error(`${path} must be a finite number`);
    return;
  }
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new Error(`${path} is not JSON data`);
  }
  if (typeof value !== "object")
    throw new Error(`${path} is not JSON data`);
  if (ancestors.has(value))
    throw new Error(`${path} contains a cyclic reference`);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      for (const key of Reflect.ownKeys(value)) {
        if (key === "length")
          continue;
        if (typeof key !== "string")
          throw new Error(`${path} must not contain symbol keys`);
        if (isExecutableKey(key)) {
          throw new Error(`${formatPath(path, key)} is an executable field and is not allowed`);
        }
        const index = Number(key);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!Number.isSafeInteger(index) || index < 0 || String(index) !== key || !descriptor?.enumerable || !("value" in descriptor)) {
          throw new Error(`${formatPath(path, key)} is not JSON array data`);
        }
      }
      for (let index = 0;index < value.length; index += 1) {
        if (!(index in value))
          throw new Error(`${path}[${index}] must not be sparse`);
        assertJsonValue2(value[index], `${path}[${index}]`, ancestors);
      }
      return;
    }
    if (!isPlainObject(value))
      throw new Error(`${path} must be a plain object`);
    for (const key of assertEnumerableDataProperties(value, path)) {
      const childPath = formatPath(path, key);
      if (isExecutableKey(key)) {
        throw new Error(`${childPath} is an executable field and is not allowed`);
      }
      assertJsonValue2(value[key], childPath, ancestors);
    }
  } finally {
    ancestors.delete(value);
  }
}

class ItemValidator {
  effectTypes = new Set;
  registerEffectType(type) {
    if (typeof type !== "string" || type.trim().length === 0) {
      throw new Error("Effect type must be a non-empty string");
    }
    if (this.effectTypes.has(type)) {
      throw new Error(`Effect type '${type}' is already registered`);
    }
    this.effectTypes.add(type);
  }
  isRegisteredEffectType(type) {
    return this.effectTypes.has(type);
  }
  validate(document) {
    validateItemDocument(document);
    const item = assertKnownObject(document, "item", ITEM_FIELDS);
    if (item.description !== undefined && typeof item.description !== "string") {
      throw new Error("item.description must be a string");
    }
    const effects = item.effects;
    for (let index = 0;index < effects.length; index += 1) {
      const effect = assertKnownObject(effects[index], `item.effects[${index}]`, EFFECT_FIELDS);
      const type = effect.type;
      if (typeof type !== "string" || !this.isRegisteredEffectType(type)) {
        throw new Error(`Effect type '${String(type)}' is not in the whitelist`);
      }
      if (effect.value !== undefined) {
        assertJsonValue2(effect.value, `item.effects[${index}].value`, new Set);
      }
    }
    assertKnownObject(item.duration, "item.duration", DURATION_FIELDS);
    assertKnownObject(item.useLimit, "item.useLimit", USE_LIMIT_FIELDS);
    if (item.targetValidation !== undefined) {
      assertKnownObject(item.targetValidation, "item.targetValidation", TARGET_VALIDATION_FIELDS);
    }
    if (item.interaction !== undefined) {
      const interaction = assertKnownObject(item.interaction, "item.interaction", INTERACTION_FIELDS);
      if (interaction.with !== undefined) {
        const overrides = assertKnownObject(interaction.with, "item.interaction.with", new Set(Object.keys(interaction.with)));
        for (const [itemId, mode] of Object.entries(overrides)) {
          if (!itemId || typeof mode !== "string")
            throw new Error("item.interaction.with must contain item modes");
        }
      }
    }
    return document;
  }
}

function clone4(value) {
  return structuredClone(value);
}
function sdkItemEffectTypes() {
  return ["modifyForce", "modifyRotation", "lockRotation", "applyTorque", "spawnTrigger", "delayedEffect", "shield", "freeze", "swapPosition", "temporaryWall", "ghostMode", "magnet", "selectionLock", "aimVariance"];
}
function createItem(input) {
  const item = createItemDocument({
    ...input,
    effects: (input.effects ?? []).map((effect) => ({ type: effect.type, ...effect.value === undefined ? {} : { value: clone4(effect.value) } }))
  });
  const validator = new ItemValidator;
  for (const effectType of sdkItemEffectTypes())
    validator.registerEffectType(effectType);
  for (const effect of item.effects)
    if (!sdkItemEffectTypes().includes(effect.type))
      throw new Error(`Unsupported KORE item effect '${effect.type}'`);
  return clone4(validator.validate(item));
}
function composeItemEffects(...effects) {
  return effects.map((effect) => {
    if (!sdkItemEffectTypes().includes(effect.type))
      throw new Error(`Unsupported KORE item effect '${effect.type}'`);
    return { type: effect.type, ...effect.value === undefined ? {} : { value: clone4(effect.value) } };
  });
}

var ANKER_FORCE_FACTOR = 0.5;
var GHOST_MODE_DURATION_TURNS = 2;
var MAGNET_RANGE = 200;
var MAGNET_FORCE = 2;
var FALLTUER_RADIUS = 25;
var POWER_DASH_FACTOR = 1.5;
var DELAYED_MINE_DELAY_TICKS = 3;
var DELAYED_MINE_RADIUS = 60;
var DELAYED_MINE_FORCE = 4;
var MINI_WALL_WIDTH = 80;
var MINI_WALL_HEIGHT = 10;
var MINI_WALL_DURATION_TURNS = 3;
var FREEZE_SHOT_SPEED_FACTOR = 0.25;
var FREEZE_SHOT_DURATION_TURNS = 2;
var SWITCH_RANGE = 300;
var JAEGERMEISTER_ELIXIER_DURATION_TURNS = 2;
var VODKA_ZERO_MAX_VARIANCE_DEGREES = 10;
var MYSTERY_BOX_ITEM_ID = "mystery-box";
var DEFAULT_MYSTERY_BOX_POOL = ["anker", "durchlaessigkeit", "power-dash", "magnet", "freeze-shot"];
var ankerItem = createItem({
  id: "anker",
  name: "Anker",
  description: "Reduces knockback force for a short duration.",
  type: "defensive",
  effects: [{ type: "modifyForce", value: { factor: ANKER_FORCE_FACTOR } }],
  targetType: "self",
  duration: { type: "turns", value: 2 },
  useLimit: { perTurn: 1, perGame: 2 },
  targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false }
});
var durchlaessigkeitItem = createItem({
  id: "durchlaessigkeit",
  name: "Durchlässigkeit",
  description: "Ignores entity and structure collisions for a short duration.",
  type: "defensive",
  effects: [{ type: "ghostMode", value: { durationTurns: GHOST_MODE_DURATION_TURNS } }],
  targetType: "self",
  duration: { type: "turns", value: GHOST_MODE_DURATION_TURNS },
  useLimit: { perTurn: 1, perGame: 1 },
  targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false }
});
var magnetItem = createItem({
  id: "magnet",
  name: "Magnet",
  description: "Attracts a targeted figure within a configured range.",
  type: "offensive",
  effects: [{ type: "magnet", value: { mode: "attract", force: MAGNET_FORCE, range: MAGNET_RANGE } }],
  targetType: "entity",
  duration: { type: "turns", value: 1 },
  useLimit: { perTurn: 1, perGame: 2 },
  targetValidation: { allowSelf: false, allowAlly: true, allowEnemy: true, maxRange: MAGNET_RANGE }
});
var falltuerItem = createItem({
  id: "falltuer",
  name: "Falltür",
  description: "Spawns a kill zone at a selected position.",
  type: "trap",
  effects: [{ type: "spawnTrigger", value: { triggerId: "falltuer-kill-zone", delayTurns: 0, radius: FALLTUER_RADIUS } }],
  targetType: "position",
  duration: { type: "turns", value: 1 },
  useLimit: { perTurn: 1, perGame: 1 },
  targetValidation: { allowSelf: true, allowAlly: true, allowEnemy: true, maxRange: 300 }
});
var powerDashItem = createItem({
  id: "power-dash",
  name: "Power-Dash",
  description: "Boosts the next applied force by a configured multiplier.",
  type: "offensive",
  effects: [{ type: "modifyForce", value: { factor: POWER_DASH_FACTOR } }],
  targetType: "self",
  duration: { type: "instant", value: 0 },
  useLimit: { perTurn: 1, perGame: 2 },
  targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false }
});
var verzoegerteMineItem = createItem({
  id: "verzoegerte-mine",
  name: "Verzögerte Mine",
  description: "Creates a delayed repelling force explosion at a selected position.",
  type: "trap",
  effects: [{ type: "delayedEffect", value: { effectType: "magnet", effectValue: { mode: "repel", force: DELAYED_MINE_FORCE, range: DELAYED_MINE_RADIUS }, delayTicks: DELAYED_MINE_DELAY_TICKS } }],
  targetType: "position",
  duration: { type: "turns", value: 1 },
  useLimit: { perTurn: 1, perGame: 1 },
  targetValidation: { allowSelf: true, allowAlly: true, allowEnemy: true, maxRange: 300 }
});
var miniWallItem = createItem({
  id: "mini-wall",
  name: "Mini-Wall",
  description: "Spawns a temporary portable wall at a selected position.",
  type: "defensive",
  effects: [{ type: "temporaryWall", value: { wallId: "mini-wall", x: 0, y: 0, w: MINI_WALL_WIDTH, h: MINI_WALL_HEIGHT, durationTurns: MINI_WALL_DURATION_TURNS } }],
  targetType: "position",
  duration: { type: "turns", value: MINI_WALL_DURATION_TURNS },
  useLimit: { perTurn: 1, perGame: 1 },
  targetValidation: { allowSelf: true, allowAlly: true, allowEnemy: true, maxRange: 300 }
});
var freezeShotItem = createItem({
  id: "freeze-shot",
  name: "Freeze-Shot",
  description: "Temporarily slows a targeted figure.",
  type: "offensive",
  effects: [{ type: "freeze", value: { speedFactor: FREEZE_SHOT_SPEED_FACTOR, durationTurns: FREEZE_SHOT_DURATION_TURNS } }],
  targetType: "entity",
  duration: { type: "turns", value: FREEZE_SHOT_DURATION_TURNS },
  useLimit: { perTurn: 1, perGame: 2 },
  targetValidation: { allowSelf: false, allowAlly: false, allowEnemy: true, maxRange: 300 }
});
var switchItem = createItem({
  id: "switch",
  name: "Switch",
  description: "Swaps the active figure's position with a targeted ally.",
  type: "utility",
  effects: [{ type: "swapPosition", value: {} }],
  targetType: "entity",
  duration: { type: "instant", value: 0 },
  useLimit: { perTurn: 1, perGame: 1 },
  targetValidation: { allowSelf: false, allowAlly: true, allowEnemy: false, maxRange: SWITCH_RANGE }
});
var jaegermeisterElixierItem = createItem({
  id: "jaegermeister-elixier",
  name: "Jägermeister-Elixier",
  description: "Prevents an opponent figure from being selected for its duration.",
  type: "debuff",
  effects: [{ type: "selectionLock", value: { durationTurns: JAEGERMEISTER_ELIXIER_DURATION_TURNS } }],
  targetType: "entity",
  duration: { type: "turns", value: JAEGERMEISTER_ELIXIER_DURATION_TURNS },
  useLimit: { perTurn: 1, perGame: 1 },
  targetValidation: { allowSelf: false, allowAlly: false, allowEnemy: true, maxRange: 300 }
});
var vodkaZeroItem = createItem({
  id: "vodka-zero",
  name: "Vodka-Zero",
  description: "Adds seeded deterministic aim variance to shots.",
  type: "offensive",
  effects: [{ type: "aimVariance", value: { maxVarianceDegrees: VODKA_ZERO_MAX_VARIANCE_DEGREES } }],
  targetType: "self",
  duration: { type: "instant", value: 0 },
  useLimit: { perTurn: 1, perGame: 2 },
  targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false }
});
var mysteryBoxItem = createItem({
  id: MYSTERY_BOX_ITEM_ID,
  name: "Wunderkiste",
  description: "Spawns randomly on the map and grants either a specific item or a random item from the pool.",
  type: "utility",
  effects: [{ type: "spawnTrigger", value: { triggerId: "mystery-box-grant", delayTurns: 0 } }],
  targetType: "self",
  duration: { type: "instant", value: 0 },
  useLimit: { perTurn: 1, perGame: 3 },
  targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false }
});
function validateMysteryBoxReward(rewardId, options) {
  if (rewardId === MYSTERY_BOX_ITEM_ID && !options.allowMysteryBoxReward) {
    throw new Error("Mystery Box rewards must not resolve to another mystery box unless explicitly enabled");
  }
  if (options.knownItemIds && !options.knownItemIds.includes(rewardId)) {
    throw new Error(`Mystery Box reward '${rewardId}' is not a known item`);
  }
}
function resolveMysteryBoxReward(options = {}) {
  if (options.specificItemId) {
    validateMysteryBoxReward(options.specificItemId, options);
    return options.specificItemId;
  }
  const pool = options.candidatePool ?? DEFAULT_MYSTERY_BOX_POOL;
  if (pool.length === 0)
    throw new Error("Mystery Box pool must not be empty");
  for (const itemId of pool)
    validateMysteryBoxReward(itemId, options);
  const seed = options.seed !== undefined ? options.seed : Math.floor(Math.random() * 1e5);
  const index = Math.abs(seed) % pool.length;
  return pool[index];
}
function grantMysteryBoxReward(inventory, documents, options = {}) {
  const rewardId = resolveMysteryBoxReward({ ...options, knownItemIds: documents.map((document2) => document2.id) });
  const document = documents.find((candidate) => candidate.id === rewardId);
  if (!document)
    throw new Error(`Mystery Box reward '${rewardId}' is not a known item`);
  addDrawnInventoryItem(inventory, document);
  return rewardId;
}
function hashString(value) {
  let hash = 2166136261;
  for (let index = 0;index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619) >>> 0;
  }
  return hash >>> 0;
}
function deriveMysteryBoxSeed(options) {
  return options.baseSeed + hashString(options.actorId) + options.turnNumber * 7 + options.activeTeam * 13 >>> 0;
}

var LANGUAGE_KEYS = {
  MenuTitle: "kore.ui.menu.title",
  MenuLandingPrompt: "kore.ui.menu.landingPrompt",
  MenuAiButton: "kore.ui.menu.aiButton",
  MenuBattleButton: "kore.ui.menu.battleButton",
  MenuOnlineButton: "kore.ui.menu.onlineButton",
  MenuLocalButton: "kore.ui.menu.localButton",
  MenuChooseMapButton: "kore.ui.menu.chooseMapButton",
  MenuOnlineMapNote: "kore.ui.menu.onlineMapNote",
  MenuBackButton: "kore.ui.menu.backButton",
  MenuDifficultyTitle: "kore.ui.menu.difficultyTitle",
  MenuKiLabel: "kore.ui.menu.kiLabel",
  MenuMapTitle: "kore.ui.menu.mapTitle",
  ModsButton: "kore.ui.menu.modsButton",
  ModsTitle: "kore.ui.mods.title",
  ModsLoadFile: "kore.ui.mods.loadFile",
  ModsPasteJson: "kore.ui.mods.pasteJson",
  ModsStatusEmpty: "kore.ui.mods.statusEmpty",
  ModImportTitle: "kore.ui.mods.import.title",
  ModImportHint: "kore.ui.mods.import.hint",
  ModImportValidate: "kore.ui.mods.import.validate",
  ModResultTitle: "kore.ui.mods.result.title",
  ModResultName: "kore.ui.mods.result.name",
  ModResultId: "kore.ui.mods.result.id",
  ModResultMeta: "kore.ui.mods.result.meta",
  ModTest1v1: "kore.ui.mods.test1v1",
  ModTestBattle: "kore.ui.mods.testBattle",
  ModError: "kore.ui.mods.error",
  HudPause: "kore.ui.hud.pause",
  HudItems: "kore.ui.hud.items",
  HudSkipPhase: "kore.ui.hud.skipPhase",
  HudRematch: "kore.ui.hud.rematch",
  HudMenu: "kore.ui.hud.menu",
  HudReplay: "kore.ui.hud.replay",
  HudShare: "kore.ui.hud.share",
  HudReplayShare: "kore.ui.hud.replayShare",
  HudPaused: "kore.ui.hud.paused",
  HudResume: "kore.ui.hud.resume",
  HudNone: "kore.ui.hud.none",
  HudWaiting: "kore.ui.hud.waiting",
  HudTurn: "kore.ui.hud.turn",
  HudActor: "kore.ui.hud.actor",
  HudAim: "kore.ui.hud.aim",
  HudPower: "kore.ui.hud.power",
  HudDraw: "kore.ui.hud.draw",
  HudTeamWins: "kore.ui.hud.teamWins",
  HudActionRejected: "kore.ui.hud.actionRejected",
  HudStateYourTurn: "kore.ui.hud.state.yourTurn",
  HudStateOpponentTurn: "kore.ui.hud.state.opponentTurn",
  HudStatePlaying: "kore.ui.hud.state.playing",
  HudStateWaiting: "kore.ui.hud.state.waiting",
  HudStateGameOver: "kore.ui.hud.state.gameOver",
  HudStateTurnDone: "kore.ui.hud.state.turnDone",
  HudStateUnknown: "kore.ui.hud.state.unknown",
  HudStateStarting: "kore.ui.hud.state.starting",
  HudStateWaitingPlayers: "kore.ui.hud.state.waitingPlayers",
  HudStateChooseTeam: "kore.ui.hud.state.chooseTeam",
  HudStateRoundDone: "kore.ui.hud.state.roundDone",
  HudStateSimulating: "kore.ui.hud.state.simulating",
  HudStateSimulatingDone: "kore.ui.hud.state.simulatingDone",
  HudStatePlayingDone: "kore.ui.hud.state.playingDone",
  HudStateGoalScored: "kore.ui.hud.state.goalScored",
  HudStateError: "kore.ui.hud.state.error",
  WorldOut: "kore.ui.world.out",
  LoadingJoining: "kore.ui.loading.joining",
  LoadingConnecting: "kore.ui.loading.connecting",
  LoadingFindingOpponent: "kore.ui.loading.findingOpponent",
  LoadingWaitingOpponent: "kore.ui.loading.waitingOpponent",
  LoadingConnectFailed: "kore.ui.loading.connectFailed",
  LoadingConnectionClosed: "kore.ui.loading.connectionClosed",
  LoadingTimedOut: "kore.ui.loading.timedOut",
  LoadingServerFailed: "kore.ui.loading.serverFailed",
  LoadingStarting: "kore.ui.loading.starting",
  LoadingRetry: "kore.ui.loading.retry",
  LoadingBack: "kore.ui.loading.back",
  ReplayTitle: "kore.ui.replay.title",
  ReplayLoad: "kore.ui.replay.load",
  ReplayPaste: "kore.ui.replay.paste",
  ReplayCopy: "kore.ui.replay.copy",
  ReplayShareId: "kore.ui.replay.shareId",
  ReplayValidId: "kore.ui.replay.validId",
  ReplayLoading: "kore.ui.replay.loading",
  ReplayUnavailable: "kore.ui.replay.unavailable",
  ReplayPasted: "kore.ui.replay.pasted",
  ReplayCopied: "kore.ui.replay.copied",
  ReplayCopyUnavailable: "kore.ui.replay.copyUnavailable",
  ReplayLinkReady: "kore.ui.replay.linkReady",
  ReplayError: "kore.ui.replay.error",
  ReplayNoneLoaded: "kore.ui.replay.noneLoaded",
  ReplayLoaded: "kore.ui.replay.loaded",
  ReplayLoadedEmpty: "kore.ui.replay.loadedEmpty"
};
var EN_EN_STRINGS = {
  [LANGUAGE_KEYS.MenuTitle]: "KORE",
  [LANGUAGE_KEYS.MenuLandingPrompt]: "Press to start",
  [LANGUAGE_KEYS.MenuAiButton]: "1 vs AI",
  [LANGUAGE_KEYS.MenuBattleButton]: "AI vs AI",
  [LANGUAGE_KEYS.MenuOnlineButton]: "Play Online",
  [LANGUAGE_KEYS.MenuLocalButton]: "Play Local Game",
  [LANGUAGE_KEYS.MenuChooseMapButton]: "Choose Map",
  [LANGUAGE_KEYS.MenuOnlineMapNote]: "Preference only - the server may choose Ice Map",
  [LANGUAGE_KEYS.MenuBackButton]: "Back",
  [LANGUAGE_KEYS.MenuDifficultyTitle]: "Choose AI difficulty",
  [LANGUAGE_KEYS.MenuKiLabel]: "AI",
  [LANGUAGE_KEYS.MenuMapTitle]: "Choose Map",
  [LANGUAGE_KEYS.ModsButton]: "Mods",
  [LANGUAGE_KEYS.ModsTitle]: "Mods",
  [LANGUAGE_KEYS.ModsLoadFile]: "Load JSON file",
  [LANGUAGE_KEYS.ModsPasteJson]: "Paste JSON",
  [LANGUAGE_KEYS.ModsStatusEmpty]: "No mod loaded",
  [LANGUAGE_KEYS.ModImportTitle]: "Import mod",
  [LANGUAGE_KEYS.ModImportHint]: "Paste a KORE mod JSON document below.",
  [LANGUAGE_KEYS.ModImportValidate]: "Validate",
  [LANGUAGE_KEYS.ModResultTitle]: "Mod summary",
  [LANGUAGE_KEYS.ModResultName]: "Name: {name}",
  [LANGUAGE_KEYS.ModResultId]: "ID: {id}",
  [LANGUAGE_KEYS.ModResultMeta]: "Version {version} · {items} item(s) · {effects} effect(s)",
  [LANGUAGE_KEYS.ModTest1v1]: "Test 1 vs AI",
  [LANGUAGE_KEYS.ModTestBattle]: "Test AI vs AI",
  [LANGUAGE_KEYS.ModError]: "Mod error: {error}",
  [LANGUAGE_KEYS.HudPause]: "Pause",
  [LANGUAGE_KEYS.HudItems]: "Items",
  [LANGUAGE_KEYS.HudSkipPhase]: "Skip phase",
  [LANGUAGE_KEYS.HudRematch]: "Rematch",
  [LANGUAGE_KEYS.HudMenu]: "Menu",
  [LANGUAGE_KEYS.HudReplay]: "Replay",
  [LANGUAGE_KEYS.HudShare]: "Share",
  [LANGUAGE_KEYS.HudReplayShare]: "Replay / Share",
  [LANGUAGE_KEYS.HudPaused]: "Paused",
  [LANGUAGE_KEYS.HudResume]: "Resume",
  [LANGUAGE_KEYS.HudNone]: "None",
  [LANGUAGE_KEYS.HudWaiting]: "Waiting for opponent/server",
  [LANGUAGE_KEYS.HudTurn]: "Team {team} | {phase} | Turn {turn}",
  [LANGUAGE_KEYS.HudActor]: "Actor: {actor}",
  [LANGUAGE_KEYS.HudAim]: "Aim: {aim}",
  [LANGUAGE_KEYS.HudPower]: "Power: {power}",
  [LANGUAGE_KEYS.HudDraw]: "Draw",
  [LANGUAGE_KEYS.HudTeamWins]: "Team {team} wins",
  [LANGUAGE_KEYS.HudActionRejected]: "Action rejected: {reason}",
  [LANGUAGE_KEYS.HudStateYourTurn]: "Your turn",
  [LANGUAGE_KEYS.HudStateOpponentTurn]: "Opponent's turn",
  [LANGUAGE_KEYS.HudStatePlaying]: "Playing",
  [LANGUAGE_KEYS.HudStateWaiting]: "Waiting",
  [LANGUAGE_KEYS.HudStateGameOver]: "Game over",
  [LANGUAGE_KEYS.HudStateTurnDone]: "Turn done",
  [LANGUAGE_KEYS.HudStateUnknown]: "Unknown",
  [LANGUAGE_KEYS.HudStateStarting]: "Starting",
  [LANGUAGE_KEYS.HudStateWaitingPlayers]: "Waiting for players",
  [LANGUAGE_KEYS.HudStateChooseTeam]: "Choose team",
  [LANGUAGE_KEYS.HudStateRoundDone]: "Round done",
  [LANGUAGE_KEYS.HudStateSimulating]: "Simulating",
  [LANGUAGE_KEYS.HudStateSimulatingDone]: "Simulation done",
  [LANGUAGE_KEYS.HudStatePlayingDone]: "Playing done",
  [LANGUAGE_KEYS.HudStateGoalScored]: "Goal scored",
  [LANGUAGE_KEYS.HudStateError]: "Engine error",
  [LANGUAGE_KEYS.WorldOut]: "OUT",
  [LANGUAGE_KEYS.LoadingJoining]: "Joining online game",
  [LANGUAGE_KEYS.LoadingConnecting]: "Connecting to the match server…",
  [LANGUAGE_KEYS.LoadingFindingOpponent]: "Finding an opponent…",
  [LANGUAGE_KEYS.LoadingWaitingOpponent]: "Waiting for an opponent…",
  [LANGUAGE_KEYS.LoadingConnectFailed]: "Could not connect to the match server.",
  [LANGUAGE_KEYS.LoadingConnectionClosed]: "The match connection closed before setup completed.",
  [LANGUAGE_KEYS.LoadingTimedOut]: "Matchmaking timed out. Please retry.",
  [LANGUAGE_KEYS.LoadingServerFailed]: "The server could not start your match.",
  [LANGUAGE_KEYS.LoadingStarting]: "Starting {map}…",
  [LANGUAGE_KEYS.LoadingRetry]: "Retry",
  [LANGUAGE_KEYS.LoadingBack]: "Back to menu",
  [LANGUAGE_KEYS.ReplayTitle]: "Replay viewer",
  [LANGUAGE_KEYS.ReplayLoad]: "Load replay",
  [LANGUAGE_KEYS.ReplayPaste]: "Paste from clipboard",
  [LANGUAGE_KEYS.ReplayCopy]: "Copy replay URL",
  [LANGUAGE_KEYS.ReplayShareId]: "Replay share ID",
  [LANGUAGE_KEYS.ReplayValidId]: "Enter a valid replay share ID.",
  [LANGUAGE_KEYS.ReplayLoading]: "Loading replay…",
  [LANGUAGE_KEYS.ReplayUnavailable]: "Replay unavailable. Check the share ID and try again.",
  [LANGUAGE_KEYS.ReplayPasted]: "Pasted replay ID. Press Load replay.",
  [LANGUAGE_KEYS.ReplayCopied]: "Replay URL copied",
  [LANGUAGE_KEYS.ReplayCopyUnavailable]: "Copy unavailable. Select and copy the URL manually.",
  [LANGUAGE_KEYS.ReplayLinkReady]: "Replay link ready. Copy it or select it manually.",
  [LANGUAGE_KEYS.ReplayError]: "Replay Error: {error}",
  [LANGUAGE_KEYS.ReplayNoneLoaded]: "No replay loaded",
  [LANGUAGE_KEYS.ReplayLoaded]: "Replay loaded. Playback is read-only.",
  [LANGUAGE_KEYS.ReplayLoadedEmpty]: "Replay loaded. No actions have been recorded yet."
};
function createEnglishLanguage() {
  return { language: "en_en", fallback: "en_en", strings: { ...EN_EN_STRINGS } };
}

class AuthoritativeGameplayRenderer {
  state;
  language = createEnglishLanguage();
  constructor(state) {
    this.state = state;
  }
  setLanguage(language) {
    this.language = language;
  }
  draw(renderer) {
    const snapshot = this.state.getAuthoritativeRenderState();
    for (const structure of snapshot.structures)
      this.drawStructure(renderer, structure);
    this.drawPickups(renderer, snapshot.pickups, snapshot.pickupState);
    for (const player of snapshot.players)
      this.drawPlayer(renderer, player, snapshot.ruleState.activeTeam);
  }
  drawStructure(renderer, structure) {
    const role = structure.role;
    const color = structure.color ?? "#64748b";
    if (role !== "containment") {
      renderer.push();
      renderer.setFillColor(color);
      renderer.setStrokeColor(color);
      this.drawShape(renderer, structure);
      renderer.pop();
    }
    if (role === "containment" || role === "both") {
      renderer.push();
      renderer.setNoFill();
      renderer.setStrokeColor(color);
      renderer.setStroke(2);
      this.drawShape(renderer, structure);
      renderer.pop();
    }
  }
  drawShape(renderer, structure) {
    switch (structure.type) {
      case 0 /* CIRCLE */:
        renderer.drawCircle(structure.x, structure.y, structure.r);
        return;
      case 2 /* RECTANGLE */:
        renderer.drawRect(structure.x, structure.y, structure.w, structure.h);
        return;
      case 1 /* LINE */:
        renderer.line(structure.x, structure.y, structure.x2, structure.y2);
        return;
    }
  }
  drawPickups(renderer, pickups, state) {
    for (const [index, pickup] of pickups.entries()) {
      const collected = state?.pickups[index]?.collected ?? 0;
      if (collected >= (pickup.maxPickupsPerTurn ?? 1))
        continue;
      renderer.push();
      renderer.setNoFill();
      renderer.setStrokeColor("#facc15");
      renderer.setStroke(2);
      renderer.drawRect(pickup.spawnRegion.x, pickup.spawnRegion.y, pickup.spawnRegion.w, pickup.spawnRegion.h);
      renderer.setFillColor("#713f12");
      renderer.drawText(pickup.itemId, pickup.spawnRegion.x, pickup.spawnRegion.y - 4, 12);
      renderer.pop();
    }
  }
  drawPlayer(renderer, player, activeTeam) {
    const position = player.position;
    renderer.push();
    if (player.isDead) {
      renderer.setFillColor("#64748b");
      renderer.setStrokeColor("#cbd5e1");
      renderer.drawCircle(position.x, position.y, player.size);
      renderer.line(position.x - player.size / 2, position.y - player.size / 2, position.x + player.size / 2, position.y + player.size / 2);
      renderer.line(position.x - player.size / 2, position.y + player.size / 2, position.x + player.size / 2, position.y - player.size / 2);
      renderer.drawText(this.language.strings["kore.ui.world.out"], position.x - player.size, position.y + player.size + 12, 12);
      renderer.pop();
      return;
    }
    renderer.drawImage(player.hoop, position.x - player.size, position.y - player.size, player.size * 2, player.size * 2);
    renderer.drawImage(player.playericon, position.x - player.size, position.y - player.size, player.size * 2, player.size * 2);
    if (player.team.includes(activeTeam)) {
      renderer.setNoFill();
      renderer.setStrokeColor(activeTeam === 0 ? "#38bdf8" : "#fb7185");
    }
    player.effects.forEach((effect, index) => {
      renderer.setNoFill();
      renderer.setStrokeColor("#a78bfa");
      renderer.drawCircle(position.x, position.y, player.size + 7 + index * 3);
      renderer.setFillColor("#4c1d95");
      renderer.drawText(effect.type.replace("EffectType.", ""), position.x + player.size + 4, position.y + index * 12, 11);
    });
    renderer.pop();
  }
}

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
    this.pending.push(clone5(command));
  }
  drainSoundCommands() {
    const commands = this.pending.map(clone5);
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
  constructor(runtimeId, settings = { buses: clone5(DEFAULT_BUSES), persistentSources: [] }) {
    this.runtimeId = runtimeId;
    validateId(runtimeId, "runtime ID");
    for (const bus of settings.buses) {
      validateBus(bus);
      if (this.buses.has(bus.id))
        throw new Error(`Duplicate audio bus '${bus.id}'`);
      this.buses.set(bus.id, clone5(bus));
    }
    if (!this.buses.has("master"))
      this.buses.set("master", clone5(DEFAULT_BUSES[0]));
    for (const source of settings.persistentSources) {
      validatePersistentSource(source, this.buses);
      if (this.persistent.has(source.sourceId))
        throw new Error(`Duplicate persistent audio source '${source.sourceId}'`);
      this.persistent.set(source.sourceId, clone5(source));
    }
    this.sequence = settings.sequence ?? 0;
    this.output = emptyBatch(runtimeId, this.sequence, this.diagnostics());
  }
  submit(command) {
    validateAudioCommand(command);
    this.pending.push(clone5(command));
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
    const value = clone5(this.output);
    this.output = emptyBatch(this.runtimeId, this.sequence, this.diagnostics());
    return value;
  }
  restorePersistentIntent() {
    for (const source of [...this.persistent.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId)))
      this.pending.push(clone5(source.command));
  }
  toSettings(framework = createDefaultAudioFramework()) {
    const settings = { schemaVersion: 1, runtimeId: this.runtimeId, buses: [...this.buses.values()].sort(byBus).map(clone5), persistentSources: [...this.persistent.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId)).map(clone5), framework: clone5(framework), sequence: this.sequence };
    validateAudioSettings(settings);
    return settings;
  }
  getDiagnostics() {
    return clone5(this.diagnostics());
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
    return { ...clone5(command), runtimeId: this.runtimeId, globalSourceId: `${this.runtimeId}:${command.sourceId}`, sequence: this.sequence + 1 };
  }
  applyPersistent(command) {
    if (command.type === "startLoop" || command.type === "playMusic")
      this.persistent.set(command.sourceId, { sourceId: command.sourceId, command: clone5(command) });
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
    this.framework = clone5(settings.framework);
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
  constructor(applicationId, settings = { buses: clone5(DEFAULT_BUSES) }) {
    this.applicationId = applicationId;
    validateId(applicationId, "application ID");
    for (const bus of settings.buses) {
      validateBus(bus);
      if (this.buses.has(bus.id))
        throw new Error(`Duplicate audio bus '${bus.id}'`);
      this.buses.set(bus.id, clone5(bus));
    }
    if (!this.buses.has("master"))
      this.buses.set("master", clone5(DEFAULT_BUSES[0]));
    if (settings.activeMusic) {
      validateResolvedCommand(settings.activeMusic);
      this.activeMusic = clone5(settings.activeMusic);
    }
    this.sequence = settings.sequence ?? 0;
  }
  submit(batch) {
    validateAudioBatch(batch);
    this.pending.push(clone5(batch));
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
    const settings = { schemaVersion: 1, applicationId: this.applicationId, buses: [...this.buses.values()].sort(byBus).map(clone5), ...this.activeMusic ? { activeMusic: clone5(this.activeMusic) } : {}, sequence: this.sequence };
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
        this.activeMusic = clone5(candidate);
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
  return { schemaVersion: 1, runtimeId: options.runtimeId, buses: clone5(options.buses ?? DEFAULT_BUSES), persistentSources: clone5(options.persistentSources ?? []), framework: createDefaultAudioFramework(), sequence: 0 };
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
    return clone5(settings);
  },
  command: {
    play(settings) {
      return { type: "playSound", ...clone5(settings) };
    },
    loop(settings) {
      return { type: "startLoop", ...clone5(settings) };
    },
    music(settings) {
      return { type: "playMusic", ...clone5(settings) };
    },
    stopSource(settings) {
      return { type: "stopSource", ...clone5(settings) };
    },
    stopInstance(settings) {
      return { type: "stopInstance", ...clone5(settings) };
    },
    stopMusic(settings = {}) {
      return { type: "stopMusic", ...clone5(settings) };
    },
    setBusVolume(settings) {
      return { type: "setBusVolume", ...clone5(settings) };
    },
    pauseBus(settings) {
      return { type: "pauseBus", ...clone5(settings) };
    },
    resumeBus(settings) {
      return { type: "resumeBus", ...clone5(settings) };
    },
    stopAll(settings) {
      return { type: "stopAll", ...clone5(settings) };
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
function clone5(value) {
  return structuredClone(value);
}

function validateAnimationSettings(value) {
  if (!isRecord8(value) || value.schemaVersion !== 1 || typeof value.id !== "string" || typeof value.channel !== "string" || !positiveInteger2(value.durationTicks) || !integer(value.priority) || !INTERRUPTIONS.has(value.interruption) || !Array.isArray(value.tracks))
    throw new Error("Malformed animation settings");
  assertKeys(value, ["schemaVersion", "id", "channel", "durationTicks", "priority", "interruption", "tracks"], "animation settings");
  validateId2(value.id, "animation ID");
  validateId2(value.channel, "animation channel");
  const ids = new Set;
  for (const track of value.tracks) {
    if (!isRecord8(track) || typeof track.id !== "string" || !Array.isArray(track.keyframes))
      throw new Error("Malformed animation track");
    assertKeys(track, ["id", "keyframes"], "animation track");
    validateId2(track.id, "animation track ID");
    if (ids.has(track.id))
      throw new Error(`Duplicate animation track '${track.id}'`);
    ids.add(track.id);
    let previous = -1;
    for (const keyframe of track.keyframes) {
      if (!isRecord8(keyframe) || !nonNegativeInteger(keyframe.tick) || keyframe.tick > value.durationTicks || keyframe.tick <= previous)
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
  if (!isRecord8(value) || value.schemaVersion !== 1 || value.type !== "play" && value.type !== "cancel" || typeof value.eventId !== "string")
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
  if (!isRecord8(value) || value.schemaVersion !== 1 || typeof value.runtimeId !== "string" || !nonNegativeInteger(value.tick) || !nonNegativeInteger(value.sequence) || !Array.isArray(value.active) || !Array.isArray(value.pending))
    throw new Error("Malformed presentation runtime settings");
  assertKeys(value, ["schemaVersion", "runtimeId", "tick", "sequence", "active", "pending"], "presentation runtime settings");
  validateId2(value.runtimeId, "presentation runtime ID");
  for (const active of value.active) {
    if (!isRecord8(active) || typeof active.instanceId !== "string" || typeof active.animationId !== "string" || typeof active.channel !== "string" || !nonNegativeInteger(active.startTick) || !integer(active.priority))
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
      this.animations.set(animation.id, clone6(animation));
    }
    this.tickNumber = settings.tick ?? 0;
    this.sequence = settings.sequence ?? 0;
    for (const item of settings.active ?? [])
      this.restoreActive(item);
    for (const event of settings.pending ?? []) {
      validatePresentationEvent(event);
      this.pending.push(clone6(event));
    }
    this.lastFrame = this.frame([]);
  }
  emit(event) {
    validatePresentationEvent(event);
    this.pending.push(clone6(event));
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
    return clone6(this.lastFrame);
  }
  project() {
    return clone6(this.frame([]));
  }
  toSettings() {
    const settings = { schemaVersion: 1, runtimeId: this.runtimeId, tick: this.tickNumber, sequence: this.sequence, active: [...this.active.values()].sort(byInstance).map(clone6), pending: this.pending.map(clone6) };
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
    return { ...clone6(event), sequence, tick: this.tickNumber };
  }
  frame(events) {
    return { schemaVersion: 1, runtimeId: this.runtimeId, tick: this.tickNumber, events: events.map(clone6), animations: [...this.active.values()].sort(byInstance).map((item) => this.projectAnimation(item)) };
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
    this.active.set(item.channel, clone6(item));
  }
}
function sample(keyframes, tick) {
  let result = keyframes[0].value;
  for (const keyframe of keyframes) {
    if (keyframe.tick > tick)
      break;
    result = keyframe.value;
  }
  return clone6(result);
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
function isRecord8(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function integer(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}
function nonNegativeInteger(value) {
  return integer(value) && value >= 0;
}
function positiveInteger2(value) {
  return integer(value) && value > 0;
}
function clone6(value) {
  return structuredClone(value);
}
function byInstance(a, b) {
  return a.channel.localeCompare(b.channel) || a.instanceId.localeCompare(b.instanceId);
}
var INTERRUPTIONS = new Set(["replace", "higher-priority", "ignore"]);
var presentation = {
  createAnimation(settings) {
    const result = { schemaVersion: 1, ...clone6(settings) };
    validateAnimationSettings(result);
    return result;
  },
  createRuntime(runtimeId, settings) {
    return new PresentationRuntime(runtimeId, settings);
  },
  play(eventId, animationId, options = {}) {
    return { schemaVersion: 1, type: "play", eventId, animationId, ...clone6(options) };
  },
  cancel(eventId, options) {
    return { schemaVersion: 1, type: "cancel", eventId, ...clone6(options) };
  },
  validateAnimation: validateAnimationSettings,
  validateEvent: validatePresentationEvent,
  validateRuntime: validatePresentationRuntimeSettings
};

var KoreGameplayFeedbackType;
((KoreGameplayFeedbackType2) => {
  KoreGameplayFeedbackType2["Shot"] = "shot";
  KoreGameplayFeedbackType2["Collision"] = "collision";
  KoreGameplayFeedbackType2["Damage"] = "damage";
  KoreGameplayFeedbackType2["Shield"] = "shield";
  KoreGameplayFeedbackType2["Item"] = "item";
  KoreGameplayFeedbackType2["Hazard"] = "hazard";
  KoreGameplayFeedbackType2["Elimination"] = "elimination";
  KoreGameplayFeedbackType2["Turn"] = "turn";
  KoreGameplayFeedbackType2["Result"] = "result";
})(KoreGameplayFeedbackType ||= {});
var TYPES = new Set(Object.values(KoreGameplayFeedbackType));
function clone7(value) {
  return structuredClone(value);
}
function validId(value) {
  if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(value))
    throw new Error("Invalid feedback ID");
}
function validateEvent(event) {
  if (event.schemaVersion !== 1 || !Number.isSafeInteger(event.sequence) || event.sequence < 0 || !Number.isSafeInteger(event.turnNumber) || event.turnNumber < 0 || !TYPES.has(event.type))
    throw new Error("Malformed gameplay feedback event");
  if (event.actorId !== undefined)
    validId(event.actorId);
  if (event.targetIds !== undefined) {
    if (!Array.isArray(event.targetIds))
      throw new Error("Malformed feedback targets");
    event.targetIds.forEach(validId);
  }
  if (event.data !== undefined)
    assertJsonValue(event.data);
}

class GameplayFeedbackTrace {
  events;
  sequence;
  constructor(settings = {}) {
    this.sequence = settings.sequence ?? 0;
    this.events = (settings.events ?? []).map(clone7);
    this.events.forEach(validateEvent);
    if (this.events.some((event, index) => event.sequence !== index))
      throw new Error("Feedback sequence must be contiguous");
    if (this.sequence < this.events.length)
      throw new Error("Invalid feedback sequence");
  }
  record(type, turnNumber, details = {}) {
    const event = { schemaVersion: 1, sequence: this.sequence++, turnNumber, type, ...clone7(details) };
    validateEvent(event);
    this.events.push(event);
    return clone7(event);
  }
  list(fromSequence = 0) {
    return this.events.slice(fromSequence).map(clone7);
  }
  toSettings() {
    return { schemaVersion: 1, sequence: this.sequence, events: this.list() };
  }
}
var ANIMATION_TYPES = Object.values(KoreGameplayFeedbackType);
function animation(type) {
  return presentation.createAnimation({ id: `kore.feedback.${type}`, channel: `feedback.${type}`, durationTicks: type === "result" /* Result */ ? 12 : 6, priority: type === "result" /* Result */ ? 100 : 20, interruption: "replace", tracks: [{ id: "opacity", keyframes: [{ tick: 0, value: 1 }, { tick: type === "result" /* Result */ ? 8 : 3, value: 0 }] }] });
}
var KORE_FEEDBACK_ANIMATIONS = ANIMATION_TYPES.map(animation);
var KORE_FEEDBACK_AUDIO = {
  shot: "kore.game.shot",
  collision: "kore.game.collision",
  damage: "kore.game.damage",
  shield: "kore.game.shield",
  item: "kore.game.item",
  hazard: "kore.game.hazard",
  elimination: "kore.game.elimination",
  turn: "kore.game.turn",
  result: "kore.game.result"
};

class KoreGameplayFeedbackSurface {
  output;
  runtime;
  sounds = new AudioEmitter("kore.feedback");
  frame;
  visible = [];
  soundSourceId = this.sounds.soundSourceId;
  constructor(runtimeSettings, output) {
    this.output = output;
    this.runtime = presentation.createRuntime("kore.feedback", { animations: KORE_FEEDBACK_ANIMATIONS, ...runtimeSettings ?? {} });
    this.frame = this.runtime.project();
  }
  accept(event) {
    validateEvent(event);
    this.visible.push(clone7(event));
    this.runtime.emit(presentation.play(`feedback:${event.sequence}:${event.type}`, `kore.feedback.${event.type}`, event.data === undefined ? {} : { payload: event.data }));
    try {
      this.sounds.emit(audio.command.play({ sourceId: this.soundSourceId, soundId: KORE_FEEDBACK_AUDIO[event.type], bus: "effects", priority: event.type === "result" /* Result */ ? 80 : 20, dedupeKey: `feedback:${event.sequence}` }));
    } catch {}
  }
  tick(_dt) {
    this.frame = this.runtime.tick();
    try {
      this.output?.apply(this.frame);
    } catch {}
  }
  draw(renderer) {
    const last = this.visible[this.visible.length - 1];
    if (!last)
      return;
    const animation2 = this.frame.animations.find((item) => item.channel === `feedback.${last.type}`);
    if (!animation2) {
      this.visible = [];
      return;
    }
    const opacity = animation2.values.opacity;
    if (typeof opacity !== "number")
      return;
    renderer.push();
    renderer.setOpacity(opacity);
    renderer.setFillColor("white");
    renderer.drawText(feedbackLabel(last), renderer.WORLD_SIZE_X / 2 - 70, 32, 16);
    renderer.pop();
  }
  drainSoundCommands() {
    return this.sounds.drainSoundCommands();
  }
  getFrame() {
    return clone7(this.frame);
  }
  toPresentationSettings() {
    return this.runtime.toSettings();
  }
}
function feedbackLabel(event) {
  return event.type === "result" /* Result */ ? "Match complete" : event.type[0].toUpperCase() + event.type.slice(1);
}

class GameHandler {
  teamSize = 0;
  id;
  turns = [];
  settings;
  initialSettings;
  context;
  systems = [];
  entityManager;
  physicsStrategy;
  preTickers = [];
  postTickers = [];
  preDrawers = [];
  postDrawers = [];
  dt = 1;
  mouseHandler;
  logs = [];
  team = [];
  effectAlways = [];
  effectRound = [];
  effectCollision = [];
  items = [];
  itemDrawRandom;
  mapPickupSystem = new MapPickupSystem;
  gameplayRenderer = new AuthoritativeGameplayRenderer(this);
  ruleState = { phase: "physics" /* Physics */, activeTeam: 0, turnNumber: 0, itemUses: 0 };
  matchResult;
  disposed = false;
  paused = false;
  resolvingTurn = false;
  feedback = new GameplayFeedbackTrace;
  constructor() {
    this.id = crypto.randomUUID();
    const em = new EntityManager([]);
    this.context = {
      state: "GameState.Starting" /* Starting */,
      dt: 1,
      entities: em,
      structures: [],
      worldSize: { x: 0, y: 0 },
      mouse: { turn: null },
      physics: new defaultPhysics,
      currTurn: 0,
      activeTeam: 0,
      myTeamNumber: 0,
      drift: DEFAULT_DRIFT,
      finishMatch: (result) => this.finishMatch(result)
    };
    this.entityManager = em;
    this.physicsStrategy = new defaultPhysics;
  }
  setLanguage(language) {
    this.gameplayRenderer.setLanguage(language);
  }
  setPhysics(strategy) {
    this.physicsStrategy = strategy;
    this.context.physics = strategy;
    this.systems.forEach((system) => {
      if (system instanceof PhysicsSystem)
        system.strategy = strategy;
    });
  }
  simulateTurn(actorId, angle, power) {
    if (this.context.state === "GameState.Game_over" /* Game_over */)
      throw new Error("A completed match cannot simulate further turns");
    const settings = JSON.parse(JSON.stringify(this.toSettings()));
    if (settings.systems && settings.systemOrder) {
      settings.systems = settings.systems.filter((system) => system.systemId !== "ai.battle" && system.systemId !== "ai.opponent");
      settings.systemOrder = settings.systemOrder.filter((id) => id !== "ai.battle" && id !== "ai.opponent");
    }
    const g = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
    return g.resolveTurn({ actorId, angle, power });
  }
  resolveTurn({ actorId, angle, power }) {
    if (this.context.state === "GameState.Game_over" /* Game_over */)
      throw new Error("A completed match cannot resolve further turns");
    const actor = this.entityManager.getEntityById(actorId);
    if (!actor)
      throw new Error(`Actor ${actorId} not found`);
    if (actor.isDead())
      throw new Error(`Actor ${actorId} is not active`);
    this.feedback.record("shot" /* Shot */, this.getTurnNumber(), { actorId, data: { angle, power } });
    const before = new Map(this.entityManager.toSettings().map((player) => [player.id, player]));
    this.physicsStrategy.applyImpulse(actor, angle, power);
    this.resolvingTurn = true;
    let frames = 0;
    try {
      for (;!this.physicsStrategy.isStatic(this.entityManager) && frames < 1200; frames++)
        this.tick();
    } finally {
      this.resolvingTurn = false;
    }
    const finalState = this.entityManager.serialize();
    for (const player of this.entityManager.toSettings()) {
      const previous = before.get(player.id);
      if (!previous)
        continue;
      if (player.hp < previous.hp)
        this.feedback.record("damage" /* Damage */, this.getTurnNumber(), { targetIds: [player.id], data: { amount: previous.hp - player.hp } });
      if (player.isDead && !previous.isDead)
        this.feedback.record("elimination" /* Elimination */, this.getTurnNumber(), { targetIds: [player.id] });
    }
    this.feedback.record("turn" /* Turn */, this.getTurnNumber(), { actorId, data: { durationFrames: frames } });
    return {
      actorId,
      input: { angle, power },
      durationFrames: frames,
      finalState
    };
  }
  playTurn(packet, onComplete) {
    if (this.context.state === "GameState.Game_over" /* Game_over */)
      throw new Error("A completed match cannot play further turns");
    this.turns.push(packet);
    this.setState("GameState.Playing" /* Playing */);
    const actor = this.entityManager.getEntityById(packet.actorId);
    if (!actor)
      throw new Error("actor not found!");
    this.getPhysics().applyImpulse(actor, packet.input.angle, packet.input.power);
    const playback = this.systems.find((s) => s instanceof PlaybackSystem);
    if (!playback)
      throw new Error("playbacksystem not found!");
    playback.start(packet.durationFrames, packet.finalState, () => {
      if (this.context.state !== "GameState.Game_over" /* Game_over */) {
        this.setState("GameState.Playing_done" /* Playing_done */);
      }
      onComplete?.();
    });
  }
  applyRawTurn({ actorId, angle, power }) {
    if (this.context.state === "GameState.Game_over" /* Game_over */)
      throw new Error("A completed match cannot accept raw turns");
    const actor = this.entityManager.getEntityById(actorId);
    if (!actor) {
      console.log("Player not Found");
      return;
    }
    this.physicsStrategy.applyImpulse(actor, angle, power);
  }
  tick(dt = this.dt) {
    if (this.disposed)
      return;
    if (this.paused)
      return;
    if (this.context.state === "GameState.Game_over" /* Game_over */ && !this.resolvingTurn)
      return;
    this.preTickers.forEach((t) => t.tick(dt, this.physicsStrategy.getFriction()));
    for (const e of this.entityManager.getEntities()) {
      this.effectAlways.forEach((eff) => {
        eff.apply(e);
      });
    }
    const drift = this.settings?.drift ?? DEFAULT_DRIFT;
    this.context.drift = drift;
    this.systems.forEach((s) => s.preTick?.(this.context, dt, this.physicsStrategy.getFriction()));
    for (const e of this.entityManager.getEntities()) {
      e.tick(dt, this.physicsStrategy.getFriction(), drift, this.physicsStrategy.getStopThreshold());
    }
    this.systems.forEach((s) => s.ticker(this.context, dt, this.physicsStrategy.getFriction()));
    this.mapPickupSystem.ticker(this.context, dt, this.physicsStrategy.getFriction());
    this.context.structures.forEach((str) => str.tick(dt, this.physicsStrategy.getFriction()));
    this.postTickers.forEach((t) => t.tick(dt, this.physicsStrategy.getFriction()));
    this.systems.forEach((s) => s.flush?.(this.context));
    const playback = this.systems.find((s) => s instanceof PlaybackSystem);
    playback?.drainCompletion();
  }
  drawWorld(renderer) {
    if (this.disposed)
      return;
    renderer.clear();
    this.preDrawers.forEach((d) => d.draw(renderer));
    this.gameplayRenderer.draw(renderer);
    this.postDrawers.forEach((d) => d.draw(renderer));
  }
  drawUI(renderer) {
    renderer.setFillColor("black");
    if (this.context.state === "GameState.Game_over" /* Game_over */) {
      const result = this.getMatchResult();
      const message = result?.status === "draw" /* Draw */ ? "Match draw" : `Team ${result?.winnerTeam ?? "?"} wins`;
      renderer.drawText(message, renderer.WORLD_SIZE_X / 2 - 80, renderer.WORLD_SIZE_Y / 2, 24);
      return;
    }
    if (this.context.state != "GameState.Your_turn" /* Your_turn */ && this.context.state != "GameState.Opponents_turn" /* Opponents_turn */)
      return;
  }
  handleMousePressed() {
    if (this.disposed)
      return;
    if (this.context.state !== "GameState.Starting" /* Starting */ && this.context.state !== "GameState.Your_turn" /* Your_turn */ && this.context.state !== "GameState.Game_over" /* Game_over */ && !this.mouseHandler?.acceptsUiInputWhileLocked)
      return;
    this.mouseHandler?.handleMousePressed();
  }
  updateMouse(x2, y2) {
    if (this.disposed)
      return;
    this.mouseHandler?.updateMouse(x2, y2);
  }
  handleMouseReleased() {
    if (this.disposed)
      return;
    if (this.context.state !== "GameState.Your_turn" /* Your_turn */)
      return;
    this.mouseHandler?.handleMouseReleased();
  }
  handleMouseWheel(event) {
    if (this.disposed)
      return;
    this.mouseHandler?.handleMouseWheel(event);
  }
  handleKeyPressed(event) {
    if (this.disposed)
      return;
    const handler = this.mouseHandler;
    handler?.handleKeyPressed?.(event);
  }
  addPreTicker(ticker) {
    this.preTickers.push(ticker);
  }
  addPostTicker(ticker) {
    this.postTickers.push(ticker);
  }
  rmPreTicker(ticker) {
    this.preTickers = this.preTickers.filter((t) => t !== ticker);
  }
  rmPostTicker(ticker) {
    this.postTickers = this.postTickers.filter((t) => t !== ticker);
  }
  addPreDrawer(drawer) {
    this.preDrawers.push(drawer);
  }
  addPostDrawer(drawer) {
    this.postDrawers.push(drawer);
  }
  rmPreDrawer(drawer) {
    this.preDrawers = this.preDrawers.filter((d) => d !== drawer);
  }
  rmPostDrawer(drawer) {
    this.postDrawers = this.postDrawers.filter((d) => d !== drawer);
  }
  addPreTickAndDraw(item) {
    this.addPreTicker(item);
    this.addPreDrawer(item);
  }
  addPostTickAndDraw(item) {
    this.addPostTicker(item);
    this.addPostDrawer(item);
  }
  rmPreTickAndDraw(item) {
    this.rmPreTicker(item);
    this.rmPreDrawer(item);
  }
  rmPostTickAndDraw(item) {
    this.rmPostTicker(item);
    this.rmPostDrawer(item);
  }
  getContext() {
    return { ...this.context };
  }
  addSystem(system) {
    this.systems.push(system);
  }
  getSystems() {
    return this.systems;
  }
  replaceSystems(systems) {
    this.systems = systems;
  }
  getEntityManager() {
    return this.entityManager;
  }
  setState(state) {
    this.context.state = state;
  }
  getState() {
    return this.context.state;
  }
  getPlaybackFramesRemaining() {
    const playback = this.systems.find((system) => system instanceof PlaybackSystem);
    return playback?.getRemainingFrames() ?? 0;
  }
  getPhysics() {
    return this.physicsStrategy;
  }
  attachFeedbackToPhysics(system) {
    system.onCollision = (a, b) => {
      const ids = [a, b].filter((value) => typeof value.getId === "function").map((value) => value.getId());
      this.recordFeedback("collision" /* Collision */, { ...ids[0] ? { actorId: ids[0] } : {}, ...ids.length > 1 ? { targetIds: ids.slice(1) } : {} });
      if (ids.length === 1)
        this.recordFeedback("hazard" /* Hazard */, { actorId: ids[0], data: { structure: true } });
    };
  }
  setWorldSize(worldSize) {
    this.context.worldSize = { ...worldSize };
  }
  setTurnNumber(turnNumber) {
    if (this.context.currTurn !== turnNumber)
      this.entityManager.getEntities().forEach((entity) => {
        entity.resetItemUses();
        entity.advanceItemEffectsTurn();
      });
    this.context.currTurn = turnNumber;
    this.ruleState.turnNumber = turnNumber;
  }
  getTurnNumber() {
    return this.context.currTurn;
  }
  setActiveTeam(team) {
    if (!Number.isInteger(team) || team < 0)
      throw new Error("Active team must be a non-negative integer");
    if (this.context.activeTeam !== team)
      this.feedback.record("turn" /* Turn */, this.getTurnNumber(), { data: { activeTeam: team } });
    this.context.activeTeam = team;
    this.ruleState.activeTeam = team;
  }
  getRuleState() {
    return { ...this.ruleState };
  }
  setRuleState(ruleState) {
    this.ruleState = { ...ruleState };
    this.context.activeTeam = ruleState.activeTeam;
    this.context.currTurn = ruleState.turnNumber;
  }
  skipCurrentPhase() {
    const mode = this.settings?.gameMode ?? currentTurnMode;
    const interpreter = new RuleInterpreter(mode);
    const nextState = interpreter.advancePhase(this.ruleState);
    this.setRuleState(nextState);
    return this.getRuleState();
  }
  startTurn(ruleState) {
    this.setTurnNumber(ruleState.turnNumber);
    this.setActiveTeam(ruleState.activeTeam);
    this.setRuleState(ruleState);
    this.drawItemsForActiveTeam();
  }
  getMatchResult() {
    return this.matchResult && { ...this.matchResult };
  }
  setMatchResult(result) {
    this.matchResult = result && { ...result };
  }
  finishMatch(result) {
    this.matchResult = { ...result };
    this.context.state = "GameState.Game_over" /* Game_over */;
    this.feedback.record("result" /* Result */, this.getTurnNumber(), { data: result });
  }
  getAiSettings() {
    return this.settings?.ai ? JSON.parse(JSON.stringify(this.settings.ai)) : undefined;
  }
  createAiProducer() {
    const ai = this.getAiSettings();
    if (!ai)
      return;
    switch (ai.difficulty) {
      case "easy":
        return new EasyAi;
      case "medium":
        return new MediumAi;
      case "hard":
        return new HardAi;
    }
  }
  rematch() {
    if (this.disposed)
      throw new Error("A disposed match cannot be rematched");
    if (!this.initialSettings)
      throw new Error("A rematch requires initial game settings");
    const settings = JSON.parse(JSON.stringify(this.initialSettings));
    this.entityManager.applySettings(settings.players);
    this.initializeFixedLoadouts();
    this.context.structures = settings.mapBoundarys.map((boundary) => new FullStructure(boundary));
    this.setPhysics(new defaultPhysics(settings.friction));
    this.setWorldSize(settings.screenResolution);
    this.setMyTeam(settings.myTeam);
    this.setTeamSize(settings.allTeamSize);
    this.setItems(settings.items);
    this.loadEffects(settings.effects);
    this.initializeItemDraws();
    this.resetMapItemPickups();
    const initialPhase = settings.gameMode?.phases?.[0] ?? "physics" /* Physics */;
    this.startTurn({ phase: initialPhase, activeTeam: 0, turnNumber: 0, itemUses: 0 });
    this.paused = false;
    this.setMatchResult(undefined);
    this.saveSettings(settings);
    this.mouseHandler?.reset?.();
    this.setState("GameState.Your_turn" /* Your_turn */);
    return this;
  }
  dispose() {
    if (this.disposed)
      return;
    this.disposed = true;
    this.mouseHandler?.reset?.();
    this.mouseHandler = undefined;
    this.systems = [];
    this.preTickers = [];
    this.postTickers = [];
    this.preDrawers = [];
    this.postDrawers = [];
  }
  isDisposed() {
    return this.disposed;
  }
  setPaused(paused) {
    this.paused = paused;
  }
  isPaused() {
    return this.paused;
  }
  getActiveTeam() {
    return this.context.activeTeam;
  }
  start(state) {
    this.context.state = state ?? "GameState.Your_turn" /* Your_turn */;
    return this;
  }
  addStructure(structure) {
    this.context.structures.push(structure);
  }
  setMouseHandler(mouseHandler) {
    this.mouseHandler = mouseHandler;
  }
  getMouseHandler() {
    return this.mouseHandler;
  }
  setTickRate(tickRate) {
    this.dt = tickRate;
  }
  getCurrentMousePosition() {
    return { x: 0, y: 0 };
  }
  getTickRate() {
    return this.dt;
  }
  restorePhysicsState(state) {
    for (const system of this.systems) {
      if (system instanceof PhysicsSystem)
        system.restoreSnapshotState(state, this.context);
    }
  }
  getPhysicsState() {
    const system = this.systems.find((candidate) => candidate instanceof PhysicsSystem);
    return system?.toSnapshotState();
  }
  setCurrentMousePosition(_pos) {}
  saveSettings(settings) {
    this.settings = settings;
  }
  setInitialSettings(settings) {
    this.initialSettings = JSON.parse(JSON.stringify(settings));
  }
  getSettings() {
    return this.settings;
  }
  exportGame() {
    return { logs: this.turns, settings: JSON.stringify(this.settings) };
  }
  addLog(log) {
    this.logs.push(log);
  }
  recordFeedback(type, details = {}) {
    return this.feedback.record(type, this.getTurnNumber(), details);
  }
  getFeedbackTrace(fromSequence = 0) {
    return this.feedback.list(fromSequence);
  }
  serialize() {
    return JSON.stringify(this);
  }
  deserialize(_) {
    return new GameHandlerBuilder().defaultSystems().fromSettings(GameSettings).build();
  }
  getGameId() {
    return this.id;
  }
  toSettings() {
    const effects = [];
    this.effectAlways.forEach((eff) => effects.push({ trigger: "EffectTrigger.Always" /* Always */, triggerValue: [], ...eff.toSettings() }));
    this.effectRound.forEach((eff) => effects.push({ trigger: "EffectTrigger.Round" /* Round */, triggerValue: [], ...eff.toSettings() }));
    this.effectCollision.forEach((eff) => effects.push({ trigger: "EffectTrigger.Collision" /* Collision */, triggerValue: [], ...eff.toSettings() }));
    const settings = {
      schemaVersion: this.settings?.schemaVersion ?? 1,
      state: this.getState(),
      background: this.settings?.background ?? { color: "white", type: "color" },
      friction: this.getPhysics().toSettings(),
      drift: this.settings?.drift ?? DEFAULT_DRIFT,
      id: this.getGameId(),
      mapBoundarys: this.context.structures.map((str) => str.toSettings()),
      screenResolution: this.settings?.screenResolution ?? { ...this.context.worldSize },
      worldSize: { ...this.context.worldSize },
      myTeam: [...this.team],
      allTeams: this.settings?.allTeams ? [...this.settings.allTeams] : [],
      effects,
      items: this.items.map((item) => ({ ...item })),
      players: this.entityManager.toSettings(),
      minPlayers: this.settings?.minPlayers ?? 0,
      maxPlayers: this.settings?.maxPlayers ?? 0,
      allTeamSize: this.teamSize,
      playerCount: this.settings?.playerCount ?? 1,
      figuresPerPlayer: this.settings?.figuresPerPlayer ?? Math.max(1, this.entityManager.getEntities().length),
      ...this.settings?.mapReference ? { mapReference: { ...this.settings.mapReference } } : {},
      ...this.settings?.gameMode ? { gameMode: JSON.parse(JSON.stringify(this.settings.gameMode)) } : {},
      ...this.settings?.ai ? { ai: JSON.parse(JSON.stringify(this.settings.ai)) } : {},
      turnNumber: this.getContext().currTurn,
      activeTeam: this.getActiveTeam(),
      ruleState: { ...this.ruleState, activeTeam: this.getActiveTeam(), turnNumber: this.getTurnNumber() },
      matchResult: this.getMatchResult(),
      physicsState: this.getPhysicsState(),
      systems: (() => {
        const serialized = this.systems.map((system) => {
          if (!("systemId" in system) || !("toSettings" in system))
            throw new Error("All registered systems must implement ISettingsSerialize");
          return system.toSettings();
        });
        if (new Set(serialized.map((system) => system.systemId)).size !== serialized.length)
          throw new Error("Duplicate system IDs are not serializable");
        return serialized.sort((a, b) => a.systemId.localeCompare(b.systemId));
      })(),
      systemOrder: this.systems.map((system) => {
        if (!("systemId" in system))
          throw new Error("All registered systems require a stable systemId");
        return system.systemId;
      }),
      tickRate: this.getTickRate(),
      ...this.itemDrawRandom ? { itemDrawState: { randomState: this.itemDrawRandom.getState() } } : {},
      ...this.mapPickupSystem.toState() ? { itemPickupState: this.mapPickupSystem.toState() } : {}
    };
    this.saveSettings(JSON.parse(JSON.stringify(settings)));
    return settings;
  }
  getTeam() {
    return this.team;
  }
  setId(id) {
    this.id = id;
  }
  getId() {
    return this.id;
  }
  setMyTeam(team) {
    this.team = team;
    this.context.myTeamNumber = team[0] ?? 0;
  }
  addEffectEveryTick(effect) {
    this.effectAlways.push(effect);
  }
  addEffectEveryRound(effect) {
    this.effectRound.push(effect);
  }
  addEffectEveryCollision(effect) {
    this.effectCollision.push(effect);
  }
  setTeamSize(size) {
    this.teamSize = size;
  }
  setItems(items) {
    items.forEach(validateItemDocument);
    this.items = structuredClone(items);
  }
  configureMapItemPickups(pickups) {
    this.mapPickupSystem.configure(pickups, this.items);
  }
  getAuthoritativeRenderState() {
    return {
      gameState: this.getState(),
      ruleState: this.getRuleState(),
      matchResult: this.getMatchResult(),
      structures: this.context.structures.map((structure) => structure.toSettings()),
      players: this.entityManager.toSettings(),
      pickups: this.mapPickupSystem.getPickups(),
      pickupState: this.mapPickupSystem.toState()
    };
  }
  restoreMapItemPickups(state) {
    this.mapPickupSystem.restore(state);
  }
  resetMapItemPickups() {
    this.mapPickupSystem.reset();
  }
  useItem(actorId, itemId, target = { type: "self" }) {
    const actor = this.entityManager.getEntityById(actorId);
    if (!actor)
      throw new Error(`Actor ${actorId} not found`);
    const item = this.items.find((candidate) => candidate.id === itemId);
    if (!item)
      throw new Error(`Item '${itemId}' is not declared for this game`);
    validateItemTarget(item, target, { actor, entities: this.entityManager.getEntities(), worldSize: this.context.worldSize });
    if (item.id === MYSTERY_BOX_ITEM_ID) {
      this.resolveMysteryBoxUse(actor, item);
      this.feedback.record("item" /* Item */, this.getTurnNumber(), { actorId, data: { itemId } });
      return;
    }
    const targetEntity = target.type === "entity" ? this.entityManager.getEntityById(target.entityId) : actor;
    if (!targetEntity)
      throw new Error("Item target entity not found");
    const runtimeEffects = item.effects.map((effect) => createRuntimeItemEffect({ type: effect.type, typeValue: structuredClone(effect.value ?? {}) }));
    const inventory = actor.getInventory();
    consumeInventoryItem(inventory, item);
    const combination = validateItemCombination(item, targetEntity.getItemEffects(), new Map(this.items.map((candidate) => [candidate.id, candidate])));
    targetEntity.removeItemEffects(combination.removeItemIds);
    this.applyItemEffects(actor, target, runtimeEffects, item);
    actor.setInventory(inventory);
    this.feedback.record("item" /* Item */, this.getTurnNumber(), { actorId, targetIds: target.type === "entity" ? [target.entityId] : [actorId], data: { itemId } });
    if (item.effects.some((effect) => effect.type === "shield"))
      this.feedback.record("shield" /* Shield */, this.getTurnNumber(), { actorId, data: { itemId } });
  }
  applyItemEffects(actor, target, effects, item) {
    const targetEntity = target.type === "entity" ? this.entityManager.getEntityById(target.entityId) : actor;
    if (target.type === "entity" && !targetEntity)
      throw new Error("Item target entity not found");
    for (const effect of effects) {
      if (effect instanceof EffectMagnet && targetEntity)
        targetEntity.setVel(effect.applyToVelocity(targetEntity.getVel(), actor.getPos(), targetEntity.getPos()));
      else if (effect instanceof EffectSwapPosition && targetEntity && targetEntity !== actor) {
        const actorPosition = actor.getPos();
        actor.setPos(targetEntity.getPos());
        targetEntity.setPos(actorPosition);
      } else {
        (targetEntity ?? actor).addItemEffect(effect.toSettings(), { itemId: item.id, order: itemOrder(item) });
      }
    }
  }
  mysteryBoxRewardOptions(actorId) {
    const economy = this.settings?.gameMode?.itemEconomy;
    const baseSeed = economy?.randomDraw?.seed ?? hashString(this.id);
    return {
      candidatePool: economy?.mysteryBox?.candidatePool,
      seed: deriveMysteryBoxSeed({ actorId, turnNumber: this.ruleState.turnNumber, activeTeam: this.ruleState.activeTeam, baseSeed }),
      allowMysteryBoxReward: economy?.mysteryBox?.allowMysteryBoxReward,
      knownItemIds: this.items.map((candidate) => candidate.id)
    };
  }
  resolveMysteryBoxUse(actor, item) {
    const options = this.mysteryBoxRewardOptions(actor.getId());
    const rewardId = resolveMysteryBoxReward(options);
    const inventory = actor.getInventory();
    consumeInventoryItem(inventory, item);
    grantMysteryBoxReward(inventory, this.items, { ...options, specificItemId: rewardId });
    actor.setInventory(inventory);
  }
  loadEffects(effects) {
    this.effectAlways = [];
    this.effectRound = [];
    this.effectCollision = [];
    for (const effect of effects) {
      switch (effect.trigger) {
        case "EffectTrigger.Always" /* Always */:
          this.effectAlways.push(createRuntimeEffect(effect));
          break;
        case "EffectTrigger.Round" /* Round */:
          this.effectRound.push(createRuntimeEffect(effect));
          break;
        case "EffectTrigger.Collision" /* Collision */:
          this.effectCollision.push(createRuntimeEffect(effect));
          break;
      }
    }
  }
  initializeFixedLoadouts() {
    const loadouts = this.settings?.gameMode?.itemEconomy.fixedLoadouts ?? [];
    for (const loadout of loadouts) {
      const inventory = createFixedLoadoutInventory(loadout, this.items);
      for (const entity of this.entityManager.getEntities()) {
        if (entity.getTeam().includes(loadout.team))
          entity.setInventory(inventory);
      }
    }
  }
  initializeItemDraws() {
    const draw = this.settings?.gameMode?.itemEconomy.randomDraw;
    this.itemDrawRandom = draw ? new SeededRandom(draw.seed) : undefined;
    if (draw)
      this.validateItemDrawPool(draw.itemIds);
  }
  restoreItemDraws(state) {
    const draw = this.settings?.gameMode?.itemEconomy.randomDraw;
    if (!draw) {
      if (state)
        throw new Error("Item draw state requires a configured random draw");
      this.itemDrawRandom = undefined;
      return;
    }
    this.validateItemDrawPool(draw.itemIds);
    if (!state)
      throw new Error("Configured item draws require a serialized draw state");
    this.itemDrawRandom = SeededRandom.fromState(state.randomState);
  }
  drawItemsForActiveTeam() {
    const draw = this.settings?.gameMode?.itemEconomy.randomDraw;
    if (!draw || !this.itemDrawRandom)
      return;
    const drawnItems = Array.from({ length: draw.drawsPerTurn }, () => {
      const itemId = draw.itemIds[this.itemDrawRandom.nextInt(draw.itemIds.length)];
      const item = this.items.find((candidate) => candidate.id === itemId);
      if (!item)
        throw new Error(`Seeded item draw references unknown item '${itemId}'`);
      return item;
    });
    for (const entity of this.entityManager.getEntities()) {
      if (!entity.getTeam().includes(this.getActiveTeam()))
        continue;
      const inventory = entity.getInventory();
      for (const item of drawnItems)
        addDrawnInventoryItem(inventory, item);
      entity.setInventory(inventory);
    }
  }
  validateItemDrawPool(itemIds) {
    for (const itemId of itemIds) {
      if (!this.items.some((item) => item.id === itemId))
        throw new Error(`Seeded item draw references unknown item '${itemId}'`);
    }
  }
}

class GameHandlerBuilder {
  engine;
  myTeam = [];
  enemyTeam = [];
  state = "GameState.Your_turn" /* Your_turn */;
  constructor(tickRate) {
    this.engine = new GameHandler;
    this.engine.setTickRate(tickRate ?? 1);
  }
  addSystem(system) {
    this.engine.addSystem(system);
    return this;
  }
  addUIMouse(mousehandler) {
    this.engine.setMouseHandler(mousehandler);
    return this;
  }
  addPlayer(player) {
    this.engine.getEntityManager().addEntity(player);
    return this;
  }
  addStructure(structure) {
    if (structure)
      this.engine.addStructure(structure);
    return this;
  }
  addBackground(background) {
    this.engine.addPreTickAndDraw(background);
    return this;
  }
  setPlayerTeam(teams) {
    teams.forEach((team) => this.myTeam.push(team));
    this.engine.setMyTeam(this.myTeam);
    return this;
  }
  setOpponentTeam(teams) {
    teams.forEach((team) => this.enemyTeam.push(team));
    return this;
  }
  addPhysics(physics) {
    this.engine.setPhysics(physics);
    return this;
  }
  defaultSystems(friction2) {
    const physics = new defaultPhysics(friction2);
    const physicsSystem = new PhysicsSystem(physics);
    this.engine.attachFeedbackToPhysics(physicsSystem);
    this.addPhysics(physics).addSystem(new MovementSystem).addSystem(new PlaybackSystem).addSystem(physicsSystem).addSystem(new BoundarySystem).addSystem(new GameStateManager);
    return this;
  }
  fromSettings(gameSettings) {
    const drift = gameSettings.drift ?? DEFAULT_DRIFT;
    validateDrift(drift);
    const playerCount = gameSettings.playerCount ?? (gameSettings.maxPlayers > 0 ? gameSettings.maxPlayers : 1);
    const figuresPerPlayer = gameSettings.figuresPerPlayer ?? Math.max(1, Math.floor(gameSettings.players.length / playerCount));
    validateFigureCounts(playerCount, figuresPerPlayer);
    if (gameSettings.gameMode !== undefined)
      validateItemEconomySettings(gameSettings.gameMode.itemEconomy);
    this.engine.saveSettings({ ...gameSettings, drift, playerCount, figuresPerPlayer });
    const { state: _state, turnNumber: _turnNumber, activeTeam: _activeTeam, ruleState: _ruleState, itemDrawState: _itemDrawState, itemPickupState: _itemPickupState, matchResult: _matchResult, physicsState: _physicsState, tickRate: _tickRate, systems: _systems, systemOrder: _systemOrder, ...initialSettings } = gameSettings;
    this.engine.setInitialSettings(initialSettings);
    const { screenResolution, worldSize = screenResolution, background, myTeam, mapBoundarys, players } = gameSettings;
    this.engine.setId(gameSettings.id);
    this.engine.setTickRate(gameSettings.tickRate ?? 1);
    this.engine.setWorldSize(worldSize);
    this.engine.setPhysics(new defaultPhysics(gameSettings.friction));
    const snapshot = gameSettings;
    if (snapshot.systems !== undefined && snapshot.systems.length > 0) {
      validateSystemSettingsList(snapshot.systems, snapshot.systemOrder);
      const systemSettings = snapshot.systems;
      const systemOrder = snapshot.systemOrder;
      const byId = new Map(systemSettings.map((system) => [system.systemId, system]));
      const restored = new Map;
      for (const id of systemSettings.map((system) => system.systemId).filter((id2) => id2 !== "core.simulator"))
        restored.set(id, createSystemFromSettings(byId.get(id), restored));
      if (byId.has("core.simulator"))
        restored.set("core.simulator", createSystemFromSettings(byId.get("core.simulator"), restored));
      this.engine.replaceSystems(systemOrder.map((id) => restored.get(id)));
      const restoredPhysics = this.engine.getSystems().find((system) => system.systemId === "core.physics");
      if (!restoredPhysics)
        throw new Error("System snapshot must include core.physics");
      restoredPhysics.strategy = this.engine.getPhysics();
      this.engine.attachFeedbackToPhysics(restoredPhysics);
    }
    let backgroundSettings = getBackgoundSystem(background);
    this.engine.setMyTeam(myTeam ?? [crypto.randomUUID()]);
    this.engine.setTeamSize(gameSettings.allTeamSize);
    this.engine.setItems(gameSettings.items);
    this.engine.configureMapItemPickups(gameSettings.gameMode?.itemEconomy.mapPickups ?? []);
    this.engine.loadEffects(gameSettings.effects);
    players.forEach((player) => this.addPlayer(createRuntimePlayer(player)));
    if (!("state" in gameSettings)) {
      this.engine.initializeFixedLoadouts();
      this.engine.initializeItemDraws();
      this.engine.startTurn({ phase: gameSettings.gameMode?.phases[0] ?? "physics" /* Physics */, activeTeam: 0, turnNumber: 0, itemUses: 0 });
    }
    mapBoundarys.forEach((boundary) => this.engine.addStructure(new FullStructure(boundary)));
    if (!("state" in gameSettings) && gameSettings.environmentalMechanics?.length) {
      const firstIndex = mapBoundarys.length - gameSettings.environmentalMechanics.length;
      this.engine.addSystem(new EnvironmentalSystem(gameSettings.environmentalMechanics, undefined, gameSettings.environmentalMechanics.map((_, index) => firstIndex + index)));
    }
    if ("state" in gameSettings) {
      this.state = gameSettings.state;
      const ruleState = gameSettings.ruleState ?? { phase: "physics" /* Physics */, activeTeam: gameSettings.activeTeam ?? 0, turnNumber: gameSettings.turnNumber, itemUses: 0 };
      this.engine.setRuleState(ruleState);
      this.engine.setTurnNumber(ruleState.turnNumber);
      this.engine.setActiveTeam(ruleState.activeTeam);
      this.engine.setMatchResult(gameSettings.matchResult);
      this.engine.restoreItemDraws(gameSettings.itemDrawState);
      this.engine.restoreMapItemPickups(gameSettings.itemPickupState);
      this.engine.restorePhysicsState(gameSettings.physicsState);
    }
    return this.addBackground(backgroundSettings).setWorldSize(worldSize.x, worldSize.y);
  }
  setWorldSize(x2, y2) {
    this.engine.setWorldSize({ x: x2, y: y2 });
    return this;
  }
  setMyTeam(team) {
    this.engine.setMyTeam(team);
  }
  build() {
    return this.engine.start(this.state);
  }
}

function createRuntimeHandler(settings, systems, systemOrder) {
  if (systems && systems.length > 0) {
    const order = systemOrder && systemOrder.length === systems.length ? [...systemOrder] : systems.map((system) => system.systemId);
    const snapshot = {
      ...settings,
      systems: systems.map((system) => ({ systemId: system.systemId, schemaVersion: 1, state: structuredClone(system.state) })),
      systemOrder: [...order]
    };
    return new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();
  }
  return new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
}

var DOCUMENT_SCHEMA_VERSION = 1;
function validateMapDocument(document) {
  if (!isRecord9(document) || document.schemaVersion !== DOCUMENT_SCHEMA_VERSION)
    throw new Error("Invalid map schema version");
  if (!isRecord9(document.metadata) || typeof document.metadata.id !== "string" || typeof document.metadata.name !== "string")
    throw new Error("Invalid map metadata");
  if (!isVector6(document.worldSize) || document.worldSize.x <= 0 || document.worldSize.y <= 0)
    throw new Error("Invalid map world size");
  if (!isFriction(document.friction) || typeof document.drift !== "number" || !Number.isFinite(document.drift) || document.drift < 0 || document.drift > 1)
    throw new Error("Invalid map physics");
  if (!Array.isArray(document.arenaGeometry) || !document.arenaGeometry.every(isArenaGeometry) || !Array.isArray(document.spawnRegions) || !Array.isArray(document.hazards))
    throw new Error("Invalid map collections");
  if (!document.spawnRegions.every(isSpawnRegion))
    throw new Error("Invalid map spawn region");
  if (!document.hazards.every(isMapHazard))
    throw new Error("Invalid map hazard");
  if (document.environmentalMechanics !== undefined)
    validateEnvironmentalMechanics(document.environmentalMechanics);
}
function isRecord9(value) {
  return typeof value === "object" && value !== null;
}
function isVector6(value) {
  return isRecord9(value) && typeof value.x === "number" && typeof value.y === "number" && Number.isFinite(value.x) && Number.isFinite(value.y);
}
function isFriction(value) {
  return isRecord9(value) && [value.friction, value.linearDrag, value.stopThreshold].every((item) => typeof item === "number" && Number.isFinite(item));
}
function isSpawnRegion(value) {
  return isRecord9(value) && typeof value.team === "number" && Number.isSafeInteger(value.team) && value.team >= 0 && typeof value.w === "number" && typeof value.h === "number" && [value.x, value.y, value.w, value.h].every((item) => typeof item === "number" && Number.isFinite(item)) && value.w > 0 && value.h > 0;
}
function isArenaGeometry(value) {
  if (!isRecord9(value) || typeof value.x !== "number" || typeof value.y !== "number" || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Array.isArray(value.effects))
    return false;
  if (value.type === 0 /* CIRCLE */)
    return typeof value.r === "number" && value.r > 0;
  if (value.type === 2 /* RECTANGLE */)
    return typeof value.w === "number" && typeof value.h === "number" && value.w > 0 && value.h > 0;
  return value.type === 1 /* LINE */ && typeof value.x2 === "number" && typeof value.y2 === "number" && Number.isFinite(value.x2) && Number.isFinite(value.y2);
}
function arrangeTeamStartGrid(players, region) {
  if (players.length === 6) {
    const size = players[0].size * 2;
    const cellSize = Math.min(region.w / 2, region.h / 3);
    if (!(cellSize > size))
      throw new Error("Map spawn region is too small for the 2x3 team formation");
    const offsetX = (region.w - cellSize * 2) / 2;
    const offsetY = 0;
    players.forEach((player, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      player.position.x = region.x + offsetX + col * cellSize + size / 2;
      player.position.y = region.y + offsetY + row * cellSize + size / 2;
    });
    return;
  }
  arrangeInGrid(players, region);
}
function loadMapDocument(map, template) {
  validateMapDocument(map);
  const players = template.players.map((player) => createPlayerSettings(player));
  const playersByTeam = new Map;
  for (const player of players) {
    const team = player.team[0];
    if (team === undefined)
      throw new Error("Map loading requires each player to have a team");
    const teamPlayers = playersByTeam.get(team) ?? [];
    teamPlayers.push(player);
    playersByTeam.set(team, teamPlayers);
  }
  for (const [team, teamPlayers] of playersByTeam) {
    const region = map.spawnRegions.find((spawn) => spawn.team === team);
    if (!region)
      throw new Error(`Map has no spawn region for team ${team}`);
    arrangeTeamStartGrid(teamPlayers, region);
  }
  return {
    ...template,
    players,
    worldSize: { ...map.worldSize },
    friction: { ...map.friction },
    drift: map.drift,
    mapBoundarys: [
      ...map.arenaGeometry.map((boundary) => ({
        ...boundary,
        color: boundary.color ?? (boundary.role === "containment" ? undefined : DEFAULT_MAP_STRUCTURE_COLOR),
        effects: boundary.effects.map((effect) => ({ ...effect }))
      })),
      ...map.hazards.map(hazardToBoundary),
      ...(map.environmentalMechanics ?? []).map(environmentalMechanicToBoundary)
    ],
    environmentalMechanics: map.environmentalMechanics ? structuredClone(map.environmentalMechanics) : undefined
  };
}
var DEFAULT_MAP_STRUCTURE_COLOR = "#315b7d";
function isMapHazard(value) {
  if (!isRecord9(value) || value.schemaVersion !== DOCUMENT_SCHEMA_VERSION || typeof value.id !== "string" || !value.id || typeof value.type !== "string" || !isRecord9(value.trigger) || value.trigger.type !== "collision" || !isRecord9(value.config))
    return false;
  if (!isHazardZone(value.config))
    return false;
  if (value.type === "kill-zone")
    return true;
  return value.type === "force" && typeof value.config.angle === "number" && Number.isFinite(value.config.angle) && value.config.angle >= 0 && value.config.angle < 360 && typeof value.config.power === "number" && Number.isFinite(value.config.power) && value.config.power > 0;
}
function isHazardZone(value) {
  const { x: x2, y: y2, r } = value;
  return [x2, y2, r].every((item) => typeof item === "number" && Number.isFinite(item)) && typeof r === "number" && r > 0;
}
function hazardToBoundary(hazard) {
  const zone = hazard.config;
  return {
    type: 0 /* CIRCLE */,
    x: zone.x,
    y: zone.y,
    r: zone.r,
    color: hazard.type === "kill-zone" ? "#d94b28" : "#f0a020",
    effects: [hazardEffect(hazard)]
  };
}
function hazardEffect(hazard) {
  if (hazard.type === "kill-zone") {
    return { trigger: "EffectTrigger.Collision" /* Collision */, triggerValue: [], type: "EffectType.ModifySetting" /* ModifySetting */, typeValue: { operation: "set" /* Set */, key: "dead", value: true } };
  }
  const config = hazard.config;
  const radians = config.angle * Math.PI / 180;
  return {
    trigger: "EffectTrigger.Collision" /* Collision */,
    triggerValue: [],
    type: "EffectType.ModifySetting" /* ModifySetting */,
    typeValue: { operation: "add" /* Add */, key: "velocity", value: { x: Math.cos(radians) * config.power, y: Math.sin(radians) * config.power } }
  };
}
function environmentalMechanicToBoundary(mechanic) {
  return { ...structuredClone(mechanic.structure), effects: structuredClone(mechanic.effects ?? mechanic.structure.effects) };
}

var KORE_AUDIO_ASSETS = {
  "kore.music.menu": "/public/audio/CM_01_Ascension.mp3",
  "kore.music.match": "/public/audio/CM_02_Moon_Shadows.mp3",
  "kore.ui.confirm": "/public/audio/CM_03_Ritualis.mp3",
  "kore.game.shot": "/public/audio/CM_04_Sacrifice.mp3",
  "kore.game.collision": "/public/audio/CM_04_Sacrifice.mp3",
  "kore.game.damage": "/public/audio/CM_04_Sacrifice.mp3",
  "kore.game.shield": "/public/audio/CM_04_Sacrifice.mp3",
  "kore.game.item": "/public/audio/CM_03_Ritualis.mp3",
  "kore.game.hazard": "/public/audio/CM_04_Sacrifice.mp3",
  "kore.game.elimination": "/public/audio/CM_04_Sacrifice.mp3",
  "kore.game.turn": "/public/audio/CM_03_Ritualis.mp3",
  "kore.game.result": "/public/audio/CM_03_Ritualis.mp3"
};
var KORE_AUDIO_BUSES = [
  audio.bus({ id: "master", volume: 1, muted: false, maxVoices: 64, defaultPriority: 0, paused: false }),
  audio.bus({ id: "music", volume: 0.1, muted: false, maxVoices: 1, defaultPriority: 50, paused: false }),
  audio.bus({ id: "ambience", volume: 0.6, muted: false, maxVoices: 8, defaultPriority: 20, paused: false }),
  audio.bus({ id: "effects", volume: 0.6, muted: false, maxVoices: 32, defaultPriority: 10, paused: false }),
  audio.bus({ id: "ui", volume: 0.45, muted: false, maxVoices: 8, defaultPriority: 30, paused: false }),
  audio.bus({ id: "voice", volume: 0.8, muted: false, maxVoices: 8, defaultPriority: 40, paused: false })
];
function createKoreAudioSettings(runtimeId) {
  return audio.createSettings({ runtimeId, buses: KORE_AUDIO_BUSES });
}
var koreAudio = {
  assets: KORE_AUDIO_ASSETS,
  buses: KORE_AUDIO_BUSES,
  createSettings: createKoreAudioSettings,
  sounds: { uiConfirm: "kore.ui.confirm", shot: "kore.game.shot", collision: "kore.game.collision", damage: "kore.game.damage", shield: "kore.game.shield", item: "kore.game.item", hazard: "kore.game.hazard", elimination: "kore.game.elimination", turn: "kore.game.turn", result: "kore.game.result" },
  music: { menu: "kore.music.menu", match: "kore.music.match" },
  command: {
    uiConfirm(sourceId, soundId = "kore.ui.confirm") {
      return audio.command.play({ sourceId, soundId, bus: "ui", priority: 30, dedupeKey: "confirm" });
    },
    shot(sourceId) {
      return audio.command.play({ sourceId, soundId: "kore.game.shot", bus: "effects", priority: 20, dedupeKey: "shot" });
    },
    menuMusic(sourceId = "menu.music") {
      return audio.command.music({ sourceId, soundId: "kore.music.menu", bus: "music", priority: 10, replacementPolicy: "replace-current", fadeInMs: 250 });
    },
    matchMusic(sourceId = "match.music") {
      return audio.command.music({ sourceId, soundId: "kore.music.match", bus: "music", priority: 20, replacementPolicy: "replace-lower-or-equal", fadeInMs: 500 });
    }
  }
};

var KORE_MATCH_DEFINITION_VERSION = 1;
function createGameMode(input) {
  if (!input || typeof input.id !== "string" || input.id.trim() === "")
    throw new Error("A game mode requires a non-empty id");
  const mode = {
    schemaVersion: input.schemaVersion ?? 1,
    id: input.id,
    phases: [...input.phases],
    maxItemsPerTurn: input.maxItemsPerTurn ?? 0,
    winCondition: input.winCondition ?? "last-team-standing" /* LastTeamStanding */,
    itemEconomy: input.itemEconomy !== undefined ? structuredClone(input.itemEconomy) : { fixedLoadouts: [], mapPickups: [] }
  };
  validateGameMode(mode);
  return structuredClone(mode);
}
function validateGameMode(mode) {
  if (mode.schemaVersion !== undefined && mode.schemaVersion !== 1)
    throw new Error("Unsupported game mode schema version");
  new RuleInterpreter(mode);
  validateItemEconomySettings(mode.itemEconomy);
}
function createMatchSystemProfile(teamCount) {
  if (!Number.isSafeInteger(teamCount) || teamCount < 1)
    throw new Error("A match system profile requires at least one team");
  const registry = new EngineSystemRegistry().register({ id: "core.movement", provides: ["movement.state"], acceptsEffects: ["movement.integrate"], before: ["core.playback"] }).register({ id: "core.playback", provides: ["playback"], state: { remainingFrames: 0, syncPending: false, completionPending: false, finalState: null } }).register({ id: "core.physics", provides: ["physics"], after: ["core.playback"], state: { fps: 1, contacts: [] } }).register({ id: "core.boundary", requires: ["physics"], after: ["core.physics"] }).register({ id: "core.game-state-manager", after: ["core.boundary"] }).register({ id: "core.winning", after: ["core.game-state-manager"], state: { teamCount, pending: null } });
  const framework = registry.select(["core.movement", "core.playback", "core.physics", "core.boundary", "core.game-state-manager", "core.winning"]);
  assertJsonValue(framework.systems);
  return framework;
}
function authorMatchSettings(settings, options) {
  if (typeof options.matchId !== "string" || options.matchId.trim() === "")
    throw new Error("A match requires a non-empty id");
  if (!Array.isArray(options.myTeam) || options.myTeam.some((team) => !Number.isSafeInteger(team) || team < 0))
    throw new Error("A match requires non-negative integer teams");
  validateGameSettings(settings);
  validateGameMode(options.gameMode);
  const result = structuredClone(settings);
  result.id = options.matchId;
  result.myTeam = [...options.myTeam];
  if (options.allTeams !== undefined)
    result.allTeams = [...options.allTeams];
  if (options.playerIds !== undefined) {
    if (options.playerIds.length !== result.players.length)
      throw new Error("Player IDs must match the player count");
    result.players = result.players.map((player, index) => ({ ...player, id: options.playerIds[index] }));
  }
  if (options.items !== undefined)
    result.items = options.items.map((item) => structuredClone(item));
  result.gameMode = structuredClone(options.gameMode);
  validateGameSettings(result);
  return structuredClone(result);
}
function createMatchDefinition(options) {
  validateGameSettings(options.settings);
  const gameMode = createGameMode(options.gameMode);
  if (typeof options.seed !== "number" || !Number.isSafeInteger(options.seed))
    throw new Error("A match definition requires a safe integer seed");
  const settings = structuredClone(options.settings);
  settings.gameMode = structuredClone(gameMode);
  if (options.header?.myTeam !== undefined) {
    if (!Array.isArray(options.header.myTeam) || options.header.myTeam.some((team) => !Number.isSafeInteger(team) || team < 0))
      throw new Error("Match teams must be non-negative integers");
    settings.myTeam = [...options.header.myTeam];
  }
  if (options.header?.allTeams !== undefined) {
    if (!Array.isArray(options.header.allTeams) || options.header.allTeams.some((name) => typeof name !== "string"))
      throw new Error("Match team names must be strings");
    settings.allTeams = [...options.header.allTeams];
  }
  if (options.header?.ai !== undefined) {
    validateAiSettings(options.header.ai);
    settings.ai = structuredClone(options.header.ai);
  }
  validateGameSettings(settings);
  const teamCount = settings.allTeamSize > 0 ? settings.allTeamSize : settings.playerCount > 0 ? settings.playerCount : 2;
  const framework = createMatchSystemProfile(teamCount);
  const definition = {
    schemaVersion: KORE_MATCH_DEFINITION_VERSION,
    id: settings.id,
    ...options.mapId !== undefined ? { mapId: options.mapId } : {},
    seed: options.seed,
    settings: structuredClone(settings),
    systems: structuredClone(framework.systems),
    systemOrder: [...framework.systemOrder]
  };
  validateKoreMatchDefinition(definition);
  return structuredClone(definition);
}
function validateKoreMatchDefinition(value) {
  if (!isRecord10(value))
    throw new Error("Malformed match definition");
  if (value.schemaVersion !== KORE_MATCH_DEFINITION_VERSION)
    throw new Error("Unsupported match definition version");
  if (typeof value.id !== "string" || value.id.trim() === "")
    throw new Error("A match definition requires a non-empty id");
  if (typeof value.seed !== "number" || !Number.isSafeInteger(value.seed))
    throw new Error("A match definition requires a safe integer seed");
  validateGameSettings(value.settings);
  if (value.settings.gameMode === undefined)
    throw new Error("A match definition requires a game mode");
  validateGameMode(value.settings.gameMode);
  if (!Array.isArray(value.systems) || !Array.isArray(value.systemOrder))
    throw new Error("A match definition requires systems and systemOrder arrays");
  const ids = new Set;
  for (const system of value.systems) {
    if (!isRecord10(system) || typeof system.systemId !== "string" || !/^[a-z0-9.-]{1,80}$/.test(system.systemId) || system.schemaVersion !== 1 || !isRecord10(system.state)) {
      throw new Error("Malformed system settings in match definition");
    }
    if (ids.has(system.systemId))
      throw new Error("Duplicate system in match definition");
    ids.add(system.systemId);
    assertJsonValue(system.state);
  }
  if (value.systemOrder.length !== ids.size || new Set(value.systemOrder).size !== ids.size || value.systemOrder.some((id) => !ids.has(id))) {
    throw new Error("Invalid match definition system order");
  }
}
function createRuntimeMatch(definition) {
  validateKoreMatchDefinition(definition);
  return createRuntimeHandler(definition.settings, definition.systems, definition.systemOrder);
}
function isRecord10(value) {
  return typeof value === "object" && value !== null;
}

var GAME_MODE_CATALOG_SCHEMA_VERSION = 1;
var GAME_MODE_CATALOG = [
  {
    schemaVersion: 1,
    id: "quick-slip-v1",
    name: "Quick Slip",
    description: "A clean physics turn with no item phase.",
    selectable: true,
    mode: createGameMode({ id: "quick-slip-v1", phases: ["physics" /* Physics */], winCondition: "last-team-standing" /* LastTeamStanding */ })
  },
  {
    schemaVersion: 1,
    id: "power-rush-v1",
    name: "Power Rush",
    description: "Two deterministic item uses before every physics shot.",
    selectable: true,
    mode: createGameMode({ id: "power-rush-v1", phases: ["item" /* Item */, "physics" /* Physics */], maxItemsPerTurn: 2, winCondition: "last-team-standing" /* LastTeamStanding */ })
  }
];
function getGameModeCatalogEntry(modeId) {
  const entry = GAME_MODE_CATALOG.find((candidate) => candidate.id === modeId);
  if (!entry || !entry.selectable)
    throw new Error(`Unknown or unavailable game mode: ${modeId}`);
  return entry;
}
function getSelectableGameModes() {
  return GAME_MODE_CATALOG.map((entry) => structuredClone(entry));
}

var CONTENT_PACKAGE_SCHEMA_VERSION = 1;
var CONTENT_PACKAGE_MAX_DEPENDENCIES = 32;
var CONTENT_PACKAGE_MAX_DOCUMENTS = 256;
var ITEM_EFFECTS = ["modifyForce", "modifyRotation", "lockRotation", "applyTorque", "spawnTrigger", "delayedEffect", "shield", "freeze", "swapPosition", "temporaryWall", "ghostMode", "magnet", "selectionLock", "aimVariance"];
var EXECUTABLE_KEYS = new Set(["constructor", "prototype", "__proto__", "code", "script", "function", "source", "module", "import", "require", "eval", "execute", "handler", "callback"]);
var MODULE_SCHEMES = /^(?:[a-z]+:|[./\\]|@)/i;
function validateContentPackage(value) {
  assertJson(value, "package");
  const pkg = value;
  assertKeys2(pkg, ["schemaVersion", "manifest", "maps", "items", "modes", "ui", "audio", "presentation"], "package");
  if (pkg.schemaVersion !== CONTENT_PACKAGE_SCHEMA_VERSION)
    throw new Error(`Unsupported content package schema version: ${String(pkg.schemaVersion)}`);
  validateManifest(pkg.manifest);
  const maps = arrayOf(pkg.maps, "maps");
  const items = arrayOf(pkg.items, "items");
  const modes = arrayOf(pkg.modes, "modes");
  const ids = new Set;
  for (const map of maps) {
    validateMapDocument(map);
    assertKeys2(map, ["schemaVersion", "metadata", "worldSize", "friction", "drift", "arenaGeometry", "spawnRegions", "hazards", "environmentalMechanics"], "map");
    assertKeys2(map.metadata, ["id", "name", "description"], "map metadata");
    unique(ids, map.metadata.id, "map");
  }
  const itemValidator = new ItemValidator;
  for (const effect of ITEM_EFFECTS)
    itemValidator.registerEffectType(effect);
  for (const item of items) {
    validateItemDocument(item);
    assertKeys2(item, ["schemaVersion", "id", "name", "description", "type", "effects", "targetType", "duration", "useLimit", "targetValidation", "cooldown", "interaction"], "item");
    itemValidator.validate(item);
    unique(ids, item.id, "item");
  }
  for (const mode of modes) {
    validateMode(mode);
    unique(ids, mode.id, "mode");
  }
  if (pkg.ui !== undefined)
    validateUi(pkg.ui);
  if (pkg.audio !== undefined)
    validateAudio(pkg.audio);
  if (pkg.presentation !== undefined)
    validatePresentation(pkg.presentation);
  validateReferences(items, modes, pkg.presentation);
  if (maps.length + items.length + modes.length > CONTENT_PACKAGE_MAX_DOCUMENTS)
    throw new Error("Content package contains too many documents");
}
function loadContentPackage(value) {
  validateContentPackage(value);
  const detached = normalize(value);
  return { package: structuredClone(detached), hash: hashCanonicalJson(canonicalize(detached)) };
}
function resolveMapDocument(map, template) {
  validateMapDocument(map);
  validateGameSettings(template);
  return loadMapDocument(map, structuredClone(template));
}
function canonicalizeContentPackage(value) {
  validateContentPackage(value);
  return JSON.stringify(canonicalize(normalize(value)));
}
function hashContentPackage(value) {
  return hashCanonicalJson(JSON.parse(canonicalizeContentPackage(value)));
}
function validateManifest(value) {
  if (!isRecord11(value) || typeof value.id !== "string" || !validId2(value.id) || typeof value.name !== "string" || !value.name || typeof value.version !== "string" || !validVersion(value.version))
    throw new Error("Malformed content package manifest");
  assertKeys2(value, ["id", "name", "version", "dependencies"], "manifest");
  const dependencies = arrayOf(value.dependencies, "manifest dependencies");
  if (dependencies.length > CONTENT_PACKAGE_MAX_DEPENDENCIES)
    throw new Error("Content package has too many dependencies");
  const seen = new Set;
  for (const dependency of dependencies) {
    if (!isRecord11(dependency) || typeof dependency.id !== "string" || !validId2(dependency.id) || typeof dependency.version !== "string" || !validVersion(dependency.version))
      throw new Error("Malformed content package dependency");
    if (seen.has(dependency.id))
      throw new Error(`Duplicate dependency '${dependency.id}'`);
    seen.add(dependency.id);
  }
}
function validateMode(value) {
  if (!isRecord11(value) || value.schemaVersion !== undefined && value.schemaVersion !== 1 || typeof value.id !== "string" || !validId2(value.id) || !Array.isArray(value.phases) || typeof value.maxItemsPerTurn !== "number" || !Number.isSafeInteger(value.maxItemsPerTurn) || value.maxItemsPerTurn < 0 || value.winCondition !== "last-team-standing")
    throw new Error("Malformed content package mode");
  assertKeys2(value, ["schemaVersion", "id", "phases", "maxItemsPerTurn", "winCondition", "itemEconomy"], "mode");
  if (value.phases.length === 0 || !value.phases.every((phase) => typeof phase === "string"))
    throw new Error("Malformed content package mode phases");
  validateItemEconomySettings(value.itemEconomy);
}
function validateUi(value) {
  if (!isRecord11(value))
    throw new Error("Malformed UI metadata");
  assertKeys2(value, ["labels", "icons", "menu"], "UI metadata");
  for (const key of ["labels", "icons"])
    if (value[key] !== undefined && (!isRecord11(value[key]) || Object.entries(value[key]).some(([id, text]) => !validId2(id) || typeof text !== "string")))
      throw new Error("UI metadata must contain string maps");
  if (value.menu !== undefined) {
    for (const entry of arrayOf(value.menu, "UI menu"))
      if (!isRecord11(entry) || typeof entry.route !== "string" || !validId2(entry.route) || typeof entry.label !== "string" || !entry.label || !Number.isSafeInteger(entry.order))
        throw new Error("Malformed UI menu entry");
  }
}
function validateAudio(value) {
  if (!isRecord11(value))
    throw new Error("Malformed audio declarations");
  assertKeys2(value, ["sounds", "music"], "audio declarations");
  for (const key of ["sounds", "music"])
    if (value[key] !== undefined)
      for (const [id, declaration] of Object.entries(value[key])) {
        if (!validId2(id) || !isRecord11(declaration) || typeof declaration.asset !== "string" || !safeAsset(declaration.asset) || declaration.bus !== undefined && (typeof declaration.bus !== "string" || !validId2(declaration.bus)))
          throw new Error("Malformed audio declaration");
        assertKeys2(declaration, ["asset", "bus"], "audio declaration");
      }
}
function validatePresentation(value) {
  if (!isRecord11(value))
    throw new Error("Malformed presentation declarations");
  assertKeys2(value, ["animations", "events"], "presentation declarations");
  for (const animation2 of arrayOf(value.animations, "animations"))
    validateAnimationSettings(animation2);
  for (const event of arrayOf(value.events, "presentation events"))
    validatePresentationEvent(event);
}
function validateReferences(items, modes, presentation2) {
  const itemIds = new Set(items.map((item) => item.id));
  for (const mode of modes) {
    const refs = [...mode.itemEconomy.fixedLoadouts.flatMap((loadout) => loadout.items.map((item) => item.itemId)), ...mode.itemEconomy.mapPickups.map((pickup) => pickup.itemId), ...mode.itemEconomy.randomDraw?.itemIds ?? [], ...mode.itemEconomy.mysteryBox?.candidatePool ?? []];
    if (refs.some((id) => !itemIds.has(id)))
      throw new Error("Content package references an unknown item");
  }
  const animationIds = new Set((presentation2?.animations ?? []).map((animation2) => animation2.id));
  for (const event of presentation2?.events ?? [])
    if (event.type === "play" && !animationIds.has(event.animationId))
      throw new Error("Content package references an unknown animation");
}
function normalize(value) {
  const copy = structuredClone(value);
  for (const key of ["maps", "items", "modes"])
    if (Array.isArray(copy[key]))
      copy[key] = [...copy[key]].sort((a, b) => collectionId(a).localeCompare(collectionId(b)));
  if (isRecord11(copy.manifest) && Array.isArray(copy.manifest.dependencies))
    copy.manifest.dependencies = [...copy.manifest.dependencies].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return copy;
}
function canonicalize(value) {
  if (Array.isArray(value))
    return value.map(canonicalize);
  if (isRecord11(value))
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}
function assertJson(value, path) {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error(`Malformed JSON value at ${path}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJson(entry, `${path}[${index}]`));
    return;
  }
  if (!isRecord11(value))
    throw new Error(`Malformed JSON value at ${path}`);
  for (const [key, entry] of Object.entries(value)) {
    if (EXECUTABLE_KEYS.has(key.toLowerCase()) || key.includes("/") || key.includes("\\"))
      throw new Error(`Executable or module field '${key}' is not allowed`);
    assertJson(entry, `${path}.${key}`);
  }
}
function assertKeys2(value, allowed, label) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      throw new Error(`Unknown ${label} field '${key}'`);
}
function arrayOf(value, label) {
  if (value === undefined)
    return [];
  if (!Array.isArray(value))
    throw new Error(`${label} must be an array`);
  return value;
}
function unique(ids, id, category) {
  if (!validId2(id) || ids.has(id))
    throw new Error(`Duplicate or invalid ${category} ID '${id}'`);
  ids.add(id);
}
function validId2(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
}
function validVersion(value) {
  return /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(value);
}
function safeAsset(value) {
  return value.length <= 512 && !MODULE_SCHEMES.test(value) && !/[<>\s]/.test(value) && !value.toLowerCase().startsWith("data:");
}
function isRecord11(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function collectionId(value) {
  const record3 = value;
  const metadata = record3.metadata;
  return String(record3.id ?? metadata?.id ?? "");
}
function hashCanonicalJson(value) {
  const text = JSON.stringify(value);
  let high = 3421674724, low = 2216829733;
  for (const byte of new TextEncoder().encode(text)) {
    low ^= byte;
    const oldLow = low;
    low = Math.imul(low, 435);
    high = Math.imul(high, 435) + Math.imul(oldLow >>> 0, 16777216) | 0;
  }
  return `${(high >>> 0).toString(16).padStart(8, "0")}${(low >>> 0).toString(16).padStart(8, "0")}`;
}
function createPlayer(input = {}) {
  if (input.id !== undefined && (typeof input.id !== "string" || input.id.trim().length === 0)) {
    throw new Error("Player ID must be a non-empty string");
  }
  if (input.teamNr !== undefined) {
    if (!Number.isSafeInteger(input.teamNr) || input.teamNr < 0) {
      throw new Error("Player teamNr must be a non-negative integer");
    }
  }
  if (input.position !== undefined) {
    if (!Number.isFinite(input.position.x) || !Number.isFinite(input.position.y)) {
      throw new Error("Player position must contain finite numbers");
    }
  }
  if (input.velocity !== undefined) {
    if (!Number.isFinite(input.velocity.x) || !Number.isFinite(input.velocity.y)) {
      throw new Error("Player velocity must contain finite numbers");
    }
  }
  const radius = input.radius ?? input.size;
  if (radius !== undefined) {
    if (!Number.isFinite(radius) || radius <= 0) {
      throw new Error("Player radius must be a finite positive number");
    }
  }
  if (input.mass !== undefined) {
    if (!Number.isFinite(input.mass) || input.mass <= 0) {
      throw new Error("Player mass must be a finite positive number");
    }
  }
  if (input.hp !== undefined && !Number.isFinite(input.hp)) {
    throw new Error("Player hp must be a finite number");
  }
  const team = input.teamNr !== undefined ? [input.teamNr] : input.team ? [...input.team] : undefined;
  return createPlayerSettings({
    ...input.id !== undefined ? { id: input.id } : {},
    ...team !== undefined ? { team } : {},
    ...input.position !== undefined ? { position: { x: input.position.x, y: input.position.y } } : {},
    ...input.velocity !== undefined ? { velocity: { x: input.velocity.x, y: input.velocity.y } } : {},
    ...input.rotation !== undefined ? { rotation: input.rotation } : {},
    ...input.angularVelocity !== undefined ? { angularVelocity: input.angularVelocity } : {},
    ...input.hp !== undefined ? { hp: input.hp } : {},
    ...input.bouncyness !== undefined ? { bouncyness: input.bouncyness } : {},
    ...input.mass !== undefined ? { mass: input.mass } : {},
    ...radius !== undefined ? { size: radius } : {},
    ...input.friction !== undefined ? { friction: input.friction } : {},
    ...input.color !== undefined ? { color: input.color } : {},
    ...input.playericon !== undefined ? { playericon: input.playericon } : {},
    ...input.hoop !== undefined ? { hoop: input.hoop } : {},
    ...input.isPhysicsEnabled !== undefined ? { isPhysicsEnabled: input.isPhysicsEnabled } : {},
    ...input.isDead !== undefined ? { isDead: input.isDead } : {},
    ...input.effects !== undefined ? { effects: input.effects.map((e) => ({ ...e })) } : {},
    ...input.inventory !== undefined ? { inventory: input.inventory.map((i) => ({ ...i })) } : {}
  });
}

class TeamBuilder {
  settings;
  constructor(settings) {
    this.settings = settings;
    if (!Number.isSafeInteger(settings.teamNr) || settings.teamNr < 0)
      throw new Error("A team number must be a non-negative integer");
    if (settings.playerCount !== undefined && (!Number.isSafeInteger(settings.playerCount) || settings.playerCount < 1))
      throw new Error("A team playerCount must be a positive integer");
  }
  toSettings() {
    return { ...this.settings };
  }
}

class KoreMapBuilder {
  options;
  world;
  teams = new Map;
  spawns = [];
  worldEffects = [];
  structures = [];
  generatedHazardStructureIndexes = new Set;
  hazards = [];
  environmentalMechanics = [];
  items = [];
  itemEconomy = { fixedLoadouts: [], mapPickups: [] };
  background = { type: "color", color: "#dff6ff" };
  built;
  constructor(options) {
    this.options = options;
    this.world = engine.createWorld({ id: options.id, worldSize: options.worldSize });
    this.world.setBackground(toJson(this.background));
    const containment = { type: 2 /* RECTANGLE */, x: 0, y: 0, w: options.worldSize.x, h: options.worldSize.y, role: "containment", effects: [] };
    this.structures.push(containment);
    this.world.addStructure(toJson(containment));
  }
  addBackground(background) {
    if (background.type === "color")
      this.background = { type: "color", color: background.color };
    else if (background.type === "asset")
      this.background = { type: "image", url: background.asset };
    else {
      validateImageUrl(background.url);
      this.background = { type: "image", url: background.url };
    }
    this.world.setBackground(toJson(this.background));
    this.built = undefined;
    return this;
  }
  addTeam(team) {
    const settings = "toSettings" in team ? team.toSettings() : { ...team };
    if (!Number.isSafeInteger(settings.teamNr) || settings.teamNr < 0)
      throw new Error("A team number must be a non-negative integer");
    if (this.teams.has(settings.teamNr))
      throw new Error(`Team ${settings.teamNr} is already registered`);
    this.teams.set(settings.teamNr, settings);
    this.built = undefined;
    return this;
  }
  addPlayerSpawn(spawn) {
    const teamSettings = spawn.team ? "toSettings" in spawn.team ? spawn.team.toSettings() : spawn.team : undefined;
    const teamNr = spawn.teamNr ?? teamSettings?.teamNr;
    if (teamNr === undefined || !Number.isSafeInteger(teamNr) || teamNr < 0)
      throw new Error("A spawn requires teamNr or team");
    if (teamSettings && !this.teams.has(teamNr))
      this.addTeam(teamSettings);
    const playerCount = spawn.playerCount ?? this.teams.get(teamNr)?.playerCount;
    if (playerCount === undefined || !Number.isSafeInteger(playerCount) || playerCount < 1)
      throw new Error("A spawn requires a positive playerCount or a team playerCount");
    if (![spawn.x, spawn.y, spawn.w, spawn.h].every(Number.isFinite) || spawn.w <= 0 || spawn.h <= 0)
      throw new Error("Spawn bounds must be finite and positive");
    this.spawns.push({ ...spawn, teamNr, playerCount });
    if (!this.teams.has(teamNr))
      this.addTeam({ teamNr, playerCount });
    this.built = undefined;
    return this;
  }
  addWorldEffects(input, trigger = "EffectTrigger.Always" /* Always */) {
    const source = Array.isArray(input) ? { effects: input, trigger } : input;
    for (const effect of source.effects) {
      const settings = toFullEffectSettings(effect, source.trigger ?? "EffectTrigger.Always" /* Always */, source.triggerValue ?? []);
      this.worldEffects.push(settings);
      this.world.addEffect(toJson(settings));
    }
    this.built = undefined;
    return this;
  }
  addStructure(structure) {
    const settings = "toSettings" in structure ? structure.toSettings() : structure;
    this.structures.push(clone8(settings));
    this.world.addStructure(toJson(settings));
    this.built = undefined;
    return this;
  }
  addRectangle(settings) {
    return this.addStructure({ type: 2 /* RECTANGLE */, ...settings, effects: (settings.effects ?? []).map((effect) => toFullEffectSettings(effect, "EffectTrigger.Collision" /* Collision */, [])) });
  }
  addCircle(settings) {
    return this.addStructure({ type: 0 /* CIRCLE */, ...settings, effects: (settings.effects ?? []).map((effect) => toFullEffectSettings(effect, "EffectTrigger.Collision" /* Collision */, [])) });
  }
  addKillZone(settings) {
    this.assertHazardZone(settings);
    this.hazards.push({ schemaVersion: DOCUMENT_SCHEMA_VERSION, id: settings.id, type: "kill-zone", trigger: { type: "collision" }, config: { x: settings.x, y: settings.y, r: settings.r } });
    const structureIndex = this.structures.length;
    this.addCircle({ x: settings.x, y: settings.y, r: settings.r, color: settings.color ?? "#d94b28", effects: [kore.effects.modifySetting({ operation: "set" /* Set */, key: "dead", value: true })] });
    this.generatedHazardStructureIndexes.add(structureIndex);
    return this;
  }
  addForceZone(settings) {
    this.assertHazardZone(settings);
    if (!Number.isFinite(settings.angle) || settings.angle < 0 || settings.angle >= 360 || !Number.isFinite(settings.power) || settings.power <= 0)
      throw new Error("Force hazard requires an angle in [0, 360) and positive power");
    const radians = settings.angle * Math.PI / 180;
    this.hazards.push({ schemaVersion: DOCUMENT_SCHEMA_VERSION, id: settings.id, type: "force", trigger: { type: "collision" }, config: { x: settings.x, y: settings.y, r: settings.r, angle: settings.angle, power: settings.power } });
    const structureIndex = this.structures.length;
    this.addCircle({ x: settings.x, y: settings.y, r: settings.r, color: settings.color ?? "#f0a020", effects: [kore.effects.modifySetting({ operation: "add" /* Add */, key: "velocity", value: { x: Math.cos(radians) * settings.power, y: Math.sin(radians) * settings.power } })] });
    this.generatedHazardStructureIndexes.add(structureIndex);
    return this;
  }
  addTimedHazard(settings) {
    return this.addEnvironmental({ ...settings, schemaVersion: 1, type: "timed-hazard" });
  }
  addTriggeredZone(settings) {
    return this.addEnvironmental({ ...settings, schemaVersion: 1, type: "triggered-zone" });
  }
  addForceField(settings) {
    return this.addEnvironmental({ ...settings, schemaVersion: 1, type: "force-field" });
  }
  addMovingStructure(settings) {
    return this.addEnvironmental({ ...settings, schemaVersion: 1, type: "moving-structure" });
  }
  addEnvironmentalCycle(settings) {
    return this.addEnvironmental({ ...settings, schemaVersion: 1, type: "environmental-cycle" });
  }
  addEnvironmental(mechanic) {
    validateEnvironmentalMechanics([mechanic]);
    if (this.environmentalMechanics.some((candidate) => candidate.id === mechanic.id))
      throw new Error(`Environmental mechanic ${mechanic.id} is already registered`);
    this.environmentalMechanics.push(clone8(mechanic));
    const structureIndex = this.structures.length;
    this.addStructure({ ...clone8(mechanic.structure), effects: clone8(mechanic.effects ?? mechanic.structure.effects) });
    this.generatedHazardStructureIndexes.add(structureIndex);
    this.built = undefined;
    return this;
  }
  addItem(item) {
    const validated = createItem(item);
    if (this.items.some((candidate) => candidate.id === validated.id))
      throw new Error(`Item ${validated.id} is already registered`);
    this.items.push(validated);
    this.built = undefined;
    return this;
  }
  addFixedLoadout(loadout) {
    if (!Number.isSafeInteger(loadout.team) || loadout.team < 0 || !Array.isArray(loadout.items) || loadout.items.length === 0)
      throw new Error("Fixed loadouts require a non-negative team and items");
    if (this.itemEconomy.fixedLoadouts.some((candidate) => candidate.team === loadout.team))
      throw new Error(`Team ${loadout.team} already has an item loadout`);
    if (loadout.items.some((item) => !Number.isSafeInteger(item.uses) || item.uses < 1 || typeof item.itemId !== "string" || item.itemId.length === 0))
      throw new Error("Fixed loadout items require an ID and positive use count");
    this.itemEconomy.fixedLoadouts.push(clone8(loadout));
    this.built = undefined;
    return this;
  }
  addItemPickup(pickup) {
    validateItemPickup(pickup);
    this.itemEconomy.mapPickups.push(clone8(pickup));
    this.built = undefined;
    return this;
  }
  setSeededItemDraw(draw) {
    if (!Number.isSafeInteger(draw.seed) || !Array.isArray(draw.itemIds) || draw.itemIds.length === 0 || draw.itemIds.some((id) => typeof id !== "string" || id.length === 0) || !Number.isSafeInteger(draw.drawsPerTurn) || draw.drawsPerTurn < 1)
      throw new Error("Seeded item draws require a safe seed, item IDs, and positive draws per turn");
    this.itemEconomy.randomDraw = clone8(draw);
    this.built = undefined;
    return this;
  }
  setMysteryBox(settings) {
    if (!Array.isArray(settings.candidatePool) || settings.candidatePool.length === 0 || settings.candidatePool.some((id) => typeof id !== "string" || id.length === 0))
      throw new Error("Mystery box rewards require a non-empty candidate pool");
    this.itemEconomy.mysteryBox = clone8(settings);
    this.built = undefined;
    return this;
  }
  build() {
    if (this.built)
      return clone8(this.built);
    const genericWorld = this.world.build();
    const spawns = this.spawns.map((spawn) => ({ team: spawn.teamNr, x: spawn.x, y: spawn.y, w: spawn.w, h: spawn.h }));
    const canonical = this.buildMapDocumentFrom(spawns);
    validateMapDocument(canonical);
    const teamNumbers = [...new Set(this.spawns.map((spawn) => spawn.teamNr))].sort((a, b) => a - b);
    if (teamNumbers.length < 2 || teamNumbers.length > 2)
      throw new Error("SDK maps currently require exactly two teams");
    if (teamNumbers[0] !== 0 || teamNumbers[1] !== 1)
      throw new Error("SDK maps currently require team numbers 0 and 1");
    const figuresPerTeam = teamNumbers.map((team) => this.spawns.filter((spawn) => spawn.teamNr === team).reduce((sum, spawn) => sum + spawn.playerCount, 0));
    if (figuresPerTeam[0] !== figuresPerTeam[1])
      throw new Error("SDK maps require the same figure count for both teams");
    const template = createDefaultGameSettings(2, 1);
    const players = this.createPlayers(template.players, teamNumbers);
    this.validateItemReferences();
    const settings = {
      ...template,
      id: this.options.id,
      screenResolution: clone8(this.options.worldSize),
      worldSize: clone8(this.options.worldSize),
      background: clone8(genericWorld.background),
      friction: clone8(this.options.friction),
      drift: this.options.drift,
      players,
      environmentalMechanics: clone8(this.environmentalMechanics),
      items: clone8(this.items),
      mapBoundarys: clone8(genericWorld.structures),
      effects: clone8(genericWorld.effects),
      ...this.hasItemEconomy() ? {
        gameMode: {
          id: `${this.options.id}-mode`,
          phases: ["item" /* Item */, "aim" /* Aim */, "charge" /* Charge */, "push" /* Push */, "physics" /* Physics */],
          maxItemsPerTurn: 1,
          winCondition: "last-team-standing" /* LastTeamStanding */,
          itemEconomy: clone8(this.itemEconomy)
        }
      } : {},
      allTeams: teamNumbers.map((team) => this.teams.get(team)?.name ?? `Team ${team + 1}`),
      myTeam: [],
      allTeamSize: teamNumbers.length,
      playerCount: teamNumbers.length,
      figuresPerPlayer: figuresPerTeam[0],
      minPlayers: teamNumbers.length,
      maxPlayers: teamNumbers.length
    };
    validateGameSettings(settings);
    this.built = clone8(settings);
    return clone8(this.built);
  }
  buildMapDocument() {
    return this.buildMapDocumentFrom(this.spawns.map((spawn) => ({ team: spawn.teamNr, x: spawn.x, y: spawn.y, w: spawn.w, h: spawn.h })));
  }
  buildJson(space = 2) {
    return JSON.stringify(this.build(), null, space);
  }
  buildMapDocumentFrom(spawnRegions) {
    const genericWorld = this.world.build();
    const metadata = { id: this.options.id, name: this.options.name, ...this.options.description ? { description: this.options.description } : {} };
    return {
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      metadata,
      worldSize: clone8(genericWorld.worldSize),
      friction: clone8(this.options.friction),
      drift: this.options.drift,
      arenaGeometry: clone8(genericWorld.structures.filter((_, index) => !this.generatedHazardStructureIndexes.has(index))),
      spawnRegions: spawnRegions.map(clone8),
      hazards: clone8(this.hazards),
      environmentalMechanics: clone8(this.environmentalMechanics)
    };
  }
  assertHazardZone(settings) {
    if (typeof settings.id !== "string" || settings.id.trim().length === 0)
      throw new Error("Hazard ID must be a non-empty string");
    if (![settings.x, settings.y, settings.r].every(Number.isFinite) || settings.r <= 0)
      throw new Error("Hazard zone requires finite coordinates and a positive radius");
    if (this.hazards.some((hazard) => hazard.id === settings.id))
      throw new Error(`Hazard ${settings.id} is already registered`);
  }
  hasItemEconomy() {
    return this.items.length > 0 || this.itemEconomy.fixedLoadouts.length > 0 || this.itemEconomy.mapPickups.length > 0 || this.itemEconomy.randomDraw !== undefined || this.itemEconomy.mysteryBox !== undefined;
  }
  validateItemReferences() {
    if (!this.hasItemEconomy())
      return;
    validateItemEconomySettings(this.itemEconomy);
    const known = new Set(this.items.map((item) => item.id));
    const references = [
      ...this.itemEconomy.fixedLoadouts.flatMap((loadout) => loadout.items.map((item) => item.itemId)),
      ...this.itemEconomy.mapPickups.map((pickup) => pickup.itemId),
      ...this.itemEconomy.randomDraw?.itemIds ?? [],
      ...this.itemEconomy.mysteryBox?.candidatePool ?? []
    ];
    if (references.some((itemId) => !known.has(itemId)))
      throw new Error("Item economy references an unknown item");
  }
  createPlayers(templates, teams) {
    const players = [];
    for (const team of teams) {
      const teamTemplate = templates.find((player) => player.team.includes(team));
      let playerIndex = 0;
      for (const spawn of this.spawns.filter((candidate) => candidate.teamNr === team)) {
        const spawned = Array.from({ length: spawn.playerCount }, () => createPlayer({ ...teamTemplate, id: deterministicUuid(`${this.options.id}:team:${team}:player:${playerIndex++}`), teamNr: team, color: this.teams.get(team)?.color ?? teamTemplate.color }));
        arrangePlayers(spawned, spawn);
        players.push(...spawned);
      }
    }
    return players;
  }
}
function arrangePlayers(players, region) {
  const diameter = players[0].size * 2;
  const columns = Math.max(1, Math.floor(region.w / (diameter + 1)));
  if (columns * Math.max(1, Math.floor(region.h / (diameter + 1))) < players.length)
    throw new Error("Spawn region is too small for its playerCount");
  players.forEach((player, index) => {
    player.position = { x: region.x + diameter / 2 + index % columns * (diameter + 1), y: region.y + diameter / 2 + Math.floor(index / columns) * (diameter + 1) };
  });
}
function toFullEffectSettings(input, trigger, triggerValue) {
  const settings = "toSettings" in input ? input.toSettings() : input;
  if (isFullEffectSettings(settings))
    return clone8(settings);
  return { ...clone8(settings), trigger, triggerValue: clone8(triggerValue) };
}
function isFullEffectSettings(settings) {
  return "trigger" in settings && "triggerValue" in settings;
}
function validateImageUrl(value) {
  try {
    const url = new URL(value, "https://kore.invalid");
    if (url.protocol !== "http:" && url.protocol !== "https:")
      throw new Error;
  } catch {
    throw new Error("Background URLs must use http(s) or be same-origin paths");
  }
}
function clone8(value) {
  return structuredClone(value);
}
function toJson(value) {
  return JSON.parse(JSON.stringify(value));
}
function deterministicUuid(value) {
  let hash = 2166136261;
  for (let index = 0;index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (offset) => {
    let result = "";
    for (let index = 0;index < 8; index++) {
      hash ^= (offset + index) * 2654435769;
      hash = Math.imul(hash, 16777619);
      result += (hash >>> 0).toString(16).padStart(8, "0").slice(-2);
    }
    return result.slice(0, 8);
  };
  const raw = `${hex(0)}${hex(8)}${hex(16)}${hex(24)}${hex(32)}${hex(40)}`.slice(0, 32).split("");
  raw[12] = "4";
  raw[16] = (parseInt(raw[16], 16) & 3 | 8).toString(16);
  return `${raw.slice(0, 8).join("")}-${raw.slice(8, 12).join("")}-${raw.slice(12, 16).join("")}-${raw.slice(16, 20).join("")}-${raw.slice(20).join("")}`;
}
function stableAuthoringHash(value) {
  const serialized = JSON.stringify(value, (_key, entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry);
  let hash = 2166136261;
  for (const character of serialized) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function createDefaultKoreFramework() {
  const registry = new EngineSystemRegistry().register({ id: "core.movement", provides: ["movement.state"], acceptsEffects: ["movement.integrate"], before: ["core.playback"] }).register({ id: "core.playback", provides: ["playback"] }).register({ id: "core.physics", provides: ["physics"], after: ["core.playback"] }).register({ id: "core.boundary", requires: ["physics"], after: ["core.physics"] }).register({ id: "core.game-state-manager", after: ["core.boundary"] });
  return registry.select(["core.movement", "core.playback", "core.physics", "core.boundary", "core.game-state-manager"]);
}
var kore = {
  engine: { createWorld: engine.createWorld, createSystemRegistry: engine.createSystemRegistry },
  ui,
  createTeam(settings) {
    return new TeamBuilder(settings);
  },
  createPlayer(input = {}) {
    return createPlayer(input);
  },
  createItem(input) {
    return createItem(input);
  },
  composeItemEffects(...effects) {
    return composeItemEffects(...effects);
  },
  itemRuntime: { create: createRuntimeItemEffect, resolve: resolveRuntimeItemEffects, applyForce: applyRuntimeForceEffects },
  createDefaultMap(options = {}) {
    const worldSize = options.worldSize ?? { x: 800, y: 450 };
    const name = options.name ?? "Untitled KORE Map";
    const description = options.description ?? "";
    const friction2 = clone8(options.friction ?? FRICTION_TABLE.ice);
    const id = options.id ?? `kore-map-${stableAuthoringHash({ name, description, worldSize, friction: friction2, drift: options.drift ?? 0 })}`;
    return new KoreMapBuilder({ id, name, description, worldSize: clone8(worldSize), friction: friction2, drift: options.drift ?? 0 });
  },
  validate(settings) {
    validateGameSettings(settings);
  },
  createHandler(settings) {
    validateGameSettings(settings);
    return createRuntimeHandler(settings);
  },
  restoreHandler(settings) {
    validateGameSettings(settings);
    return createRuntimeHandler(settings);
  },
  createDefaultFramework() {
    return createDefaultKoreFramework();
  },
  audio: koreAudio,
  ai: koreAi,
  contentPackage: { validate: validateContentPackage, load: loadContentPackage, canonicalize: canonicalizeContentPackage, hash: hashContentPackage, resolveMap: resolveMapDocument },
  createGameMode,
  gameModes: { schemaVersion: GAME_MODE_CATALOG_SCHEMA_VERSION, list: getSelectableGameModes, get: getGameModeCatalogEntry },
  createMatchSystemProfile,
  authorMatchSettings,
  createMatchDefinition,
  validateMatchDefinition: validateKoreMatchDefinition,
  createRuntimeMatch,
  effects: {
    move(values) {
      return new EffectMove({ typeValue: values });
    },
    physics(values) {
      return new EffectPhysics({ typeValue: values });
    },
    damage(damage) {
      if (!Number.isFinite(damage) || damage < 0)
        throw new Error("Damage must be a non-negative finite number");
      return new EffectDamage({ typeValue: { damage } });
    },
    mass(mass) {
      if (!Number.isFinite(mass) || mass <= 0)
        throw new Error("Mass must be a finite positive number");
      return new EffectModifyMass({ typeValue: { mass } });
    },
    size(size) {
      if (!Number.isFinite(size) || size <= 0)
        throw new Error("Size must be a finite positive number");
      return { type: "EffectType.ModifySize" /* ModifySize */, typeValue: { size } };
    },
    position(position) {
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y))
        throw new Error("Position coordinates must be finite numbers");
      return { type: "EffectType.Position" /* Position */, typeValue: { ...position } };
    },
    velocity(velocity) {
      if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y))
        throw new Error("Velocity components must be finite numbers");
      return { type: "EffectType.Velocity" /* Velocity */, typeValue: { ...velocity } };
    },
    team(team) {
      return { type: "EffectType.Team" /* Team */, typeValue: { team: [...team] } };
    },
    modifySetting(values) {
      return new EffectModifySetting({ typeValue: values });
    },
    multi(...effects) {
      return new MultiEffect({ type: "EffectType.Multi" /* Multi */, typeValue: effects.map((effect) => ("toSettings" in effect) ? effect.toSettings() : effect) });
    },
    itemEffect(type, typeValue = {}) {
      return { type, typeValue: clone8(typeValue) };
    },
    shield(capacity) {
      if (!Number.isFinite(capacity) || capacity <= 0)
        throw new Error("Shield capacity must be a positive number");
      return { type: "shield" /* Shield */, typeValue: { capacity } };
    },
    freeze(durationTurns = 1) {
      if (!Number.isInteger(durationTurns) || durationTurns <= 0)
        throw new Error("Freeze durationTurns must be a positive integer");
      return { type: "freeze" /* Freeze */, typeValue: { durationTurns } };
    },
    magnet(strength, range2) {
      if (!Number.isFinite(strength) || !Number.isFinite(range2) || range2 <= 0)
        throw new Error("Magnet parameters must be finite numbers with positive range");
      return { type: "magnet" /* Magnet */, typeValue: { strength, range: range2 } };
    },
    temporaryWall(lifetimeTurns = 1) {
      if (!Number.isInteger(lifetimeTurns) || lifetimeTurns <= 0)
        throw new Error("Temporary wall lifetimeTurns must be a positive integer");
      return { type: "temporaryWall" /* TemporaryWall */, typeValue: { lifetimeTurns } };
    },
    ghostMode(durationTurns = 1) {
      if (!Number.isInteger(durationTurns) || durationTurns <= 0)
        throw new Error("Ghost mode durationTurns must be a positive integer");
      return { type: "ghostMode" /* GhostMode */, typeValue: { durationTurns } };
    },
    modifyForce(multiplier) {
      if (!Number.isFinite(multiplier) || multiplier <= 0)
        throw new Error("Modify force multiplier must be a positive finite number");
      return { type: "modifyForce" /* ModifyForce */, typeValue: { multiplier } };
    },
    modifyRotation(angle) {
      if (!Number.isFinite(angle))
        throw new Error("Modify rotation angle must be a finite number");
      return { type: "modifyRotation" /* ModifyRotation */, typeValue: { angle } };
    },
    applyTorque(torque) {
      if (!Number.isFinite(torque))
        throw new Error("Torque must be a finite number");
      return { type: "applyTorque" /* ApplyTorque */, typeValue: { torque } };
    },
    delayedEffect(delayTicks, effect) {
      if (!Number.isInteger(delayTicks) || delayTicks < 0)
        throw new Error("Delay ticks must be a non-negative integer");
      return { type: "delayedEffect" /* DelayedEffect */, typeValue: { delayTicks, effect: clone8(effect) } };
    },
    spawnTrigger(delayTicks, triggerType) {
      if (!Number.isInteger(delayTicks) || delayTicks < 0)
        throw new Error("Delay ticks must be a non-negative integer");
      return { type: "spawnTrigger" /* SpawnTrigger */, typeValue: { delayTicks, triggerType } };
    }
  },
  types: {
    gameState: { yourTurn: "GameState.Your_turn" /* Your_turn */, gameOver: "GameState.Game_over" /* Game_over */ },
    rulePhase: { item: "item" /* Item */, aim: "aim" /* Aim */, charge: "charge" /* Charge */, push: "push" /* Push */, physics: "physics" /* Physics */, complete: "complete" /* Complete */ },
    winCondition: { lastTeamStanding: "last-team-standing" /* LastTeamStanding */ },
    shape: { circle: 0 /* CIRCLE */, rectangle: 2 /* RECTANGLE */, line: 1 /* LINE */ },
    effectType: { physics: "EffectType.Physics" /* Physics */, movement: "EffectType.Movement" /* Movement */, damage: "EffectType.Damage" /* Damage */, multi: "EffectType.Multi" /* Multi */, modifySetting: "EffectType.ModifySetting" /* ModifySetting */ },
    itemEffectType: {
      modifyForce: "modifyForce" /* ModifyForce */,
      modifyRotation: "modifyRotation" /* ModifyRotation */,
      lockRotation: "lockRotation" /* LockRotation */,
      applyTorque: "applyTorque" /* ApplyTorque */,
      spawnTrigger: "spawnTrigger" /* SpawnTrigger */,
      delayedEffect: "delayedEffect" /* DelayedEffect */,
      shield: "shield" /* Shield */,
      freeze: "freeze" /* Freeze */,
      swapPosition: "swapPosition" /* SwapPosition */,
      temporaryWall: "temporaryWall" /* TemporaryWall */,
      ghostMode: "ghostMode" /* GhostMode */,
      magnet: "magnet" /* Magnet */,
      selectionLock: "selectionLock" /* SelectionLock */,
      aimVariance: "aimVariance" /* AimVariance */
    },
    effectTrigger: { always: "EffectTrigger.Always" /* Always */, collision: "EffectTrigger.Collision" /* Collision */, round: "EffectTrigger.Round" /* Round */ },
    friction: FRICTION_TABLE
  }
};
export {
  resolveRuntimeItemEffects,
  kore,
  createRuntimeItemEffect,
  createPlayer,
  createItem,
  createDefaultKoreFramework,
  composeItemEffects,
  applyRuntimeForceEffects,
  KoreMapBuilder
};
