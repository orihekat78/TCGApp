# Wave 1 Surrender Verification

## Scope and verdict

This is a durable evidence index for the Wave 1 public surrender flow. It is
not a final mobile-device certification. Independent UX review: **PASS**
(38 unit checks and 5 Playwright checks). No Critical or Important issue is
open in that review packet.

## Current green gates

| Gate | Result | Evidence covered |
|---|---:|---|
| Landscape hook RED/GREEN | 21 tests green | Observed-landscape entry; rejected/missing APIs; portrait recovery/focus |
| Focused UI regression wave | 174 tests green | Compact HOME, MATCH, modal ownership, RESULT/replay surfaces |
| Public Chromium typography/layout | 34/34 green | HOME, CARDS, DECK at compact viewports; 10px actionable minimum |
| Public Chromium MATCH surrender | 3/3 green | Real surrender to RESULT at 1280, 851, and exact 667 widths |
| Meta Chromium full E2E | 204/204 green | HOME, CARDS, DECK, SETUP, MATCH, RESULT, HISTORY, REPLAY, TUTORIAL |
| Desktop WebKit compact smoke | 2/2 green | Proportional typography and HOME-to-DECK cloud sync |
| Independent UX review | PASS | 38 unit checks + 5 Playwright checks |

The Chromium surrender path starts in public UI, enters SETUP and a live MATCH,
opens a real decision, confirms surrender, keeps the decision inert, and reaches
RESULT once with opponent winner and `concede` reason. Browser checks recorded
zero console and page errors.

## Contract checks represented by the focused wave

- Valid live human surrender is session-bound and atomic.
- Replay, spectator, terminal, stale, missing-human, and wrong-side requests
  reject without mutating the live match.
- Terminal entry clears actionable continuations and stops late driver work,
  while retaining completed causal/history presentation needed by RESULT/replay.
- Replay stores one `concede` terminal outcome and never renders a live menu or
  starts live navigation.
- The 44px MATCH menu remains reachable at desktop, `851x393`, and `667x375`;
  its confirmation layer owns Escape/Tab and prevents competing visible modals.
- The MATCH menu text scales from `12/17/13/11px` at `851x393` to
  `10/15/11/10px` at `667x375` for trigger/heading/copy/action respectively.

## Evidence boundaries

- Desktop WebKit is **not** physical iPhone Safari evidence.
- Physical iPhone SE 3 Safari HOME, DECK, MATCH surrender, and RESULT smoke is
  still unverified. Therefore Wave 1 is not eligible for final device-release
  certification from this report.
- The visual before/after artifacts and their provenance are in
  `../2026-08-12-iphone-se3-landscape/visual-qa.md`.

## Evidence status

The above gate results are the current Wave 1 evidence supplied to this report
on 2026-08-13 JST. The final controller reran the complete Meta Chromium suite,
the dedicated WebKit suite, typecheck, and scoped lint after synchronizing the
route fixtures.
