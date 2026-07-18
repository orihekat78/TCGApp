# Phase 2 Task 2 report

## Delivered

- Added Q&A normalization from legacy JSON-object strings or `Q:/A:` text.
- Normalizes NFKC, CRLF, tabs/spaces; stable `sha256` IDs/hashes.
- Coalesces printings by card ID, preserves distinct question sections.
- Emits deterministic answer-conflict metadata, never raw question/answer text.
- `tsv-corpus` writes separate ignored `.tmp/compiler/qa.json`; `corpus.json`
  card rows are unchanged.
- Generated test-progress doc through `npm run docs`.

## TDD evidence

- RED: `npm test -- tests/compiler/qa-normalize.test.ts` failed because the
  normalizer module and `loadQaCorpus` export did not exist.
- GREEN: focused suite passed 4/4. Synthetic fixtures cover 462 cards / 944
  Q&A records, JSON and text shapes, CRLF/NFKC/space variants, B06098 section
  distinction, B02086/P printing coalescing, and deterministic conflict output.

## Verification

- `npm test -- tests/compiler` — 64 passed, 17 skipped real-data tests.
- `npm run typecheck` — passed.
- `npx eslint scripts/cards/qa-normalize.cjs scripts/compiler/tsv-corpus.cjs tests/compiler/qa-normalize.test.ts` — passed.
- `npm run docs:check` — 0/110 drift after regeneration.
- `git diff --check` — passed.
- Full `npm test` did not complete before the 124-second command timeout; no
  full-suite pass is claimed. The targeted compiler suite completed green.

## Review

- Horizontal consumers read `corpus.json`; its schema remains intact.
- `qa.json` is additive and hash-only. No official Q&A source text is tracked.
- Residual concern: full Vitest needs a longer CI/local budget. Real-data tests
  remain skipped in this clean worktree because ignored TSV/raw source data is
  unavailable.
