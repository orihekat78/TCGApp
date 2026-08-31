# Next Task: card-completion QA Wave192

Resume `qa/adjudication-wave-20260814-13` after the Waves190-191 commit.

## Required runtime

- Use actual runtime `gpt-5.6-terra`, reasoning `high`.
- Confirm the effective task runtime; do not infer it from `config.toml`.

## Completed

- Waves190-191 align sixteen B09026-B09055 Q&A rows.
- Coverage: 2172 matched / 792 test-missing / 2964 total.
- Structural assertions were replaced by disguise, event-use, switch, trigger,
  cost, owner-mirror, and public pick-authorization execution paths.
- BUG-383 snapshots effective hand level before discard/cost removal and rejects
  duplicate, missing, and stale hand occurrences.
- Focused regression: 5 files / 99 tests PASS. TypeScript, scoped/full ESLint,
  QA merge/lint, docs, bug lint, smoke 1000/baseline PASS.
- Full Vitest completion is recorded in the Waves190-191 session note. It has
  a known internal `CARDS_DATA_BUSY` test-host blocker; do not weaken the lock.

## Cadence

- Complete Wave192 only. Do not start Wave193 in the same task.
- Certification-only work uses no agent. Production gaps require a failing probe.
- After Wave192, run focused type/lint/QA/docs gates, make one commit and one push,
  update this prompt for Wave193 only, then stop.
- Next scheduled broad gate is Wave200 unless Wave192 changes engine, state,
  resolver, security, save, or visible UI behavior.

## Start

1. Read root/cards/tests/.claude AGENTS and router/card-wave/verify skills.
2. Verify branch, upstream, HEAD, and status read-only.
3. Preserve all unrelated dirty and untracked work. Do not stash/reset/clean/checkout.
4. Ground selected rows from the pinned CT-P09 source before test authoring.
5. Prefer one public owner-mirror test file. Change production only for a RED gap.
6. Use worktree-local binaries. Never use `pnpm exec`.

## Wave192 candidates: eight rows

- `B09056 291fc09e63b332fbdca9e94aae30890f71c8741ec83bda8724ea0b58d7b8dfd9`
- `B09056 5302873b710d2a6013bbca719807f088b656f140927e19a6e8ab2a7e6a6d699b`
- `B09056 57247cdb00d687f5f6a06d3987bccc1e4a8db8305235ed012d4fdda21abd6dd3`
- `B09057 674ddfc2479854991161980b6b17e67c29832295a9d8c6790a534b955c228d41`
- `B09057 ee4ff12ae2f5d9aaa25b2b03a760a31f15b0d141c59c71aebf70ad2269611e12`
- `B09060 4b9ed3ae16be0d13349f1dab20fb4be1753c986295c1ce7c6853f494d840ff44`
- `B09063 4fb59cfc644032b36ff3acee74cdfdce39b0d1fd77a47e772c0606e2eb7d543f`
- `B09064 0c2766a6353754c22e1dd3df8a1dfda2dfc29acce248c88f56cc9a0d778e4549`

## Pinned authority and protection

- Normalized Q&A SHA-256:
  `9a36b5d40860f10a6688bb34d6e52c143b7a996d5f3f561486c6384907b723ec`.
- CT-P09 character TSV SHA-256:
  `34f2babbaaf07cef0f19ff7a765ca7052262d7c43637230b606b14306ff20c04`.
- Local raw drift `ct-d01-api.json` is out of scope.
- Preserve untracked `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and zero-diff
  `tests/cards/ct-p10/B10006.test.ts` status.
