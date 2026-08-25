# Next Task: card-completion QA Waves140-141

Resume `qa/adjudication-wave-20260814-13` after the Waves138-139 commit.

## Completed

- Wave138 finishes all five remaining B06036/P Q&A items.
- Wave139 finishes all five remaining B06068/P Q&A items.
- Coverage is 1812 matched / 1152 test-missing / 2964 total.
- BUG-364 adds temporal keyword-loss authority across reader, filter, causal,
  UI, AI, set-source, and legacy-save paths.
- Fresh authority remains 2257 printings / 2964 Q&A / zero conflicts.
- Protected pnpm files and live cards-data remain untouched.
- Full evidence is in the Waves138-139 session record.

## Throughput contract

- Prefer complete-card batches of 5-15 grounded items; exact groups are mostly
  singleton or pairs and are not implementation-wave boundaries.
- Keep unrelated semantics in separate describe blocks inside one card matrix.
- Per wave: focused behavioral tests and narrow QA merge only.
- Two-wave checkpoint: typechecks, focused ESLint, QA trace/lint, docs,
  diff-check, one commit, and one push.
- T3 engine repair required a full checkpoint at Waves138-139. The next routine
  full checkpoint remains Waves144-145 unless T3/publication requires earlier.
- Certification-only work uses no review agent. Raise route on a production
  defect, rule conflict, or new engine path.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves138-139.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue and fresh isolated authority validation.
5. Run pinned grounding for every physical printing before adjudication.

## Wave140: complete B10003

- Certify all five remaining B10003 Q&A items in one card matrix.
- Current suffix prefixes: `0194b74149e2`, `41a4d71898ca`, `648ebbcb352a`,
  `a170fb70e2da`, `a1a08a01622d`.
- Ground every printing and separate exact Q&A semantics before test design.

## Wave141: complete B10098

- Certify all five remaining B10098 Q&A items in one card matrix.
- Current suffix prefixes: `0022106a4376`, `8270b12479bc`, `93124d913071`,
  `aad6b96d24d2`, `ea0d46011bfc`.
- Ground every printing and preserve owner, optional, and physical boundaries.

## Gate carry-forward

- Full functional Vitest: 1213 files / 12752 tests PASS / 177 skip; two protected
  release-writer lanes excluded. Both typechecks and full ESLint PASS.
- Smoke1000 baseline PASS: 471/529, timeout0, exception0.
- Full-match desktop/mobile Playwright: 2/2 PASS, console error0.
- Sol rules and engine reviewers PASS. Next routine full gate 144-145.

## Estimate

- Snapshot: 1152 remaining items / 1020 exact groups; 888 singleton groups.
- Remaining QA work: 65-129 working hours; center about 97 hours.
- Risk-aware batching forecast: roughly 49-89 implementation waves.
