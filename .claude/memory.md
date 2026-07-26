# Session memory

## 2026-07 Phase 3 / Phase 3.5 closure

- Phase 3 (`BUG-235`–`BUG-244`) closed card-choice visuals, hidden/private safety, duplicate public a11y, modal priority, timer pause, and landscape containment. Formal mobile contract is landscape `851x393`; portrait is out of scope.
- Phase 3.5 commit `d10e1849` adjudicated all 2,912 official QA rows. No official raw text, answers, or URLs are committed. `lint:qa` has 0 issues; its `all-compliant=false` is the explicit `BUG-259` CT-P10 coverage backlog (270 rows / 82 cards), not an unadjudicated row.
- Fixed `BUG-245`, `246`, `248`–`258`, and `260`: declared-cost enforcement; AI hand declarations; set-card cost; human effect order and continuation isolation; partner gate; reveal/visibility and event authorization; action-lock; named card behavior; reasoning timing; B04030 full-scene switch.
- `BUG-249` final rule: only explicit continuation carries confirmation. Direct Hirameki/leave children queue raw with `deferredPicks:true`; their human pick appears only after their new owner-order confirmation. B06049, D03004, and B06023 public dispatch regressions cover it. Sol PASS.
- `BUG-250` final rule: `canPartnerAssist` / `canPartnerSolveCase` are the UI, public dispatch, and AI reader. They require terminal-free current main turn, nonempty cardId, active partner-area. `canWin` remains a state query. Sol PASS.
- `BUG-260`: B04030/P source-name deck enter consumes from deck, full scene invokes existing switch picker, and source removal requires actual entry. Choice host suspends only for B04030/P option 1. Desktop and 851x393 Playwright passed; Sol PASS.
- Verification for `d10e1849`: full Vitest 793 files / 6555 passed (7 skipped); typecheck, lint, bug/listener/side-channel lint, QA merge, docs check, smoke:1000 (timeout=0, exceptions=0), benchmark pass. Targeted Playwright desktop + 851x393 passes for affected overlay/order paths.
- Browser Use localhost automation was blocked by the browser security policy. Do not bypass it. Phase 4 YOU vs CPU hands-on confirmation remains the next user-visible test phase.
- Ticket closure requires `date_fixed` and the real implementation hash. Keep `BUG-259` open until CT-P10 CardDefs exist.

## 2026-07 Ver.2.5 rule manual alignment

- Official manual Ver.2.5 review introduced `BUG-261`. Local rules now distinguish invalid optional Hirameki activation from text resolution, and distinguish printed icon-condition keywords from text-granted keywords outside the scene.
- The shared readers cover scene, hand, deck, bound, and partner-area MR. Original-ability disable keeps the icon itself referenceable but suppresses printed triggered and declared text; external grants remain independent.
- Regressions cover invalid activation, valid/invalid keyword state, text-grant exclusion, cut-in condition, disabled icons, and PA-MR. Generated docs must be refreshed after these reader/card-marker changes.

## 2026-07 CT-P10 B10098 PA cost

- Added `Cost.selfToPartnerArea`: own scene MR plus vacant PA preflight; composite payment is atomic. It preserves uid/state/declared count/turn effects, clears named plus set/stacked cards to remove, emits no new leave hook, and endTurn clears PA-MR turn effects. UI/AI enumerate the preserved PA uid.
- B10098/P are registered once each. Grounding records printed/condition-icon-only plain 突撃 filtering and contact a/b/guard paths. Focused metadata/PA/keyword checks (4 files, 177 tests), typecheck, lint, diff check, and CT-P10 inventory=0 passed.

## 2026-07 CT-P10 implementation checkpoint

- CT-P10 registry is **166 / 166**. The card wave includes source-area identity, public hand reveal lifetime, PA-MR costs, remove-set costs, conditional static candidates, parallel pick resume, and compiler hand-reveal output.
- Official QA is **2,912 / 2,912 adjudicated**. QA merge/verify, trace generation, and lint complete without storing official text or URLs.
- Regression evidence before this checkpoint: full Vitest 881 files / 7,120 tests passed (7 skipped); CT-P10 card suite 51 files / 394 tests; typecheck, lint, bug/listener/side-channel lint, docs checks, smoke:1000, and benchmark passed. Targeted desktop and 851x393 Playwright passed for public reveal, occurrence identity, B10094, and set-card privacy.
- Set-card browse preserves own face states and reveals only an opponent's face-up card. Current UX checkpoint keeps one card-detail magnifier at image top-right and a separate set-count control; do not overlay icons. The next task must audit every detail affordance and navigation path as one coherent interaction.
- Phase 4 YOU vs CPU manual verification remains pending. Browser security previously blocked localhost Browser Use; do not bypass it.
