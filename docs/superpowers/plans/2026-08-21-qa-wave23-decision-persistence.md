# QA Wave 23 Decision Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Certify 31 currently test-missing QA records across 20 printings and resume persisted non-human decisions without blocking or exposing the wrong modal.

**Architecture:** Engine-owned pending decision state remains authoritative and JSON-persistable. Every decision surfaces into one ordered public queue; the configured human receives its modal, while the shared driver resolves a non-human owner through authority-bound actions. Headless AI performs the same reconciliation before move enumeration.

**Tech Stack:** TypeScript, React state helpers, Vitest, Playwright, generated QA manifests.

**Spec:** `.claude/memory.md:23-33`, `.claude/rules/15-abilities-effects.md`, `.claude/rules/25-qa-effects-resolution.md`.

## Global Constraints

- Keep engine state authoritative; UI may gate presentation but never mutate game rules.
- Use real event-use, phase, decision, persistence, and public-dispatch paths.
- Reject surface-only assertions; prove decision creation and resolved state.
- Preserve asymmetric owners and exact decline/sequence tails.
- Cover exact printing equality for every selected base card.
- Add current manifest QA IDs as annotations; never invent IDs or traits.
- Do not hand-edit `.claude/auto/**`; regenerate through repository scripts.
- Stop scope at the selected cohort and directly proven shared defects.

## Wave 23 Cohort

- `B03080` (5): optional choice followed by mandatory set tail.
- `B05023` (1), `B05062` (4): conditional choice versus all-target behavior.
- `B07013` (2), `B07054` (2), `B07076` (1): two/three-way choices and gates.
- `B08029` (3): choice continuation retaining `$matched` bindings.
- `B09019` (5): optional multi-stage decision and outside next-hint ban.
- `B09052` (4): enter effect followed by optional rename.
- `B10060` (1): choice then optional; suppress zero-entry child decision.
- `B10096` (3): optional branch followed by conditional choice.
- Printings: `B03080/B03080P`, `B05023/B05023P`, `B05062`, `B07013`, `B07054/B07054P`, `B07076/B07076P`, `B08029/B08029P`, `B09019/B09019P`, `B09052/B09052P`, `B10060/B10060P`, `B10096/B10096P`.

## Task 1: Freeze Baseline and Reproduce Owner Leak

- [x] Add `tests/ui/hooks/bug-wave23-decision-owner-persistence.test.ts`.
- [x] Persist an `opp` optional decision, JSON-roundtrip the state, hydrate through the public store path, and configure `self` as human.
- [x] Prove the public driver auto-declines the non-human decision, resumes its tail, and leaves a matching-human decision for manual input.
- [x] Run the focused test and record the expected RED before implementation.

## Task 2: Repair Ordered Decision Reconciliation

- [x] Surface decisions regardless of owner so persisted engine authority cannot remain hidden behind the move gate.
- [x] Resolve mismatched owners through `bindPendingDecision`; never mutate engine state from presentation code.
- [x] Reconcile before AI move enumeration and stop at the first matching-human decision.
- [x] Cover choice, optional, repeat, intercept, RPS, set-card, reorder, placement, and effect-pick precedence.

## Task 3: Prove Decision Persistence and Continuations

- [x] Use public-dispatch persistence tests where they prove engine resume semantics directly.
- [x] Cover choice, optional, and five side-channel JSON roundtrips with sequence continuation.
- [x] Assert exact state after take, decline, nested decision resume, and runtime cleanup.
- [x] Keep repairs at the smallest responsible engine layer and only after dedicated REDs.

## Task 4: Certify the Card Cohort

- [x] Add `tests/cards/official-qa/decision-persistence-wave23.test.ts` with all 31 manifest annotations.
- [x] Drive real creation and resolution for each decision branch; include asymmetric-owner fixtures.
- [x] Assert exact printing sets and shared behavior across alternates.
- [x] Avoid harness expansion because the shipped probe path already supports this cohort.
- [x] Exclude `B06050`; its YAIBA event branch lacks shipped catalog traits and needs separate card-data adjudication.

## Task 5: Refresh Evidence and Generated Artifacts

- [x] Update only affected adjudication shards under `.claude/specs/qa-adjudication/` if verification reports drift.
- [x] Regenerate affected docs, then run `npm run docs:check`.
- [x] Run `npm run lint:qa` and `npm run qa:adjudication:verify-local`.
- [x] Confirm coverage delta: matched `1018 -> 1049`; test-missing `1946 -> 1915`.
- [x] Record the Wave 23 decision and horizontal findings in `.claude/memory.md`.

## Task 6: T3 Verification, Review, and Commit

- [x] Run focused Wave 23 tests, `npm run typecheck`, and `npm run lint`.
- [x] Run `npm run build` and `npm run smoke:1000`.
- [x] Run isolated-port Playwright for optional decisions and the full public match flow.
- [x] Obtain Sol engine/adversarial review and Terra test review; resolve every BLOCK.
- [x] Run `git diff --check` and inspect the complete diff for unrelated changes.
- [x] Create one coherent clean candidate commit, then pass the release-preparation test and full `npm test` with the worktree still clean.

## Acceptance Evidence

- Focused RED/GREEN output identifies the owner-boundary defect and repair.
- All 31 QA records move from test-missing to matched with exact annotations.
- Choice/optional branches preserve owner, bindings, order, and decline tails after hydration.
- Full Vitest, static gates, QA gates, build, smoke, Playwright, and reviews pass.
