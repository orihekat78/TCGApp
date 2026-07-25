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
