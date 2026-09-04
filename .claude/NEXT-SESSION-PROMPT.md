# Next Task: official-Q&A boundary required

Work only in `C:\Users\arumi\OneDrive\デスクトップ\conan\.claude\worktrees\qa-wave10-clean`.

Wave253 completed the supplied final `test-missing` PR batch. B04056's two
foreign Q&A entries are excluded by the durable source-correction record. Do
not select, ground, test, certify, annotate, or modify any further Q&A row
until a new fixed candidate list is supplied.

## Completed boundary

- Normalized-Q&A SHA-256:
  `61d7d180f627037a210384dfb0f6dedfe37be3ff064eb8fe409891453c661932`.
- Wave253 certified exactly 12 supplied rows across 8 PR cards.
- B04056 keeps its raw official Q&A. The two entries matching B04055 are
  excluded only from the test corpus by `qa-source-corrections.json`.
- Evidence: `.claude/sessions/2026-09-03-qa-wave253.md` and
  `.claude/sessions/2026-09-03-qa-authority-b04056.md`.
- Production card, engine, GameState, resolver, security, save, and visible UI
  sources are unchanged.

## Required gate

1. Inspect live model and reasoning metadata before repository work.
2. Keep the pinned source and supplied candidate boundary exact.
3. Preserve `pnpm-lock.yaml`, `pnpm-workspace.yaml`, raw
   `ct-d01-api.json` drift, `tests/cards/ct-p10/B10006.test.ts`, and all
   unrelated dirty paths.
4. Never use `stash`, `reset`, `clean`, or `checkout` restoration.
5. Do not regenerate the Q&A snapshot or hand-edit `.claude/auto/`.

Broad Vitest remains blocked by inherited `CARDS_DATA_BUSY`; it is not a pass.
