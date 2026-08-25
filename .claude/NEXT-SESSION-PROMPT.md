# Next Task: card-completion QA Waves154-155

Resume `qa/adjudication-wave-20260814-13` after the Waves152-153 commit.

## Completed

- Wave152 finishes all four remaining B05092 Q&A items.
- BUG-368 preserves mandatory shuffle on voluntary-zero and zero-candidate
  `handToDeckBottom` resolution.
- BUG-369 ends a human action immediately when a settled declaration effect
  removes its actor or target; AI timing, GameState context, and UI state agree.
- Wave153 finishes all four B06034 items for zone movement, suppression bypass,
  inactive conditions, and self-flip.
- Coverage is 1871 matched / 1093 test-missing / 2964 total; 970 exact groups
  remain, including 847 singleton groups.
- Fresh authority is 2257 printings and 2964 Q&A/zero conflict. PR322 remains
  outside the tracked 2256-printing snapshot.
- Protected pnpm files and live cards-data remain untouched.

## Throughput contract

- Per wave: grounded public proof and narrow QA merge only.
- Two-wave checkpoint: one type/lint/QA/docs/diff gate, one commit, one push.
- Waves152-153 already ran fresh T3 full gates. Do not repeat unchanged broad
  gates during Wave154.
- Wave155 has a known engine gap. If production changes, run its required T3
  full gates once at the final two-wave checkpoint.
- Keep certification-only work agent-free; use read-only T3 reviewers only for
  the engine change, maximum three subagents.

## Start

1. Read root/cards/tests AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read the Waves152-153 session record, this prompt, and QA workflow.
4. Re-run hash-only queue and fresh isolated authority validation.
5. Ground every physical printing. Read engine AGENT and `engine-wave` before
   any Wave155 primitive work.

## Wave154: complete B06046 / B06046P

- Certify four remaining items: `3b1c6f4fbf55`, `5534de892499`,
  `92820adcff61`, and `f9d1417c8f5a`.
- Separate active-host mandatory reactivation/Turn2 consumption, no-decline,
  hand-paid character re-entry, and full-scene switch including the source.
- Base/P share text. The fifth entry-trigger item is already matched.
- Existing CardDef ships `setcard:enter`, filtered set count, optional discard,
  remove re-entry, sleep entry, and switch paths; begin as T1 certification.

## Wave155: complete B06047

- Certify four remaining items: `3632e94d50bc`, `3abd9296f96b`,
  `3fc9fa7a38cb`, and `955aafea8be9`.
- The first two require effective level reduction for white YAIBA events in the
  owner's hand, including additive stacking across two B06047 sources and both
  ordinary hand use and Next Hint.
- The current a1 slot is intentionally inert. Implement the filtered cross-hand
  level aura at the narrowest engine/read/use boundary via TDD; do not lower
  B06047 itself or expose hidden hand identity.
- The remaining two items certify hand-paid YAIBA re-entry and full-scene switch.
  The fifth entry-trigger item is already matched.

## Gate carry-forward

- Target matrices: 2 files / 9 tests PASS.
- Focused horizontal: 11 files / 176 tests PASS.
- Full functional Vitest: 1227 files / 12893 tests PASS, 177 skipped.
- Typecheck, full ESLint, QA/docs/icon gates, smoke1000 PASS.
- Desktop/mobile full-match Playwright 2/2 PASS, console error0.
- Sol rules/engine/regression reviews PASS; Critical/Important zero.

## Estimate

- Snapshot: 1093 remaining items / 970 exact groups; 847 singleton groups.
- Remaining QA work: 58-121 working hours; center about 90 hours.
- Risk-aware batching forecast: roughly 40-80 implementation waves.
