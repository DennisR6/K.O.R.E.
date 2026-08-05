# Task: Migrate Effect Creation and Configuration from Legacy System to the New SDK

Implement a staged migration of the KORE effect domain from direct legacy construction to the new SDK architecture.

The migration must be incremental, test-driven, reversible during development, and must preserve current gameplay behavior, serialization, determinism, replay compatibility, save/load behavior, AI behavior, networking, rendering, and browser integration.

---

# Primary objective

Replace direct production usage such as:

```ts
new MetaEffect(effectSettings)
```

or manual setting assembly with a stable SDK-facing API:

```ts
const effect = kore.effects.damage(25);
const shieldEffect = kore.effects.shield({ capacity: 50 });
```

Runtime effect construction should happen through a dedicated KORE runtime factory:

```ts
const runtimeEffect = createRuntimeEffect(effectSettings);
```

The public authoring SDK must not return mutable runtime `Effect` class instances, but detached, JSON-safe `EffectSettings` or `FullEffectSettings`.

---

# Architectural target

Preserve this dependency direction:

```text
Canonical generic effect contracts
        ↓
Generic Engine SDK effect capabilities
        ↓
KORE Effect SDK authoring (`kore.effects.*`)
        ↓
Canonical KORE EffectSettings / FullEffectSettings
        ↓
KORE runtime effect factory (`createRuntimeEffect`)
        ↓
Legacy Effect runtime implementations
```

---

# Layer responsibilities

## Generic Engine SDK

Defines generic effect interfaces and JSON-safe data structures. It must not contain KORE-specific team or HUD rules.

## KORE SDK (`kore.effects`)

Owns authoring helpers for all KORE game and item effects, default values, structural validation, and JSON serialization.

## KORE runtime layer

Owns execution of effects on entities (`apply()`), state mutation during ticks/collisions, and serialization back to settings via `toSettings()`.

---

# Migration execution checklist

## Audit

* [x] Map every effect construction path across the repository.
* [x] Identify all 10 core `EffectType` values and 14 `ItemEffectType` values.
* [x] Verify existing `MetaEffect` deserialization.

## SDK foundation

* [x] Confirm canonical `EffectSettings` and `FullEffectSettings` contracts.
* [x] Add SDK authoring functions under `kore.effects.*` for all core and item effect types.
* [x] Add input validation (finite numbers, non-negative values, non-empty IDs).
* [x] Ensure all SDK effect builders emit JSON-safe, detached data objects.

## Runtime boundary

* [x] Add authoritative `createRuntimeEffect(settings)` factory in `src/effects/runtimeFactory.ts`.
* [x] Route runtime effect instantiations through `createRuntimeEffect`.
* [x] Ensure runtime objects reproduce identical settings via `toSettings()`.

## Integration & Parity

* [x] Add unit tests for all SDK effect helpers in `tests/effect_sdk_migration.test.ts`.
* [x] Add parity tests comparing SDK settings to legacy constructors.
* [x] Re-export effect authoring APIs through `src/kore/sdk/index.ts` and `src/kore_sdk.ts`.
* [x] Update `AGENTS.md` with runtime effect factory documentation.
