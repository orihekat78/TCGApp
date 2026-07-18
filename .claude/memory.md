# Session memory

## 2026-07-19 Phase 3 closure

- Phase 3 closes BUG-235–BUG-244: shared card-choice visuals, hidden/private safety, duplicate public a11y, modal priority, timer pause, and landscape containment.
- Formal mobile contract: Pixel 5 landscape `851x393`; portrait is out of scope. Shell owns clipping, only body scrolls, and final actions remain 44px.
- Principal fixes: `463dfd29`, `3fa5a68a`, `477833d9`, `24b5025a`, `8ce8d235`, `c4d0bb77`, `ceff8edf`, `73f713f8`, `31d584d1`, `54ce7542`.
- Evidence rule: fixed tickets carry an implementation path, test path, RCA, horizontal investigation, prevention, and real principal implementation hash; follow-ups stay in body text.
- Horizontal result: all choice hosts preserve pending identity; non-modal overlays pass through layout surfaces; timed reveal pauses behind detail; special pickers need short-height shell proof.
- Verification: focused Task-2 reorder suite is 3 files / 12 tests. Docs, BUG lint, generated-doc drift, markdown limit, and diff checks run before commit.
- Phase 3.5 next: use the same `851x393` real-click matrix for any new picker/overlay, then add only scoped regressions and ticket evidence.
