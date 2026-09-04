# 2026-09-01 QA gate repair

## Scope

- Restored the official-Q&A certification gate without changing production code.
- B01081 uses its existing runtime proof: action declaration exposes the choice
  before guard, and a chosen target moves to the selected owner's deck.

## Repairs

- Added B01081 QA annotations and assertion references at manual-probes lines
  204 and 220; both rows are `matched/aligned`.
- Corrected B06104's stale evidence line from 297 to assertion line 299.
- Returned unsupported `aligned` records to `test-gap`: B01017 (two Q&A rows),
  B01028, B01032, B01039, and B02050.

## Evidence

- Passed: focused 13-test runtime probe, TypeScript, scoped ESLint,
  `qa:adjudication:merge`, `docs:qa-trace`, `lint:qa`, and `git diff --check`.
- Regenerated `.claude/auto/qa-manifest.json`, `.claude/auto/qa-trace.md`, and
  `.claude/specs/qa-trace-baseline.json` through the project tools.
- Read-only queue completed: 2,964 rows, zero unreviewed. No candidate selected.
- Broad Vitest remains unresolved (`CARDS_DATA_BUSY` plus release failures).
- Regenerated the 78 stale generated documentation files; `npm run docs:check`
  now reports zero files that would change. The next task may start the
  next bounded QA wave without a documentation or QA-gate blocker.
