# Next Task: card-completion QA Waves190-191

Resume `qa/adjudication-wave-20260814-13` after the Waves188-189 commit.

## Required runtime

- Use a fresh task with actual runtime `gpt-5.6-terra`, reasoning `high`.
- Confirm runtime/app status; do not infer activation from `config.toml` alone.
- The prior long-lived task was Sol/ultra with about 0.65M input tokens per turn.

## Completed

- Waves188-189 align sixteen B09006-B09024 rows with public owner mirrors.
- No production code changed. Focused tests are 34/34 PASS.
- Coverage: 2156 matched / 808 test-missing / 2964 total.
- Remaining: 706 exact groups, including 604 singletons.

## Economy cadence

- Continue without confirmation. Use no agent for certification-only work.
- Per two waves: one focused test batch, type/lint/QA/docs, one commit, one push.
- Run broad gates at Wave190 because it is the ten-wave milestone, or sooner only
  for actual T2/T3/security/save/UI production changes.
- Stop after Waves190-191 or around 60% context and write the next handoff.

## Start

1. Read root/cards/tests/.claude AGENTS and router/card-wave/verify skills.
2. Verify branch/upstream/status. Preserve all dirty and untracked work.
3. Ground the selected rows from the pinned CT-P09 source before test authoring.
4. Prefer one public owner-mirror test file per wave; change production only for
   a demonstrated gap.
5. Use worktree-local binaries. `pnpm exec` currently attempts an install and
   fails `ERR_PNPM_IGNORED_BUILDS`; do not approve or rewrite dependencies.

## Wave190 candidates: eight rows

- `B09026 3b40e4f1bfa97db36362fad681b7510cb4024f54c57fd8fed3c92833f80261a0`
- `B09032 2dbdc98972f09762697ca53ba1cef0efe3e3089d3f2fc4fef8179b95d65e7beb`
- `B09033 9c1b15e50492b9e1fbc78b0f0e1de0c61378d0a3d45a147b287f2bef1d27d49c`
- `B09033 d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa`
- `B09033 ef2849caee7180cda9c275655743b8c0f8ccc524228510f100ce9dd045396741`
- `B09036 4527c78eaad3bb72d4884ace8948f3b3b46c32efebd407cfdf869f7cea4c9274`
- `B09036 f9fdd58e767090dd50e30d7a5f59197ea337006ee562ff64750770e47a9da32e`
- `B09037 625c35bc13eccd561159206b7740e3c9cc1470b74e7aea147131087f6cd0a00d`

## Wave191 candidates: eight rows

- `B09038 56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f`
- `B09040 ccfd4718c55f312b6e3d9e68cd0a79c23b25c6bd34ba3514db3c020bcbe6359d`
- `B09041 e4a8be25d1df1ed6eaebc5d52ef4db8ecddf8a180b3691cd421120c85c1d7551`
- `B09047 25e17b48d633cf3b18cc3eaca3275c611a8fc1365206c61a492e5d1a8d697620`
- `B09048 7124f41d3267d0e2df2692070acfdd9e66fca11edbbbfb6b64ada8bee4c94b79`
- `B09048 801430e41b8bba0a80712bc0ae76bb5c7ac726aea9c6bcc905c41ff1f9d37670`
- `B09050 c056998b7e5216cbe86e8aba420c46e2769a7f4aac3ca8ea0ea48c91c8a5c466`
- `B09055 5cd641b5128932814c29c2d1177af359548f137dd66f80fb726079fba400a222`

## Carry-forward

- Tracked normalized hash:
  `9a36b5d40860f10a6688bb34d6e52c143b7a996d5f3f561486c6384907b723ec`.
- CT-P09 character TSV SHA-256:
  `34f2babbaaf07cef0f19ff7a765ca7052262d7c43637230b606b14306ff20c04`.
- Local raw drift `ct-d01-api.json` is outside these waves; isolate it.
- Preserve untracked `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and the zero-diff
  `tests/cards/ct-p10/B10006.test.ts` worktree status.
- Release-only dirty-worktree and pnpm-junction `jose` gates remain isolated.
- About 78 waves remain through Wave267.
