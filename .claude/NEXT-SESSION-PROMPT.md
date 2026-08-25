# Next Task: card-completion QA Waves152-153

Resume `qa/adjudication-wave-20260814-13` after the Waves150-151 commit.

## Completed

- Wave150 finishes all four remaining B03102 Q&A items.
- BUG-367 moves B03102 from stale `reasoning:end` to `reasoning:after-sleep`,
  so its AP reaction resolves after sleep and before Misread/evidence.
- Wave151 finishes all four remaining B03112 Q&A items for base/P across
  ineffective/additive Cut-In, effect-owner attribution, and switch exclusion.
- Coverage is 1863 matched / 1101 test-missing / 2964 total; 978 exact groups
  remain, including 855 singleton groups.
- Fresh authority remains 2257 printings and 2964 Q&A/zero conflict; PR322 stays
  outside the tracked 2256-printing adjudication snapshot.
- Protected pnpm files and live cards-data remain untouched.

## Throughput contract

- Prefer complete-card batches of 5-15 grounded items; exact groups are not
  implementation-wave boundaries.
- Per wave: focused behavioral tests and narrow QA merge only.
- Two-wave checkpoint: typecheck, focused ESLint, QA merge/lint, docs,
  diff-check, one commit, and one push.
- The next routine full checkpoint is Waves154-155 unless T3/publication or a
  newly found engine defect requires earlier full gates.
- Certification-only work uses no review agent. Raise route for production,
  rule conflict, or new engine/resolver behavior.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read the Waves150-151 session record, this prompt, and QA workflow.
4. Re-run hash-only queue and fresh isolated authority validation.
5. Run pinned grounding for every physical printing before adjudication.

## Wave152: complete B05092

- Certify all four remaining items: `2bb0d1134005`, `4d673c3dfcb7`,
  `8786a477fc17`, and `a4313105cbdb`.
- Separate zero-card shuffle, face-down deck-top movement, pre-guard timing,
  and action termination after moving the declared target.
- Existing CardDef ships `handToDeckBottom` and `sceneToDeck`; the old DEFER row
  is stale and must be reconciled only after public dispatch proof.

## Wave153: complete B06034

- Certify all four remaining items: `69959d6bea85`, `a54fba013cee`,
  `a5f52b076ec7`, and `ce881ce830b`.
- Separate invoked Hirameki zone movement, suppression bypass, ineffective
  condition behavior, and self-target flip-back behavior.
- Existing CardDef ships `evidenceFlip` plus `invokeHiramekiOfCard`; reconcile
  stale DEFER rows only after event-use and evidence-Hirameki public matrices.

## Gate carry-forward

- Waves150-151 target matrices: 2 files / 9 tests PASS.
- Focused horizontal gate: 7 files / 99 tests PASS.
- Both TypeScript projects, scoped ESLint, icon lint, QA merge, and QA lint PASS.
- Sol rules and engine reviewers PASS; Critical/Important zero.
- See the Waves150-151 session record for full functional/smoke gate evidence.

## Estimate

- Snapshot: 1101 remaining items / 978 exact groups; 855 singleton groups.
- Remaining QA work: 60-123 working hours; center about 91 hours.
- Risk-aware batching forecast: roughly 42-82 implementation waves.
