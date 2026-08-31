# Next Task: card-completion QA Wave193

Resume `qa/adjudication-wave-20260814-13` after the Wave192 commit.

## Required runtime

- Use actual runtime `gpt-5.6-terra`, reasoning `high`.
- Confirm the effective task runtime; do not infer it from `config.toml`.

## Completed

- Wave192 aligns eight B09056-B09064 Q&A rows.
- Coverage: 2180 matched / 784 test-missing / 2964 total.
- Public owner mirrors execute zero removal, choice, full-scene switch,
  short-deck refresh stop, owner-only declared cost, and dual-trait rewards.
- BUG-384 makes B09063 consume 【ターン1】 when a level-7 blocker prevents draw.
- Focused regression: 14 files / 351 tests PASS. TypeScript, scoped ESLint,
  QA merge, taskA validation, and bug lint PASS. QA/docs artifacts were refreshed.

## Cadence

- Complete Wave193 only. Do not start Wave194 in the same task.
- Certification-only work uses no agent. Production gaps require a failing probe.
- After Wave193, run focused type/lint/QA/docs gates, make one commit and one push,
  update this prompt for Wave194 only, then stop.
- Next scheduled broad gate is Wave200 unless Wave193 changes engine, state,
  resolver, security, save, or visible UI behavior.

## Start

1. Read root/cards/tests/.claude AGENTS and router/card-wave/verify skills.
2. Verify branch, upstream, HEAD, and status read-only.
3. Preserve all unrelated dirty and untracked work. Do not stash/reset/clean/checkout.
4. Ground selected rows from the pinned CT-P09 source before test authoring.
5. Prefer one public owner-mirror test file. Change production only for a RED gap.
6. Use worktree-local binaries. Never use `pnpm exec`.

## Wave193 candidates: eight rows

- `B09073 6f84244014e18679f78a5ae0b96cec21787fc34c207c0c4ba6935a6b198b5b03`
- `B09074 94b5f9ac6b539ddcff7e29f747ed02143be59ad6baacbb89e3a61038c9964adf`
- `B09075 7505735302078534653e21e817caddde9141485ccd57604acac1b5b532a6b765`
- `B09078 3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd`
- `B09078 60bc571b2b7fbd182856b3fc57ec8ed167504073a034957e36be8fe49059137b`
- `B09078 b12f43e33fad16d06ae71349d7a99edf1e732707da24c745d2874072861502f1`
- `B09080 baf591af1a71b89c3e45ee478080278addb5fcda9d66647ac2fb576ead16fb0a`
- `B09080 e708bf24cffc57978de99d717908363a3a03482fcf5db48da0af7d4c282c09fa`

## Pinned authority and protection

- Normalized Q&A SHA-256:
  `9a36b5d40860f10a6688bb34d6e52c143b7a996d5f3f561486c6384907b723ec`.
- CT-P09 character TSV SHA-256:
  `34f2babbaaf07cef0f19ff7a765ca7052262d7c43637230b606b14306ff20c04`.
- Local raw drift `ct-d01-api.json` is out of scope.
- Preserve untracked `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and zero-diff
  `tests/cards/ct-p10/B10006.test.ts` status.
