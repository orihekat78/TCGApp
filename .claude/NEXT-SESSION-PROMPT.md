# 次セッション再開プロンプト (2026-06-22 — refactor Phase 3e 完了 / 次フェーズ未定)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-22、セッション㊶ — refactor Phase 3e を main へ ff-merge 済、push 確認要)
refactor-plan Phase 3e (useEngineDispatch exhaustiveness ガード、minimal) を完了。
- ★開始時に `git ls-remote origin main` で 3e commit が origin 取込み済か確認。未認可で終わったなら
  `git push origin main` (per-session 認可要) を再実行し、push 後 `git ls-remote origin main` + CI (`gh run list -L1`) green を確認。
- 直前 ㊵ (Phase 3d) は main 取込み済 (`476eb365`)。

## ㊶ サマリ (検証済: tsc0 両tsconfig / 負テストTS2322 / vitest 2783+1skip / smoke winsA=498 / e2e 26 / eslint 125 added0 / 規約lint8 0 / slot11据置 / numstat additive-only)
UI の EngineAction dispatch 2 switch に `default:never` 網羅性ガードを追加 (additive・compile-time-only・runtime 完全不変)。
- tsconfig は noFallthroughCasesInSwitch 有・**noImplicitReturns 無** → member 脱落が switch を silent fall-through する穴を
  compile error 化。両 switch (runEngineAction void / isAllowed boolean) 末尾に inline
  `const _exhaustive: never = action; void _exhaustive;` + return/return false。両 switch 24/24 網羅ゆえ default 到達不能。
- **throw 不使用** (isAllowed は dispatchEngineAction try 外呼出、throw だと uncaught 化で挙動破壊)。helper 不使用 (repo 8 サイト全インライン)。
- **着手前フルパネル設計レビュー** (Workflow opus 4 lens + synthesis、509k、BLOCKER 0、4/4 一致 minimal) で当初 4 sub-goal を裁定:
  #1 runEngineAction 分割=DROP (barrel 490<500 で size 動機ゼロ + axId cross-module 化 BUG-034 category)、
  #2 axId globalThis化=DROP (slot 11→12 で headline ≤7 逆行・3c 打消し)、#3 family型化=SUBSUMED → #4 ガードのみ ADOPT。
- **水平展開で Phase 3f 新設**: engine `applyMove` (src/ai/policy.ts:209、Move 11-member union、default 0) が UI と同型の
  silent-gap。骨格凍結ゆえ別 phase (engine touch 可 or 骨格バグ修正例外) で default:never 追加。
- 記録: refactor-plan/{INDEX(3e✅/3f追加),phases,review-records(3e),phase-3e-design}.md / memory㊶ / changelog-entries/2026-06-22-06。
  memory.md は ㊴+㊵ を sessions/2026-06-22-3.md へローテート。

## 次にやること (要ユーザー選択)
C-refactor 継続 (推奨、INDEX.md 状態列参照):
  - **Phase 3f** = engine `applyMove` (policy.ts:209) に default:never 網羅性ガード追加。3e と同型だが **骨格 (engine) touch**
    ゆえ「骨格バグ修正例外」での着手。Move union (move-enumerator.ts:23-34) の網羅性を tsc で機械保証。低〜中リスク
    (additive・現状 11/11 網羅なら到達不能)。着手前に applyMove が現在 exhaustive か確認 + 3e と同手順 (負テスト/numstat)。
  - Phase 4 (周辺整理: scripts archive / specs stale 検証 / _reuse 規約統一 / sessions アーカイブ、低リスク)。
B) デザイン刷新 (.claude/design/RESUME.md、frontend-design skill、project-design-redesign-2026-06-19)。
A) カード追加 (engine-gate DEFER 多数、DEFERRED-INDEX)。
→ 開始時にユーザーへ方向確認。

## プロセス必須 (refactor-phase skill に従う)
- 骨格凍結: refactor は「動作不変な内部最適化」例外。挙動完全不変が絶対。1 フェーズ=1 commit=セッション境界。
  ★Phase 3f は engine 本体を触る → 「骨格バグ修正例外」に該当することを着手時に明示し、設計レビューで挙動不変を敵対的反証。
- 着手前: working tree clean / branch first / INDEX 状態列更新 / baseline vitest 件数控える / Phase3系は個別設計レビュー必須。
- ★additive (default:never 等) は byte-identity 不可 → 決定論検証は `git diff --numstat` deletions=0 + 追加 hunk=default
  ブロックのみ + **負テスト** (member 1 削除→tsc TS2322 で guard 有効性実証、commit せず) で機械保証。
- 挙動不変ゲート (全部、この順): tsc0 (両 tsconfig=`npm run typecheck`) / full vitest (baseline=2783+1skip) /
  smoke:1000 + check:smoke-baseline 一致 (winsA=498) / e2e 3 spec (engine-extensions/reuse-cards/task-d-extensions=26) /
  eslint (baseline=125、新規 0) / 規約 lint 8本。
- Read hook が file を line1 で切る → Bash cat/sed で読む。Write/Edit は Read 1回で登録後に使える。subagent も Bash cat 指示。
- pre-commit = docs:check + 規約 lint 群。新 .md/src で structure/changelog 変わる → `npm run docs` を全 .md 編集後に 1 回 → commit。
- git add は対象 + 再生成 auto docs。除外 .gitignore(.superpowers/)/.claude/design/.claude/reports(smoke)/scripts/_phase*。
- ★push to main は per-session 認可要求あり。push 後 `git ls-remote origin main` で実取込みを必ず確認。
```

㊶ で refactor Phase 3e を完了し main へ ff-merge。次フェーズ未確定 — 開始時にユーザー確認 (C-refactor 3f 推奨)。`/clear` 後の新セッション再開を推奨。
