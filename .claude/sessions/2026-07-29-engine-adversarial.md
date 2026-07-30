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

## 2026-07-26 Figma Meta UI capture

- Created Figma design `N4o682JTrEKgdJ7gJdvxr8` for the ten `meta-app` routes. Confirmed captures: HOME, SETUP, MATCH, RESULT, DECK, CARDS, HISTORY.
- REPLAY, TUTORIAL, and SETTINGS submissions were launched, but Starter-plan MCP call limits blocked completion polling and Figma-side organization. Temporary capture code was fully removed; `meta-app` has no residual diff.
- Visual-editing decision: avoid rebuilding implemented screens as editable Figma copies. The user wants Figma-like editing of the real Web UI, so prefer a local in-app Design Studio: runtime token inspector first, then Puck-backed composition of registered React components, with Playwright visual snapshots. Keep Figma only as reference.

## 2026-07-26 Codex context efficiency

- Added 96k body-only structured compaction and a 6k tool-output limit.
- Replaced two routers with `conan-router`; added bounded `conan-history` and
  risk-proportional `conan-verify`.
- Disabled 66 superseded or unrelated skills only for Conan. Claude-mem MCP
  remains available through the history bridge.
- Enabled conservative native Memories; MCP/web/tool-search sessions are
  excluded from generation.
- Static A/B proxy stays 3/3 while estimated active skill metadata falls from
  98/14,894 characters to 34/5,033; router bytes fall 7,981 to 2,849.

## 2026-07-26 Codex quality layer

- Added 13 golden tasks with at least three measured repetitions and hard gates:
  critical 100%, overall 95%, unsupported claims and scope violations zero.
- Added explicit-only `conan-accuracy` and `conan-design`; normal startup context
  remains lean.
- Added six read-only specialists for rules, engine, regression, product design,
  UX, and rendered visual QA.
- Product design is neutral and restrained. Conan content carries identity;
  detective clichés and franchise decoration are not the design direction.

## 2026-07-26 Card-detail and catalog color follow-up

- Match detail navigation is magnifier-only: one visible image-top-right control per public card. Card bodies retain game actions; logs have no card-detail control. Existing set counts remain separate controls, and opponent face-down sets remain undisclosed.
- Cross-cut audit covered Scene/Case, hand, FILE/evidence, partner, event, pick/reveal modals, and logs. Focused UI Vitest passed; CutIn/Disguise Playwright passed at desktop and 851x393 with console-error assertions.
- B04059 source color was wrongly blue; corrected to red. Meta catalog and deck now render every `colors` value, including B10097 blue+black; focused CARDS/DECK Playwright and B04059 metadata tests pass.
- CI does not check in official TSV catalog data by design. Inventory and Task-A codegen tests inject temporary minimal catalogs through `CONAN_CARDS_DATA_DIR`; CT-P10 metadata parity runs only when the local official catalog exists. This keeps CI legal/reproducible while retaining local source-to-printing verification.
- Follow-up: SceneArea's detail control had a 220px transparent hitbox for its magnifier. It now uses an 18px hitbox inside the card art; desktop/mobile set-card E2E asserts non-icon art clicks never open details.

## 2026-07-27 YOU vs CPU validation handoff

- Plan: `.claude/specs/plans/2026-07-27-you-vs-cpu-human-validation-plan.md`; the next-task prompt is updated.
- Inventory the current decks from the live UI at task start, then test the ordered N x N matrix including mirrors.
- YOU decisions use public information and the actual UI only; no direct dispatch, state or pending injection, or hidden information.
- Completion covers judgment, rules, state, and UI clarity across match, `#deck`, and `#cards` at desktop and 851x393.
- 2026-07-27 input-stop follow-up: BUG-272/273 lock concurrent ActionsPanel entry and remove action sources without targets; BUG-274 routes multiple partner abilities through ChoicePicker and lets Escape cancel board-only target pickers. Focused 42 UI tests plus typecheck passed; campaign remains paused before row 026.
- BUG-274 follow-up: optional direct scene `pendingEffectPick` bypassed `TargetPicker`, so a public B01040 board picker ignored Escape. Escape now resolves only optional, unforced direct picks as the visible decline action; focused 9, full Vitest 7,167, typecheck, lint, and diff check pass. Post-fix public-fixture replay is still pending; row 026 remains blocked.
- Play-method boundary: rows 001--025 showed that public-UI legality checks alone do not make YOU play like a skilled Conan TCG player. Before row 026, create a separate, evidence-based expert-play method from the official rules, cards, and observed UI. Keep it separate from engine validation; later match logs must explain alternatives, tempo, evidence race, hand economy, action targets, and risk using public information only.
