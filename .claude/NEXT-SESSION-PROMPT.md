# 次セッション再開プロンプト (2026-06-22 — refactor-plan 全完了 / 次フェーズ=デザイン or カード)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-22、セッション㊹ — refactor Phase 4 を main へ ff-merge + push 済)
refactor-plan の **最終フェーズ Phase 4 (周辺整理) を完了 → refactor-plan (1a〜4) 全完了**。
- ★開始時に `git ls-remote origin main` で local HEAD と一致するか + CI (`gh run list -L1`) green を確認。
  push 直後に CI 完走前でセッションを閉じた場合は green を見届ける。
- 直前 ㊸ (Phase 3g) は `841cfbc0`。㊶〜㊸ の詳細は .claude/sessions/2026-06-22-4.md。

## ㊹ サマリ (検証済: tsc0両 / vitest 2783+1skip / smoke winsA=498 exc0 baselineOK / e2e 26 / eslint 125 added0 / 規約lint8本0)
Phase 4 = engine 不触の低リスク周辺整理。着手前 grounded 調査 (Workflow opus 4 lens) で計画 stale を 2 点是正:
- **scripts archive**: one-off 14本 (survey9 + taskA-wave1/2/3-specs + wf-gate5-batch4 + fix-bug140) を `scripts/_archive/` へ git mv。
  scripts/tsconfig に `exclude:["_archive"]`。★HARD-KEEP 罠: taskA-validate-specs.cjs は tests/engine/sync-taskA-whitelists.test.ts:36 が読込。
- **specs 是正**: 2026-05-11-ui 13本は **全 CURRENT_KEEP** (live `// spec` 参照) → archive せず (計画の stale 前提を是正)。
- **_reuse/index.ts** ヘッダ de-churn (294→「正準=REUSE_CARDS 配列長, 現802枚」、コード不変)。
- **reports policy E**: dated smoke を gitignore (`/.claude/reports/smoke-*` + `!smoke-baseline.json`)、既存 298 を `reports/_archive/` へ git mv。
  → 新 smoke 実行は直下に出て gitignore で吸収 (untracked ノイズ 0)。**sessions=現状維持**。
- 1 lens 敵対レビュー (opus) で移動 script への spec link 切れ 2件 (catalog-survey-2026-06-06/README.md, triage-sweep-2026-06-15.md) を `_archive/` パスに修正。
- 記録: refactor-plan/{INDEX(4✅),phases(4✅),review-records(§4 追記)} / memory㊹ / sessions/2026-06-22-4.md(㊶〜㊸退避) / changelog 2026-06-22-09。

## 次にやること (要ユーザー選択) — refactor-plan は完了したので残るは:
B) **デザイン刷新** (.claude/design/RESUME.md、frontend-design skill、memory: project-design-redesign-2026-06-19)。
   DESIGN.md 前段 (方向性ブレスト) で中断中。コナン=青基調+赤黒ロゴ専用+茶レンガ=原作 identity。
A) **カード追加** (engine-gate DEFER 多数、.claude/specs/DEFERRED-INDEX.md / card-wave skill / certify パイプライン)。
→ 開始時にユーザーへ方向確認。

## プロセス必須
- **デザイン刷新の場合**: frontend-design skill + .claude/design/RESUME.md に従う。UI 変更は Playwright (headed) 実機確認必須
  (memory: feedback-ui-screenshot-verification / feedback-ui-direct-manipulation)。真リスク=UI hook/セレクタ結合。
- **カード追加の場合**: card-wave skill + card-addition-checklist.md。engine 拡張要否を見極め (frozen engine 不可事項=card-impl-engine-gates.md)。
- 共通: 着手前 working tree clean / branch first。挙動不変ゲート (engine/flow 触る場合): tsc0(両=`npm run typecheck`) /
  vitest (baseline 2783+1skip) / smoke:1000 + check:smoke-baseline (winsA=498) / e2e 3 spec (=26) / eslint (baseline 125) / 規約 lint 8本。
- Read hook が file を line1 で切る → Bash cat/sed で読む。Write/Edit は Read 1回で登録後に使える。subagent も Bash cat 指示。
- pre-commit = docs:check + 規約 lint 群。新 .md/src で structure/changelog 変わる → 全 .md 編集後に `npm run docs` 1回 → commit。
  ★BUG を 修正済 にしたら frontmatter に `date_fixed` 必須 (lint:bugs が ERROR)。★Markdown 100 行制約 / memory.md 80 行で sessions/ へ rotate。
- git add は対象 + 再生成 auto docs (.claude/auto 一式、mapping は Source hash churn 同梱)。除外: .claude/design/。git add -A 禁止。
  ★reports: 新 smoke は gitignore 済ゆえ commit 不要。reports/_archive/ は tracked (履歴)。
```
