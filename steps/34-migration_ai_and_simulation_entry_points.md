# Milestone 34: Migration AI And Simulation Entry Points

## Status

Completed on branch `milestone-34-ai-simulation-entrypoints`.

## Delivered

- `src/kore/ai.ts` provides the stable KORE AI authoring boundary for detached,
  validated difficulty/seed/team/decision-limit profiles.
- The KORE boundary creates the selected Easy, Medium, or Hard producer and the
  shared `AiTurnEmitter`, preserving the existing input validation path.
- Human-vs-AI and KI-vs-KI match composition now creates AI settings through
  `kore.ai` instead of assembling legacy profiles directly.
- AI systems consume the KORE producer/emitter boundary while retaining their
  serializable system settings and runtime-only handler/input adapters.
- Existing bounded Hard AI simulation, deterministic seeded decisions, and
  headless match behavior remain unchanged.

## Evidence

- `tests/kore_ai_sdk.test.ts`
- `tests/ai_settings.test.ts`
- `tests/ai_emitter.test.ts`
- `tests/easy_ai.test.ts`
- `tests/medium_ai.test.ts`
- `tests/hard_ai.test.ts`
- `tests/versus_ai.test.ts`
- `tests/ai_battle_match.test.ts`
- `tests/ai_battle_seed_variation.test.ts`
- `tests/ai_match_fuzz.test.ts`
- Focused SDK/fuzz verification passed 5 tests and 157 assertions.
- AI regression verification passed 25 tests and 240,094 assertions.
- TypeScript verification: `npx tsc --noEmit` passed.
