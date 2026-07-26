# Hand occurrence rebase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task.

**Goal:** Preserve exact duplicate card identity when deck cards move to hand and when hand cards are selected in engine and UI.

**Architecture:** Keep deck bindings indexed by their original occurrences until every selected move is applied, then prune exactly those occurrences and rebase surviving deck indices. Generate hand occurrence IDs through one helper, with legacy `cardId#index` accepted only when unambiguous.

**Tech Stack:** TypeScript, React, Vitest.

## Global Constraints

- Do not alter completed CT-P10 charSet work or card registry.
- Preserve hidden-information rules and existing public IDs where unambiguous.
- Use real dispatch paths in regressions.

### Task 1: Deck binding rebase

**Files:** `src/engine/effect/atom-handlers/core.ts`, `tests/engine/effect/exact-occurrence-transfer.test.ts`

- [ ] Add duplicate deck-binding RED: selected later duplicate moves to hand; only its original binding is removed; surviving binding indices shift.
- [ ] Run the focused test and confirm the old cardId-first prune fails.
- [ ] Prune/rebase by selected original deck indices after the complete move set, never by cardId.
- [ ] Re-run the focused test.

### Task 2: Shared hand occurrence IDs

**Files:** candidate helper/engine producers, `HandZone.tsx`, `Playmat.tsx`, UI and engine tests.

- [ ] Add RED cases for duplicate human discard and hand scene-entry candidates using new occurrence IDs.
- [ ] Centralize new hand UID generation and legacy unambiguous resolution.
- [ ] Update every hand candidate producer and UI consumer to use the helper without exposing hidden identities.
- [ ] Re-run focused engine/UI/card suites.

### Task 3: Verification

- [ ] Run typecheck, lint, diff check, relevant cards B07049/B09039/B10046, and exact occurrence suites.
- [ ] Investigate equivalent hand candidate producers and report remaining blockers outside this change.
