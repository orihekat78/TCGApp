# Session memory

## 2026-07-19 Phase 3 closure

- Phase 3 closes BUG-235–BUG-244: shared card-choice visuals, hidden/private safety, duplicate public a11y, modal priority, timer pause, and landscape containment.
- Formal mobile contract: Pixel 5 landscape `851x393`; portrait is out of scope. Shell owns clipping, only body scrolls, and final actions remain 44px.
- Principal fixes: `463dfd29`, `3fa5a68a`, `477833d9`, `24b5025a`, `8ce8d235`, `c4d0bb77`, `ceff8edf`, `73f713f8`, `31d584d1`, `54ce7542`.
- Evidence rule: fixed tickets carry an implementation path, test path, RCA, horizontal investigation, prevention, and real principal implementation hash; follow-ups stay in body text.
- Horizontal result: all choice hosts preserve pending identity; non-modal overlays pass through layout surfaces; timed reveal pauses behind detail; special pickers need short-height shell proof.
- Verification: focused Task-2 reorder suite is 3 files / 12 tests. Docs, BUG lint, generated-doc drift, markdown limit, and diff checks run before commit.
- Phase 3.5 next: use the same `851x393` real-click matrix for any new picker/overlay, then add only scoped regressions and ticket evidence.

## 2026-07-22 Phase 3.5 QA horizontal fixes

- BUG-249 review remediation: `EffectStackPanel` filters `reorderPlayer` before all display/payload derivation and preserves `Playmat`'s `pendingOwnerOrderGroup` sequence. Exact confirmation renumbers every group entry from the accepted snapshot, including partial legacy order values; mixed-owner/cross-batch/timestamp-divergence resolver execution matches that sequence. Focused 6 files/36 tests and B03006 desktop + `851x393` Playwright 2/2 pass. Full Vitest exceeded the 120s command limit without a result.

- BUG-253: `CardDef.useCondition` is the sole source for explicit event-use authorization. Ability/icon conditions remain post-use effect conditions; normal, post-pop Next Hint/UI, and effect-use pick/recheck share the reader.
- BUG-254: Hirameki can trigger from both face-up and face-down evidence removed by Action [Case]; suppression and no-Hirameki are the only tested no-prompt cases.
- Focused regression: `tests/engine/bug-253-254-event-use-and-hirameki-faceup.test.ts` covers atomic rejection, decoy ability conditions, all explicit authorization families, and both orientations through the real action path.
- Phase 3.5 BUG-249: the priority human orders all eligible unresolved effects across emission batches and legacy entries; batches are provenance only. CPU pauses and wakes after confirm, nested timings clear parent confirmation, paused-effect carriers finish before prefix triggers, contact bindings survive deferred resolution, and desktop plus `851x393` Playwright pass.
- BUG-249 final hardening: RPS and set-card choice are resolver boundaries; their pending/resume data preserve batch/order/confirmation provenance. Owner confirmation uses the exact visible entry-ID snapshot and rejects stale input without mutation.
- Evidence: real B07011 RPS plus losing discard, generic set-card continuation, actual B03006 `flow.action.declare`, B03057 observer order, and stale-confirm regressions pass; `npm run typecheck` passes. Normal-event hand-use provenance drains only after `runAllUntilEmpty`; corrected regression now passes.

## 2026-07-22 BUG-245/255 payment final hardening

- `canDeclaredAbility` remains structural; `canActivateDeclaredAbility` owns current owner + main phase, resolver lock, open ActionContext, pending stack, and human picker/owner-order. Public new-action dispatch additionally blocks all UI pending prompts.
- Cost payment snapshots and restores pre-existing replacement provenance on preflight/rejection; actual listener emits journal until all leaves commit.
- `custom` cost closures fail closed; direct fixed witness and choice-path validation is exact; `selfToDeckBottom` simulator now removes set/stack cascade before deck/MR placement.
- Focused `bug-245-declared-ability-cost` has direct custom, surplus reveal witness, preflight provenance, B03011 cascade, and dispatch-ownership coverage. Typecheck passed.

## 2026-07-22 BUG-257 B04059 scene-only alias

- B04059 now uses the existing `continuousModifier.grantNames` on-scene path for 本堂瑛海; hand, deck, and remove retain printed 水無怜奈 only.
- Card-bound QA test covers reader/bond/filter, zone negatives, printed-only distinctNames, and the retained opponent-turn leave trigger. Consult-choose remains intentionally printed-only.

## 2026-07-22 BUG-258 reasoning sleep reaction window

- `reasoning:after-sleep` queues an engine-only, uid/player-bound, single-use
  continuation token. It is not an AtomVerb; all reactions, including human
  optional effects, settle before mislead and evidence.
- B05080, B01045, B03038, and B05019 use the new timing because they change the
  current reasoning's LP/evidence; unrelated post-reasoning listeners remain at end.
- MCTS rollout/tree expansion and Replay state reconstruction drain immediately
  after direct reasoning `applyMove`; `playTurn` retains its existing single drain.

## 2026-07-22 BUG-250 common partner-action gate

- `read.game.canPartnerAssist` / `canPartnerSolveCase` are the shared UI, public-dispatch, AI source of truth. Both require current owner/main phase, non-empty cardId, active `partner-area`; solve preserves case/evidence, same-turn assist, and cannot-solve gates.
- Exact regression now proves real AI `enumerateMoves` parity alongside UI and public dispatch for no-card, removed/file, auto/end, both wrong-player directions, valid self/opp, and legacy missing optional `turnEffects`. Focused 38 tests, typecheck, BUG lint (0 errors), QA merge, and diff check pass.

- BUG-250 terminal hardening: the common executable-action reader now rejects non-undefined `gameResult`, covering UI, actual public dispatch, and AI enumeration. `canWin` was restored as a separate state query, so it retains its documented case/evidence/partner/assist/cannot-solve semantics without terminal, owner, or phase eligibility. Fixtures use main phase for valid paths; sleep and terminal paths are isolated negatives. RED 3 tests; GREEN focused 4 files/53 tests, typecheck, scoped ESLint, BUG lint (0 errors/99 legacy warns), QA merge, and diff check pass.

## 2026-07-22 BUG-246 AI hand declaration parity

- AI move enumeration now walks unique hand `cardId`s with the canonical hand sentinel and `canActivateDeclaredAbility`; this preserves UI/public eligibility for owner, main phase, pending/resolver, and payable-cost gates.
- `makeDeclaredAbilCtx` resolves hand sentinels. Direct `sceneEnter from:'hand'` from an on-hand declared source consumes one source card, preventing B06103/B06103P duplication.
- Focused asymmetric regression covers allowed source, cost rejection, opponent/out-of-turn/non-main phase, pending/resolver lock, duplicate identity, stale source, public dispatch, plus real opp `stepTurn` B06103/B06103P cost→sleep-enter completion. Typecheck, scoped lint, BUG lint, and hash-only QA merge check passed; no QA baseline/docs changed. Full Vitest was retried after the fix and timed out at the 120s execution ceiling before a result.

## 2026-07-26 BUG-260 B04030 action-end choice

- B04030/B04030P now include source-name `黒羽快斗` alongside `怪盗キッド` in
  their private action-end deck choice. Deck-enter uses `target.query.area:'deck'`
  so the selected card is consumed before the original source is removed.
- Regression covers real action-end continuation after opponent leave, private
  reveal, decline, zero candidates, source-name copy enter, and B04030P parity.

## 2026-07-26 BUG-260 full-scene hardening

- B04030/B04030P reuse the standard effect switch picker when their human
  action-end enter choice resolves into a full scene. The selected victim reaches
  `sceneEnter`; source removal is conditional on actual entry, including a
  cancelled switch. Human `deckRevealUntil chooseMatch:'upTo'` retains the
  standard empty picker confirmation before bottom-deck handling.

## 2026-07-26 BUG-260 switch overlay blocker

- `EffectChoiceModalHost` now suspends its full-screen choice overlay while
  B04030/B04030P's selected enter option waits on Playmat's existing switch
  victim surface. Victim and explicit cancel clicks work on desktop and `851x393`;
  outside clicks do not close the switch. The gate is B04030/B04030P option 1 only,
  so nested `sceneEnter` metadata in B07079/B09047/B05062 remains card-first.
