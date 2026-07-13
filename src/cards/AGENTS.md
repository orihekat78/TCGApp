# Card Instructions

## Grounding

- Read root `AGENTS.md`, then `.claude/rules/INDEX.md` and exact topics.
- Before grounding, run `npm run ground -- <ID>...`.
- Read the generated dossier under `.tmp/_ground/`.
- Match every printed-text clause to DSL or an explicit deferred blocker.
- Persist grounding at `.claude/specs/grounding/<ID>.md`.
- Never infer card behavior missing from rules or official text.

## Authoring

- Prefer Effect Descriptor DSL. Custom TypeScript is last resort.
- Keep descriptors JSON serializable.
- Use existing shipped exemplars only after semantic equivalence is proven.
- Reuse families through `src/cards/_shared/`; never reference another card.
- Add a rules-reference comment at the top of each card file.
- More than three touched files for one card requires design reconsideration.
- Use `card-wave` for batches and certification pipelines.

## Engine Boundary

- Card effects do not justify engine skeleton edits.
- If capability is absent, defer the card or run an approved `engine-wave`.
- Patterns appearing on three or more cards still remain card-shared classes.
- Shared classes are additive and non-breaking.

## Risk And Gates

- Exact shipped clone: T1, Terra, focused probe plus project mechanical gates.
- New descriptor wiring or hook consumer: T2, Terra high plus two review lenses.
- Engine/core dependency: T3 and follow engine instructions.
- Run the card-addition checklist at
  `.claude/specs/card-addition-checklist.md`.
- Verify kind branches, hook listeners, resolver dispatch, UI, and AI paths.
- Run automated smoke at required scale; target is 1000 games for additions.

## Semantic Checks

- Test zero candidates, exact-N, optional decline, owner/opponent orientation,
  refresh, disguise inheritance, contact expiry, and simultaneous effects.
- Family exemplar UI verification must include valid and decoy targets.
- Clone spread may use deterministic decision-table diff instead of duplicate
  Playwright runs.
- A green probe does not prove printed-text equivalence.

## Completion

- Investigate every card and shared class with the same structural pattern.
- Create or update BUG records for confirmed defects.
- Record grounding, tests, review, and horizontal findings in memory.
