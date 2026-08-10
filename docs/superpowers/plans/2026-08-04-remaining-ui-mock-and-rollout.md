# Remaining UI Mock and Rollout Plan

## Contract

- Preserve the existing MATCH playmat, zones, cards, and game rules.
- Desktop MATCH is the logical canvas. Mobile landscape uses the same canvas with one uniform scale factor.
- The complete desktop MATCH canvas, including the original ACTIONS rail and existing target-selection UI, scales as one unit. No mobile-only rail, reflow, crop, redraw, label, or control substitution.
- Actual desktop coordinates remain authoritative, including the CPU deck at the rotated opponent side.
- Common processing feedback is transient: source, target, order, result. No permanent mini-panel.
- HOME, SETUP, CARDS, and DECK approved implementations remain the visual baseline.
- The renewed mock review is the exact 13-image package below. HOME, SETUP, CARDS, and DECK keep their approved captures and are revalidated through the five-viewport runtime gate instead of being regenerated.
- Deliver one route or MATCH state per PNG. Do not use contact sheets for approval.
- Reviewed non-MATCH mocks share the actual white logo, seven icon-plus-label navigation items, a 72px desktop header, and a 54px mobile header with 44px targets.
- SETTINGS is an initial visual direction only. Persisted values alone are not functional acceptance.
- Real-user testing starts only after all implementation and code-wide adversarial review complete.

## Mock Review Set

- Before MATCH implementation Wave 4, re-present the routes in the exact renewed-review package as separate desktop and 851x393 PNGs. No contact sheets and no approval inferred from an older capture.
- MATCH mobile is not a responsive redraw. It embeds the complete desktop MATCH canvas, including ACTIONS, with one uniform scale factor.
- The renewed review package contains exactly 13 PNGs: three MATCH images plus desktop/mobile pairs for HISTORY, RESULT, REPLAY, TUTORIAL, and SETTINGS.
- Store each image with a provenance manifest. Mark it `runtime` only when captured from the real route and real DOM; otherwise mark it `design-mock`. Never present a design mock as implemented UI.
- MATCH package:
  1. `match-desktop-1440x900-runtime.png`: authoritative complete playmat.
  2. `match-mobile-851x393-desktop-canvas-v6-design-mock.png`: the full 1702x786 desktop MATCH canvas at one 0.5 scale, including the original ACTIONS rail.
  3. Target-selection review reuses the same full desktop canvas and existing desktop target-selection UI. No mobile-only composition is introduced.
- Non-MATCH package: `history`, `result`, `replay`, `tutorial`, and `settings`, each as one `1440x900` PNG and one `851x393` PNG.
- Before presentation, mechanically verify dimensions, nonblank pixels, unique filenames, and the 13-entry manifest. Visually verify clipping, overflow, text legibility, 44px targets, and exact MATCH central-canvas identity.

1. HOME: implemented desktop and 851x393 captures.
2. SETUP: implemented desktop and 851x393 captures.
3. CARDS: implemented desktop and seven-column 851x393 capture.
4. DECK: implemented desktop and 851x393 captures.
5. MATCH: real desktop DOM plus reviewed 851x393 resolution and target-selection states; the central playmat pixels are identical between mobile states.
6. RESULT: `result-*-reviewed.png`; one fixture, explicit end reason, no nested summary panels.
7. HISTORY: `history-*-reviewed.png`; content-height list, cyan filters, PLAYER/CPU deck tabs, selected deck-code copy, explicit unavailable replay state.
8. REPLAY: `replay-*-reviewed.png`; native-size desktop mock plus scaled playmat and native 44px mobile controls.
9. TUTORIAL: `tutorial-*-reviewed.png`; native-size desktop and 851x393 using the existing L0-L13 curriculum only.
10. SETTINGS: `settings-*-reviewed.png`; initial visual direction with an internal mobile settings scroll.

Static mock gate: all 13 assets are GO after independent product-design and UX review; Critical and Important findings are zero. Runtime gates below remain open.

## Implementation Waves

0. Adversarially review every native-size mock. Block implementation of any rejected screen.
1. Finish CARDS/DECK responsive density and interaction regressions.
2. Finish HISTORY/RESULT/SETTINGS behavior, accessibility, and runtime settings wiring.
3. Implement causal events and presentation queue independently from AI control.
4. Integrate transient causal animation into the unchanged desktop MATCH canvas.
5. Add the uniform wrapper that scales the whole desktop MATCH canvas, including ACTIONS and existing pickers.
6. Implement approved REPLAY and TUTORIAL directions.

## Replay Option A Contract

- New live matches use `ReplayLogV3`: an immutable, versioned graph of accepted GameState transitions. V1/V2 remain readable only through their explicit decoders.
- Frame zero is the first committed state. Later frames have contiguous sequence IDs, one immediate parent, a validated state delta, and a state digest. Moves, EngineActions, free-text logs, and presentation queues are never a second playback authority.
- Capture occurs once at the canonical GameState store boundary and is owned by the exact match `sessionId`; stale starts, demos, replay-owned state, and cancelled sessions are excluded.
- Freeze the terminal frame before match teardown. A RESULT without the original tracked session cannot create a replay-capable row.
- Persist the lightweight history row and opaque replay reference with the complete artifact in one IndexedDB transaction. Quota or validation failure commits neither. Legacy localStorage rows stay visible and unavailable.
- HISTORY opens `#replay/<artifactId>` only. Missing, corrupt, mismatched, unknown-version, or cross-session artifacts never fall back to another match.
- Validate schema, graph, deltas, digests, terminal result, causal graph, and pending runtime off-store before replay claims GameState or presentation ownership.
- Playback restores frames only. Seek pauses, invalidates stale timers, rebuilds in isolated pending runtime, and never dispatches engine or AI actions.
- The stored viewer mode fixes hidden-information perspective. Raw hands, deck order, set-card identity, and pending bindings never enter HISTORY rows, UI errors, toasts, or exports.
- Approved REPLAY layout is the existing playmat plus a native vertical control rail; mobile uses the scaled playmat with native 44px controls and no filler block.

## Graph Engineering

- Model each public causal event as a node; typed parent/correlation edges express source, decision, targets, and outcomes.
- `sequence` is the stable topological order. Cycles, missing parents, duplicate IDs, and cross-session edges fail validation.
- Keep one normalized event graph for Toast, Contact, Refresh, LogPanel, Result, Replay, and presentation—not parallel queues.
- Maintain producer/consumer and route/state graphs so every event kind and every screen state has an owner, consumer, test, and fallback.
- Derive the visible causal chain from graph traversal; never infer it by parsing free-form log text.

## Gates

- Each screen: 1440x900 and 851x393; 1280x800, 1024x768 regression checks; 720x393 narrow-landscape regression check.
- MATCH: identical logical coordinates and one scale factor on desktop/mobile.
- MATCH mobile intentionally preserves the desktop controls under the same uniform scale. Verify coordinate mapping and input behavior against the scaled canvas.
- Mobile global navigation and non-MATCH interactive controls keep a 44px hit area even when labels and icons shrink.
- No hidden-information leakage; deterministic GameState/action/log equivalence.
- Keyboard, focus, reduced-motion, 200% zoom, contrast, and console checks.
- Every visible setting names its runtime consumer and proves change-reload-consumption end to end. Otherwise it stays visibly unavailable and outside completion claims.
- Focused tests, full typecheck, full relevant E2E, horizontal investigation.
- Final code-wide adversarial review: Critical and Important findings zero.
- Then perform the eight-person formative study and report counts, not generalized percentages.
