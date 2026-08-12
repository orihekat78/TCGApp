# MATCH Surrender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the registered live human surrender from any MATCH state, stop every live interaction atomically, and reach RESULT once with reason `concede`.

**Architecture:** A session-bound public `EngineAction` produces the terminal GameState. One Zustand commit publishes terminal state and central projections; a terminal interaction service settles independent picker stores. One Match modal-layer coordinator owns focus, Escape, and Tab.

**Tech Stack:** React 19, TypeScript, Zustand, Immer, Vitest, Playwright.

## Global Constraints

- Work and commit directly on clean `main`; never mutate `GameState` from a component.
- Reject inactive/stale/replay/spectator/wrong-side/terminal requests without changing GameState, runtime, presentation, or UI stores.
- Preserve causal/history logs and completed presentations; clear actionable runtime, action contexts, drivers, and promise-backed pickers.
- Execute as T3 with `conan-router`, test-driven-development, `conan-verify`, and read-only engine/UX/adversarial review.

---

### Task 1: Session-bound atomic terminal transaction

**Files:** Modify `src/ui/hooks/useEngineDispatch/types.ts`, `src/ui/hooks/useEngineDispatch/can-check.ts`, `src/ui/hooks/useEngineDispatch.ts`, `src/ui/state/store.ts`, `src/ui/services/matchSession.ts`, `src/ui/services/humanDecisionOwner.ts`, `src/engine/flow/action/state-machine.ts`. Test `tests/ui/hooks/useEngineDispatch.test.ts`, `tests/ui/state/store.test.ts`, `tests/engine/flow/action/state-machine.test.ts`, `tests/ai/replay/state-frame.test.ts`.

**Interface:** Add `{type:'concede';player:Player;sessionToken:MatchSessionToken}`, read-only `currentMatchSessionToken(): MatchSessionToken | null`, and one store `commitTerminalState(...)` API; do not use the legacy missing-human=`self` fallback.

- [ ] RED: a registered live human concedes during an action and pending decision. Expect opponent winner, `concede`, canonical terminal actor/source=winner and target=conceder, one last terminal causal event, empty action contexts/runtime, and no late action commit.
- [ ] RED: subscribe to Zustand and prove no emitted snapshot combines `gameResult` with `activeActionId` or any actionable projected surface. Preserve only presentation-lifetime hand reveal and completed non-awaiting deck reveal in that same snapshot.
- [ ] RED rejection table: pre-commit Mulligan with `gameState=null`, inactive session, missing human registration, explicit null, stale token, spectator/store disagreement, replay, wrong side, and existing terminal. Compare GameState, all stores, runtime side channels, and presentation queue byte-for-byte; pre-commit Mulligan remains cancellable only through existing setup/session flow, not concede.
- [ ] Run `npx vitest run tests/ui/hooks/useEngineDispatch.test.ts tests/ui/state/store.test.ts tests/engine/flow/action/state-machine.test.ts tests/ai/replay/state-frame.test.ts --maxWorkers=1`; witness RED.
- [ ] Expose a read-only current-token getter from `matchSession.ts`. Snapshot strict authority before produce: non-null GameState, active/current token, own-property human registration, spectator mode, replay ownership, and terminal state. Pass it to `isAllowed`; keep `concede` out of `isNewPrimaryAction`.
- [ ] Add an engine terminal-abort primitive that clears action/contact-scoped state and action contexts before `mutate.gameResult.set(...)`; never append causal nodes after the terminal node.
- [ ] Produce and validate the entire terminal state first. Drain with `preserveCompletedPresentationsOnTerminalEntry:true`, then publish GameState plus all central surface projections in one Zustand `set`; before commit re-read authority and reject drift. Roll back dispatcher-owned runtime/store snapshots only—never rewrite session, human, spectator, or replay authority.
- [ ] Re-run focused tests, `npm run typecheck`, changed-file ESLint, and `npm run lint:side-channel`; expect PASS. Commit `feat(match): add atomic surrender transaction`.

### Task 2: Settle every live interaction

**Files:** Create `src/ui/services/terminalInteractionCleanup.ts`, `tests/ui/services/terminalInteractionCleanup.test.ts`. Modify `src/ui/services/matchSession.ts`, `src/ui/hooks/useTargetPicker.ts`, `src/ui/hooks/useConfirmation.ts`, `src/ui/hooks/useChoicePicker.ts`, `src/ui/hooks/useContactModalStore.ts`, `src/ui/hooks/useDeclareNamePicker.ts`, `src/ui/hooks/useEvidenceFlipPicker.ts`, `src/ui/hooks/useHandCostPicker.ts`, `src/ui/hooks/useNextHintPicker.ts`, `src/ui/hooks/useStackedCardCostPicker.ts`, `src/ui/hooks/useSceneSwitchPickerStore.ts`, `src/ui/hooks/useMulligan.ts`.

**Consumes / Produces:** Consume a committed terminal GameState; synchronously produce settled promises/stores and stopped drivers without changing completed presentation history.

- [ ] RED target/confirmation, shared choice, contact, direct scene/hand, and Mulligan families. After terminal commit: no stale overlay, unresolved promise, late dispatch, focus into removed DOM, or unhandled rejection.
- [ ] Make every handler inert immediately when current GameState is terminal, then synchronously resolve/cancel all independent live-match stores without resetting presentation history or the finalized replay.
- [ ] Share settlement primitives with `resetMatchSession` but keep terminal cleanup narrower: stop opponent/spectator timers, demo drivers, and pending user callbacks; do not clear completed presentation FIFO.
- [ ] Run `npx vitest run tests/ui/services/terminalInteractionCleanup.test.ts tests/ui/services/liveReplayRecorder.test.ts tests/ui/hooks/useOppTurnDriver.test.ts tests/ui/hooks/useSpectatorTurnDriver.presentation.test.tsx --maxWorkers=1`; expect PASS. Commit `fix(match): settle interactions on terminal state`.

### Task 3: One accessible MATCH modal layer

**Files:** Create `meta-app/src/components/MatchMenu.tsx`, `src/ui/hooks/useMatchModalLayer.ts`, `tests/meta/MatchMenu.test.tsx`, `tests/ui/hooks/useMatchModalLayer.test.tsx`, `meta-app/tests/e2e/match-surrender.spec.ts`. Modify `meta-app/src/screens/RealMatchView.tsx`, `meta-app/src/styles/meta.css`, `src/ui/hooks/useModalFocusTrap.ts`, `src/ui/components/EffectPickerModal.tsx`, `src/ui/components/MulliganModal.tsx`, `src/ui/components/CardExpandModal.tsx`, `src/ui/components/CardListModal.tsx`, `src/ui/components/ConfirmModal.tsx`, `src/ui/components/EffectDecisionModalHosts.tsx` and every additional live-MATCH owner identified by the fixed inventory.

**Consumes / Produces:** Consume the active `aria-modal` root and live session token; produce one top-layer focus owner and one session-bound concede dispatch.

- [ ] RED shared decision host, EffectPicker, and Mulligan/invariant: closed menu trigger belongs to the active dialog focus scope; Tab reaches it; opening menu makes underlying dialogs inert/`aria-hidden` and suspends their traps; Escape cancels only MatchMenu; pending decision remains unchanged; close restores the exact prior control.
- [ ] RED confirm: 44px trigger, forward/reverse Tab wrap, one dispatch on double activation, failure alert, and no focus restoration into dead DOM after success.
- [ ] Implement one modal-layer registry/portal. Check in the inventory output from `rg -l 'aria-modal|useModalFocusTrap|stopImmediatePropagation' src/ui/components`; register/suspend every reachable MATCH dialog, including custom traps and nested CardExpand/Confirm/CardList. Add a RED that no visible `aria-modal` remains unregistered and that simultaneous visible top-level dialogs equal zero.
- [ ] Render the unscaled safe-area menu only when a current live human session has non-null GameState; capture `currentMatchSessionToken()` when opening and dispatch `{type:'concede',player:'self',sessionToken}` on confirm. Do not render it during pre-commit Mulligan.
- [ ] Browser RED/GREEN at `1280x720`, `851x393`, and `667x375`: HOME -> SETUP -> MATCH, open a real decision, surrender, prove the decision cannot act, then reach `#result` once with opponent win and concede reason; zero console/page errors.
- [ ] Run `npx vitest run tests/meta/MatchMenu.test.tsx tests/ui/hooks/useMatchModalLayer.test.tsx tests/meta/RealMatchView.presentation-integration.test.tsx tests/ui/components/EffectPickerModal.card-detail.test.tsx tests/ui/components/MulliganModal.accessibility.test.tsx --maxWorkers=1` and `npx playwright test --config meta-app/playwright.config.ts meta-app/tests/e2e/match-surrender.spec.ts --workers=1`; commit `feat(meta): add coordinated match surrender menu`.

### Task 4: Replay, RESULT, and horizontal gates

**Files:** Modify `tests/ui/services/liveReplayRecorder.test.ts`, `tests/meta/RealMatchView.presentation-integration.test.tsx`, `tests/meta/ResultScreen.mvp.test.tsx`, `tests/ui/hooks/useOppTurnDriver.test.ts`, `tests/ui/hooks/useSpectatorTurnDriver.presentation.test.tsx`. Create `.claude/reports/2026-08-12-match-surrender/verification.md`. Modify generated `.claude/auto/**` only through `npm run docs` if the generator reports changes.

**Consumes / Produces:** Consume the terminal/replay/browser evidence; produce one bounded verification report plus generator-owned documentation changes only.

- [ ] Extend `tests/ui/services/liveReplayRecorder.test.ts`: one replay artifact, `{winner:'opp',reason:'concede'}`, exactly one terminal causal event, and replay-safe empty runtime/pending/action-context data.
- [ ] Extend `tests/meta/RealMatchView.presentation-integration.test.tsx` and `tests/meta/ResultScreen.mvp.test.tsx`: presentation drains once, RESULT navigation/finalization occurs once, replay has no MatchMenu and never triggers live navigation.
- [ ] Fake-timer RED: opponent/spectator work scheduled before surrender cannot commit afterward. Inspect every `gameResult` writer, driver, promise picker, and `aria-modal` owner horizontally.
- [ ] Run `npx vitest run tests/ui/services/liveReplayRecorder.test.ts tests/meta/RealMatchView.presentation-integration.test.tsx tests/meta/ResultScreen.mvp.test.tsx tests/ui/hooks/useOppTurnDriver.test.ts tests/ui/hooks/useSpectatorTurnDriver.presentation.test.tsx tests/ui/hooks/useReplayDriver.test.tsx tests/ui/hooks/useEngineDispatch.action-fsm.test.ts --maxWorkers=1`, then `npm test`, `npm run typecheck`, `npm run lint`, `npm run build:meta`, `npm run test:meta:e2e`, `npm run docs`, `npm run docs:check`, and `git diff --check origin/main...HEAD`.
- [ ] Record exact commands/results in `.claude/reports/2026-08-12-match-surrender/verification.md`; never hand-edit `.claude/auto/**`. Fix every Critical/Important with a witnessed RED, then commit the report and only generator-changed files as `docs: record surrender verification`.
