# Physics Contact And Resolution Contract

Version: 1 (Section 13, Task 13.1)
Status: `defined` — clauses are implemented and qualified progressively by
Section 13 tasks; each clause below names the task that enforces it.
The authoritative implementation is `src/physics/defaultPhysics.ts`; the
interfaces live in `src/physics/physics.ts`.

## 1. Determinism Model

- The engine is frame-counted: one physics tick advances the world exactly one
  step. `dt` is implicitly `1` for movement integration.
- All arithmetic is IEEE-754 double precision in a fixed operation order.
- `Math.random` and wall-clock sources are never used inside physics, systems,
  or effects. Any randomness comes from the seeded `src/utils/random.ts`
  source.
- Equal inputs (same body states, same structure set, same iteration counts)
  must produce bit-identical results.
- Iteration order that affects results is fixed and documented (Section 9).

## 2. Coordinate System, Units, And Body Model

- Screen-space coordinates: `+x` right, `+y` down. Angles in degrees,
  clockwise from `+x` (`forwardVectorFromRotation`).
- Distance unit: one world unit (player radius is 12 by default; an 800 x 450
  arena is the reference ice map; canonical worlds may be larger).
- A body has: `position: Vector2D`, `velocity: Vector2D` (world units per
  tick), `bounds` (circle: `{x: radius, y: radius}`; rectangle: `{x: w, y: h}`;
  line: `{x: endX, y: endY}` relative endpoint), `mass`, `bounceFactor`
  (restitution), `friction`, `physicsEnabled`, and a `SHAPE`. Canonical map
  structures additionally carry stable IDs and independent `drawingEnabled`
  state; rendering never infers presentation participation from physics state.
- Circle bounds are always square (`x === y === radius`).

## 3. Mass And Immovable Bodies

- `mass === Infinity` means immovable: its inverse mass is `0` and it is never
  displaced by resolution or impulse.
- A finite mass must be strictly positive (`> 0`); inverse mass is `1 / mass`.
- Valid mass domain: finite `> 0`, or `Infinity`. Zero, negative, `NaN`, or
  negative `Infinity` mass is invalid.
- Mass-weighted displacement: for two bodies with inverse masses `iA`, `iB`,
  the shared correction is split as `moveA = total * iA / (iA + iB)` and
  `moveB = total * iB / (iA + iB)`.
- Map structures are immovable by default (`mass = Infinity`).

## 4. Restitution (Bounce)

- Valid restitution domain: finite `[0, 1]`, or `Infinity` as the neutral
  "inherit" marker used by immovable structures (`Math.min(a, Infinity) === a`).
- The effective restitution of a contact is `min(bounceA, bounceB)`.
- Restitution `0` absorbs all normal velocity; `1` reverses it (energy
  preserving within the numeric contract).
- Impulse response only applies when the bodies approach (relative normal
  velocity `< 0`); separating or resting contacts never receive an impulse.

## 5. Contact Taxonomy

Given two shapes and the computed contact geometry:

- **Separated:** minimum distance `> 0` with no overlap.
- **Touching:** distance equals the contact boundary within
  `PHYSICS_CONTACT_EPSILON` (`1e-9`); overlap is `0`.
- **Penetrating:** distance below the contact boundary; overlap `> 0`.

Detection and response agree about the boundary: detection treats touching as
a contact (inclusive `<=`), so contact effects fire; response acts only on
strict penetration (`<`), so touching bodies are never depenetrated and never
jitter.

## 6. Collision Detection Contract

- **Circle/circle:** `distSq(centers) <= (rA + rB)^2`.
- **Circle/rectangle:** squared distance from the circle center to the
  closest point of the rectangle (clamped center) `<= r^2`.
- **Circle/line:** squared distance from the center to the closest point on
  the finite segment `<= r^2`; the closest point is clamped to `[0, 1]` along
  the segment, so endpoints participate.
- **Rectangle/rectangle:** AABB overlap test (all four axis comparisons).
- Detection never allocates or mutates; it is a pure predicate.

## 7. Collision Response Contract

Response runs only for penetrating contacts (strict `<`; Section 5) and only
for shape pairs with a defined response. It performs positional correction
(depenetration) and an impulse response (velocity), in that order, using the
original positions for the impulse computation.

### 7.1 Circle / Circle

- Contact normal: from center A to center B, normalized.
- **Zero distance (`dist === 0`):** canonical fallback axis `(1, 0)` — the
  first body (argument A) is corrected toward `-X`, the second body toward
  `+X`. There is no early return and no random axis; the pair order at the
  `PhysicsSystem` boundary is entity storage order, so the resolved assignment
  is a pure function of storage order. Swapping the arguments mirrors the
  resolved state along the axis; for equal masses the unordered world state is
  identical. Equal-mass pairs split the correction symmetrically; immovable
  partners (`mass === Infinity`) stay fixed; both-immovable pairs neither move
  nor produce `NaN`/`Infinity`. *(Task 13.3)*
- Positional correction: `overlap = rA + rB - dist`; slop
  `PHYSICS_CONTACT_SLOP = 0.05` is exempt; the fraction
  `PHYSICS_CONTACT_PERCENT = 0.2` of `max(overlap - slop, 0)` is applied per
  call, split mass-weighted along the normal. The residual
  `<= slop` is intentional and stable (no oscillation: every call reduces the
  penetration deterministically).
- Impulse response: relative normal velocity `< 0` → scalar impulse
  `j = -(1 + e) * relVelN / (iA + iB)`, applied opposite the normal, mass
  weighted. Stationary, separating, and identically-moving bodies never gain
  collision energy. For zero-distance contacts the impulse uses the same
  canonical axis as the positional correction, so only approach along that
  axis triggers a response. *(Task 13.3 removes the zero-distance no-op and
  fixes the exact-center contact path; Task 13.7 validates energy.)*

### 7.2 Circle / Rectangle

- **Exterior (center outside):** normal from the closest point of the
  rectangle to the center; `overlap = r - dist`. One resolution call moves the
  circle fully out of the rectangle along the minimum translation axis
  (`overlap + 0.01` clearance), mass-weighted, without the legacy 2.0-unit
  per-call clamp. *(Task 13.2 replaces the bounded two-unit correction.)*
- **Interior (center inside):** deterministic minimum-exit selection. The
  exit axis is the nearest edge; equal-distance ties use the stable order
  **left, right, top, bottom** (left wins ties with right/top/bottom; right
  wins ties with top/bottom; top wins ties with bottom). There is no
  arbitrary negative-Y fallback. *(Task 13.2)*
- Embedded circles receive positional correction only (no reflection on the
  exit axis), so the exit is not reversed by an impulse.
- Exterior contacts additionally receive the impulse response (Section 4)
  with `MAX_COLLISION_IMPULSE = 50` as the per-contact magnitude clamp.
- Corner contacts use the same radial closest-point path: when the closest
  point lies on a corner, the normal is radial from the corner. The
  edge-to-corner normal transition is continuous; a circle centered exactly on
  a corner enters the interior solver (deterministic minimum-exit axis).
  *(Task 13.4 validates corner and transition stability.)*
- Velocity axes unrelated to the contact normal remain unchanged.

### 7.3 Circle / Line

- Closest point on the finite segment (endpoints included): projection of the
  circle center onto the start-to-end direction with the parameter clamped to
  `[0, 1]`; `t === 0` is the start endpoint, `t === 1` the end endpoint,
  `0 < t < 1` the line interior. The line is a segment, not an infinite ray.
- Normal: `normalize(circleCenter - closestPoint)`; the endpoint normal is
  radial from the endpoint.
- `distance === 0` (center exactly on the segment or an endpoint) uses the
  canonical fallback normal: the normalized left-hand perpendicular of the
  stored start-to-end direction `(-dy, dx) / length`. The sign is fixed by the
  stored direction; swapping the direction mirrors the fallback. There is no
  silent return and no arbitrary negative-Y normal. *(Task 13.4)*
- Separated (`distance > radius`) and exactly touching (`distance === radius`)
  contacts are stable no-ops: no correction, no impulse, no event.
- Penetrating (`distance < radius`, including `distance === 0`): circle is
  repositioned to `closest + normal * r` (exactly touching, full
  depenetration in one call); the next call is a no-op.
- Impulse: only while the circle approaches along the normal
  (`normalVelocity < 0`); the normal component is reflected with the combined
  restitution `min(eA, eB)` and the tangential component is preserved.
  Separating and stationary contacts never receive an impulse.
- Zero-length lines (`start === end`) are rejected at construction:
  `"Line structures must have non-zero length"`; non-finite coordinates are
  rejected as well. *(Task 13.4)*

### 7.4 Rectangle / Rectangle

- Not part of the supported response surface for gameplay bodies; a
  `console.error` diagnostic is emitted. Detection exists (AABB).

## 8. Friction, Drag, And Rest State

- Per tick: `v *= friction^dt` (exponential), then subtract `linearDrag * dt`
  from the speed, then zero the velocity when the resulting speed is below
  `stopThreshold` (or the physics system's `STOP_THRESHOLD`).
- Friction monotonically reduces speed; no term may increase speed.
- Once a body reaches the stop threshold it is exactly zeroed and stays
  stationary until a new force (impulse, effect) acts on it.
- `isStatic(entities)` is true when every entity's speed is below `0.1`.

## 9. Multi-Contact Resolution (Iteration And Order)

- Contact processing order is explicit and deterministic: entities in
  manager insertion order (an ephemeral local iteration order), entity/entity
  pairs by `(i, j)`, then entity/structure pairs by local structure iteration
  order. Persisted contact identity is independent of that order and uses the
  canonical `entity:<id>|entity:<id>` / `entity:<id>|structure:<id>` key.
  *(Task 13.5 replaces the single-pass sweep with a bounded iterative solver.)*
- The solver terminates within `MAX_CONTACT_SOLVER_ITERATIONS = 16` passes,
  each pass making measurable progress; supported penetrations are resolved
  at termination. *(Task 13.5)*
- The final state must not depend on array or map iteration order beyond the
  documented order above.

## 10. Continuous Collision Detection (High-Speed Safety)

- A moving circle may not cross a thin structure, line, hazard, or entity
  between discrete frames at supported gameplay speeds.
- Technique: swept tests with deterministic substeps (bounded substep count)
  over the per-tick displacement; each substep produces exactly one contact
  event. *(Task 13.6)*
- No frame-rate-dependent outcome; no duplicate collision events from
  substeps; no unbounded substep count.

## 11. Containment-Only Structures

- Containment-only structures (explicit `"containment"` role, or the default
  role recognized as the outer boundary) are collision-DETECTED but never
  enter solid resolution: `PhysicsSystem` skips `handleCollision` for them.
- Explicit `"solid"` and `"both"` roles always resolve as filled.
- Entities never carry roles.

## 12. Collision Effect Lifecycle

- Contact effects distinguish **entry**, **persistent contact**, and **exit**:
  entry triggers exactly once, persistent contact does not retrigger unless
  explicitly configured, separation clears the contact state, and re-entry
  may trigger again.
- CCD substeps and solver iterations never duplicate effects.
- Contact identity is per entity/structure pair (never shared between
  unrelated pairs). *(Task 13.8)*

## 13. Validity Contract

- Invalid bodies are rejected at the boundary:
  - mass: zero, negative, or non-finite (except `Infinity`),
  - radius/bounds: negative, zero (for circles), or non-finite,
  - position/velocity: non-finite,
  - restitution: finite outside `[0, 1]` (except `Infinity` inherit marker).
- `validatePhysicsBody()` encodes these rules; `isFiniteVector()` checks a
  vector.
- `handleCollision` defensively ignores contacts with non-finite input state
  (never propagates `NaN`/`Infinity` into positions or velocities).
- No collision response may produce `NaN` or `Infinity` given valid inputs.

## 14. Iteration And Frame Bounds

- A turn resolution simulates at most 1,200 frames; the match is frozen at
  `Game_over` (Section 12.8 of `step-by-step.md`).
- The multi-contact solver runs at most `MAX_CONTACT_SOLVER_ITERATIONS` passes
  (Section 9).
- `calculateStop` iterates at most 2,000 frames and breaks below
  `stopThreshold`.

## 15. Task Enforcement Matrix

| Contract clause | Enforcing task |
| --- | --- |
| Determinism, touching stability, validity helpers, containment exclusion, detection/response agreement | 13.1 |
| Complete circle/rectangle depenetration, minimum exit axis, tie order | 13.2 |
| Zero-distance circle/circle resolution | 13.3 |
| Line, endpoint, and corner stabilization; zero-length line rejection | 13.4 |
| Bounded deterministic multi-contact solver | 13.5 |
| Continuous collision detection | 13.6 |
| Energy, restitution, friction, and rest-state invariants | 13.7 |
| Contact effect entry/persist/exit lifecycle | 13.8 |
| Snapshot continuity during physics | 13.9 |
| Deterministic property fuzzing | 13.10 |
| Performance budget | 13.11 |
| Final qualification record | 13.12 |
