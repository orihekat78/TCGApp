## refactor(repo): Phase 4 — 周辺整理 (scripts archive / reports policy / _reuse header)、refactor-plan 全完了

engine 不触の低リスク周辺整理。着手前 grounded 調査 (Workflow opus 4 lens 並列、scripts/specs/_reuse/sessions・reports)
で計画の stale 前提を 2 点是正してから実施。挙動完全不変。

- **scripts 棚卸し**: one-off 完了済 14 本を `scripts/_archive/` へ git mv (履歴保持) — `scripts/survey/` 9 本 +
  `taskA-wave1/2/3-specs.cjs` + `wf-gate5-batch4.mjs` + `fix-bug140-icon-abilities.mts`。package.json / `ci.yml` /
  各 SKILL.md / start.bat / tests のいずれからも無参照を grounded 確認。`scripts/tsconfig.json` に `exclude: ["_archive"]` 追加。
  recurring pipeline 系 (lint*/docs/bug-trend/check-*/taskA-{build-queue,codegen,collect-greens,next-chunk,register,validate-specs}/
  wf-certify) は KEEP。**HARD-KEEP 罠**: `taskA-validate-specs.cjs` は `tests/engine/sync-taskA-whitelists.test.ts:36` が
  `readFileSync` で読むため archive 不可。
- **計画是正①**: 旧計画「scripts/survey 4 本」→ 実際は survey が 9 本に増殖済 + 他 5 本の one-off も対象、計 14 本に補正。
- **計画是正②**: 旧計画「specs 2026-05-11 系 13 本 stale 検証 → archive」→ 13 本は **全 CURRENT_KEEP** (src/ui の live
  `// spec` 参照 + INDEX.md/HUB.md/tests 参照) ゆえ **archive せず**。`specs/_archive/` は作らない。
- **reports policy** (ユーザー裁定 E): 日次 smoke レポートを `.gitignore` (`/.claude/reports/smoke-*` +
  `!smoke-baseline.json` allowlist) し、既存 tracked 298 本を `.claude/reports/_archive/` へ git mv (履歴保持)。
  `check:smoke-baseline` は REPORTS_DIR 直下最新の `smoke-…-N.json` + baseline のみ読むため影響なし。untracked smoke ノイズ 62→0。
- **`_reuse/index.ts` ヘッダ de-churn**: stale な「294 件」記述を「正準枚数は REUSE_CARDS 配列長 (現 802 枚)」に書換
  (コメントのみ、import/export コード不変)。
- **sessions**: 現状維持 (ユーザー裁定。CI 非依存・小サイズ・rotate 先)。
- 検証 GREEN: tsc0 (両 tsconfig) / vitest 2783+1skip / smoke winsA=498 (exceptions0/baseline OK) / e2e 26 /
  eslint 125 (added0) / 規約 lint 8 本 errors=0。1 lens 敵対レビュー (opus) で移動 script への spec link 切れ 2 件を修正。
- **refactor-plan (Phase 1a〜4) 全完了。**
