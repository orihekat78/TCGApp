---
date: 2026-07-26
category: fixes
bugs: [BUG-245, BUG-246, BUG-248, BUG-249, BUG-250, BUG-251, BUG-252, BUG-253, BUG-254, BUG-255, BUG-256, BUG-257, BUG-258, BUG-260]
---

## Phase 3.5 official Q&A adjudication and engine hardening

- Individually adjudicated all 2,912 official Q&A rows using hash-only local trace records. Official Q&A prose, answers, and URLs remain untracked.
- Fixed shared declared-cost, action-lock, owner-order, partner-action, event authorization, reasoning continuation, reveal, and card-effect regressions.
- Direct-invoked human effects now wait for their own owner-order confirmation before opening a pick.
- B04030/B04030P now preserve source and switch semantics when the scene is full.
- Added desktop and `851x393` landscape targeted Playwright coverage plus card, engine, UI, AI, and public-dispatch regressions.
- `BUG-259` remains open for the explicitly tracked CT-P10 CardDef coverage backlog.
