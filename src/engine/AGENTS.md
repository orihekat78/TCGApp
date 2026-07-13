# Engine Instructions

## Authority

- Read root `AGENTS.md` first.
- Read `.claude/rules/INDEX.md` and exact rule topics before rule decisions.
- Engine behavior must match official rules; unknown rules stay unknown.

## Skeleton Freeze

- Engine edits are exceptional.
- Allowed: official rule change, engine bug fix, behavior-preserving performance
  work, or an approved additive primitive.
- Do not change engine merely to implement one card effect.
- Card-family reuse belongs under `src/cards/_shared/`.
- State mutation must use established engine APIs and Immer paths.
- Preserve JSON-serializable Effect Descriptor DSL.

## Risk

- Engine core, resolver, flow hot path, event ordering, or GameState shape is T3.
- Additive isolated primitive with an exemplar is at least T2.
- Use `engine-wave` for planned engine extension waves.
- Main T3 judgment: `gpt-5.6-sol`.
- Implementation: `gpt-5.6-terra`.
- Mechanical collection: `gpt-5.6-luna`.

## Required Evidence

- Write a failing probe before behavior changes.
- Run typecheck, focused tests, full Vitest baseline, required lint, and smoke.
- Verify every new union member reaches reader, writer, resolver, UI, and AI
  consumers where applicable.
- Review event payload attribution, owner/opponent orientation, optional
  decisions, zero-card states, refresh, and re-entry.
- For GameState changes, map every field update and UI consumer.
- Use Playwright for T3 UI-visible behavior and full-match regression.

## Review

- T2: semantic and edge-test review.
- T3: adversarial semantic, flow, state, and UI lenses plus Sol verdict.
- Review agents consume main-loop test evidence; do not rerun broad suites.
- Fix confirmed Critical and Important findings before proceeding.
- Investigate all structurally similar verbs, hooks, flows, and consumers.

## Boundaries

- No direct card-to-card references.
- Do not hand-edit generated API/state/flow documentation.
- New public API or state shape requires regenerated docs and drift check.
- Record bugs under `.claude/bugs/BUG-XXX.md` and findings in memory.
