# Mobile, Surrender, and Full Rules Certification Design

## Goal

Deliver the approved mobile landscape experience and surrender flow, then
certify the complete official card/rules surface without guessing absent rules.
All implementation work lands as gated commits directly on `main`.

## Current authority

- The official snapshot contains 2,240 unique printings across 22 packages.
- `ALL_CARDS` contains all 2,240 IDs, so catalog presence is complete.
- The Q&A manifest contains 2,912 items: 341 matched and 2,571 test-missing.
- Non-MVP partner generation explicitly contains 276 ability stubs.
- Engine and Meta currently apply different deck-validation contracts.
- Existing `GameResult` supports `concede`; public dispatch and MATCH UI do not.

Every wave starts by refreshing the relevant official card text, Q&A, errata,
and restrictions. Old completion plans are historical context, not count
authority.

## Main integration contract

Use the clean dedicated `main` worktree, synchronized with `origin/main`.
Do not create a feature branch. Each wave follows official evidence, witnessed
RED, implementation, focused verification, horizontal review, and adversarial
review. Commit only a green coherent wave. Do not deploy between waves.

## Wave 1: mobile and surrender

HOME, DECK, CARDS, and MATCH use a bounded dense landscape composition matching
the supplied reference. The sync/online pill becomes visually smaller while
interactive targets remain at least 44 CSS pixels. Fixed UI uses safe-area
insets. Card art preserves aspect ratio with contained sizing and fallback art.

The formal compact viewports are `851x393` and iPhone SE 3 landscape `667x375`.
Portrait blocks interaction. A user gesture requests fullscreen and then
`screen.orientation.lock('landscape')` when supported. Unsupported or rejected
iPhone paths retain the blocking rotation gate; the app never claims OS lock is
guaranteed.

MATCH exposes an always-reachable match menu. Surrender requires confirmation
and dispatches a public engine `concede` action. A valid live human surrender
atomically sets the opponent as winner with reason `concede`, prevents further
CPU or pending decision work, preserves causal/history evidence, drains terminal
presentation, and navigates to RESULT. Replay, spectator, and terminal matches
reject surrender without mutation.

## Wave 2: one deck-legality authority

A shared domain validator serves DECK, SETUP, import, cloud input, and engine
startup. Blocking errors cover: exactly 40 main cards, character/event main
types, partner/case slot types, known IDs, combined official-ID copy limits,
per-card `deckLimit`, and unlimited cards. Competitive prohibited/restricted
cards remain explicit warnings in ordinary private play, separate from base
legality errors. UI and engine tests consume the same fixtures and results.

## Waves 3-5: semantics and certification

Wave 3 adds missing engine primitives in bounded mechanic clusters. Each cluster
ships an official clause, one exemplar CardDef, negative and human-decision
tests, and a horizontal consumer audit before related cards are authored.

Wave 4 removes explicit partner stubs and partial-card markers from refreshed
official text. No printed ability is inferred from a similar card. Identical
reprints may share implementation only when their complete semantics match.

Wave 5 reduces Q&A `test-missing` from 2,571 to zero. Each item links to an exact
behavioral assertion, or to an explicit official adjudication showing that it
introduces no runtime behavior. Shared tests are allowed only for identical
semantics and must map every covered Q&A ID.

Priority engine outcomes are simultaneous ordering, resolution-time
revalidation, departed or stale targets, optional decline, partial resolution,
re-entry, refresh/deck-out, and competing terminal results. Unknown official
judgments enter a versioned exception table containing card ID, exact clause,
missing authority, and blocked behavior; they are never guessed into production.

## Verification and release

Every UI wave runs component tests and Playwright at `1280x720`, `851x393`, and
`667x375`, plus portrait blocking, keyboard, focus, safe-area, reduced-motion,
and console checks. Engine waves run focused probes, typecheck, lint, full
Vitest, consumer mapping, rules adjudication, engine review, and regression
hunting. Generated docs are regenerated only through repository scripts.

Final completion requires 2,240/2,240 registered IDs, no explicit ability stub
or partial marker without an approved exception, one legality contract, Q&A
test-missing zero, clean full gates, final adversarial UI/rules/engine review,
private-hosted qualification, exact-staging deployment, and authenticated
iPhone SE 3 smoke through HOME, DECK, MATCH surrender, and RESULT.
