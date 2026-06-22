# memory — 現セッション scratchpad

> ㊶〜㊸ (Phase 3e/3f/3g) は [.claude/sessions/2026-06-22-4.md](sessions/2026-06-22-4.md) へ退避。

## セッション㊹ (2026-06-22) — refactor Phase 4 完了 (周辺整理、refactor-plan 全完了)
Phase 3g は main 取込み済 (841cfbc0, CI green)。ユーザー選択で Phase 4。branch `refactor/phase-4`。engine 不触・低リスク。
- **着手前 grounded 調査 = Workflow opus 4 lens 並列** (scripts/specs/_reuse/sessions・reports、358k tok) で**計画 stale を 2 点是正**:
  ① 「survey 4本」→ 実 one-off **14本** (survey9 + taskA-wave1/2/3-specs + wf-gate5-batch4 + fix-bug140) を無参照 grounded 確認の上 `scripts/_archive/` へ git mv。
    HARD-KEEP 罠: taskA-validate-specs.cjs は tests/engine/sync-taskA-whitelists.test.ts:36 が読込 (archive 厳禁)。scripts/tsconfig に `exclude:["_archive"]`。
  ② 「specs 2026-05-11 stale→archive」→ 13本は **全 CURRENT_KEEP** (live `// spec` 参照 + INDEX/HUB/tests) ゆえ **archive せず**。
- `_reuse/index.ts` ヘッダ de-churn (294件 stale → 「正準=REUSE_CARDS 配列長, 現802枚」、import/export コード不変)。
- reports=**policy E** (ユーザー裁定): dated smoke を gitignore `/.claude/reports/smoke-*` + baseline allowlist `!smoke-baseline.json`、既存 tracked 298 を `reports/_archive/` へ git mv (履歴保持)。新 smoke は直下→ignore で untracked ノイズ消滅 (62→0)。sessions=現状維持 (ユーザー裁定)。
- **1 lens 敵対レビュー** (opus): 挙動 A/B/C/D PASS。E (spec の移動 script パス link 切れ 2件→`_archive/` パス修正済) + F (structure.md 再生成=docs 解消) を解消。
- **ゲート全 GREEN**: tsc0(両) / vitest 2783+1skip / smoke winsA=498(exc0/baselineOK) / e2e 26 / eslint 125(added0) / 規約lint8本0。

### 学び㊹
- 周辺整理でも「計画記載の対象数」は陳腐化する (4本→14本、specs 全 stale→全 current)。**着手前に grounded 調査で実態を再確認**してから move する。
- 1回限り script の archive は「無参照」の grounded 確認が要 (package.json/ci.yml/SKILL.md/start.bat/**tests の readFileSync**)。CI test が script を fixture 読みする罠あり。
- ファイル move は **active docs の reproduce-command パス link 切れ**に注意 (history log は不変記録ゆえ除外可)。provenance JSON の generatedFrom は当時の記録ゆえ据置。

### commit㊹ / 次
明示 add (3 src/config[.gitignore/scripts tsconfig/_reuse] + 移動群[scripts/_archive・reports/_archive] + 記録 md + auto docs、.claude/design 除外) → 1 commit → main ff-merge → push → CI green。
**refactor-plan (1a〜4) 全完了。** 次: デザイン刷新 (.claude/design/RESUME.md) / カード追加 (DEFERRED-INDEX) を要ユーザー選択。`/clear` 推奨。
