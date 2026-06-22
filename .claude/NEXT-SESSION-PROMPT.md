# 次セッション再開プロンプト (2026-06-22 — refactor Phase 3c 完了 / 次フェーズ未定)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-22、セッション㊴ — branch `refactor/phase-3c` を main へ ff-merge 済、push 認可待ち)
refactor-plan Phase 3c (globalThis side-channel 縮減 2ch) を完了。
- ★開始時に `git ls-remote origin main` で 3c commit が origin 取込み済か確認。
  **push が未認可で終わった**なら `git push origin main` (per-session 認可要求あり) を再実行し、
  push 後 `git ls-remote origin main` + GitHub Actions CI (`gh run list -L1`) green を確認。
- 直前 ㊳ (Phase 3b) は main 取込み済 (`50ac6b0a`)。

## ㊴ サマリ (検証済: tsc0 / vitest 2783 pass / smoke winsA=498 一致 / e2e 26 / 規約lint8 / slot13→11 / sidelint13→12)
globalThis side-channel を 2 つ減らした。**計画は補正**: 計画 5ch のうち 3ch (ChoiceResume/OptionalResume=cross-dispatch
holder / OptionalSide=store-drain+cross-module / DeckReveal/Reorder=store-drain) は globalThis が load-bearing → KEEP
(apply-pick が dispatch ごと新規 ctx 構築するため dispatch 境界を跨ぐ値は ctx.dyn 不可)。安全 2ch のみ実施:
- A: `__chainStepNoApply` → `ctx.dyn.chainStepNoApply` (intra-produce、reader=resolver chain case のみ、resolver が
  全 child へ同一 ctx 素通し)。touch=resolver/core/resolve-picks/scene + test 2 file (ctx 捕捉へ移送)。
- B: `__pendingEffectChoiceBindings` を `__pendingEffectChoiceResume` holder の {effect,bindings} 統合
  (pending-state.ts 内部のみ・export 不変・null-safe)。lint allowlist 整理。
- 着手前フルパネル設計レビュー (opus 4 lens 613k tok) で BLOCKER1 (統合 take/clear の null-unsafe) + MAJOR 群解消 +
  実装後 opus APPROVE。記録: refactor-plan/{INDEX(3c✅),phases,review-records(+review-records-1 へ 1a〜2c 分離),
  phase-3c-design}.md / memory.md / changelog-entries/2026-06-22-04。

## 次にやること (要ユーザー選択)
C-refactor 継続 (推奨、骨格凍結の動作不変例外、INDEX.md 状態列参照):
  - **Phase 3d** = UI hooks 分割 (useActionsPanelFlow 921行 enum/run 分離 + cost-builder 抽出 /
    useEngineDispatch 29 case の action union 型化)。**高リスク**。着手前個別設計レビュー必須。
  - Phase 4 (周辺整理: scripts archive / specs stale 検証 / _reuse 規約統一 / sessions アーカイブ、低リスク)。
B) デザイン刷新 (.claude/design/RESUME.md、frontend-design skill、project-design-redesign-2026-06-19)。
A) カード追加 (engine-gate DEFER 多数、DEFERRED-INDEX)。
→ 開始時にユーザーへ方向確認。

## プロセス必須 (refactor-phase skill に従う)
- 骨格凍結: refactor は「動作不変な内部最適化」例外。挙動完全不変が絶対。1 フェーズ=1 commit=セッション境界。
- 着手前: working tree clean / branch first / INDEX 状態列更新 / baseline vitest 件数控える / Phase3系は個別設計レビュー必須。
- ★挙動を**書き換える**リファクタ (3c 型: side-channel 移設等) は byte-identity 不可 → read/write 全サイトの直読みで
  ctx-identity・produce/dispatch 境界を確定し、**着手前フルパネル設計レビューで各 move を敵対的に反証**する。
  全 src grep (card files 含む、コメント除外) で reader/writer を漏れなく列挙してから判断。
- 挙動不変ゲート (全部、この順): tsc0 / full vitest (baseline 件数維持=2783) / smoke:1000 + check:smoke-baseline 一致 (winsA=498) /
  e2e 3 spec (engine-extensions/reuse-cards/task-d-extensions) / eslint (HEAD と新規 0、現 baseline=125) / 規約 lint (8本)。
  ★eslint は数の増減でなく **stash-diff で added problem が 0** を確認 (削除行の不要 directive warning 減は許容)。
- tsconfig `noUnusedLocals/noUnusedParameters` が import/param 過不足を即検知。tsc は src のみ (tests/ は vitest が唯一 gate)。
- Read hook が file を line1 で切る → Bash cat/sed で読む。Write/Edit は Read 1回で登録後に使える。
- pre-commit = docs:check + 規約 lint 群。新 src で structure/mapping 変わる → `npm run docs` を全 .md 編集後に 1 回 → commit。
- git add は対象 + 再生成 auto docs。除外 .gitignore(.superpowers/)/.claude/design/.claude/reports(smoke)/c:\tmp。★`git reset`(空)は全unstage注意。
- ★push to main は classifier が per-session 認可要求あり。push 後 `git ls-remote origin main` で実取込みを必ず確認。
```

㊴ で refactor Phase 3c を完了し main へ ff-merge。push 認可待ち。
次フェーズ未確定 — 開始時にユーザー確認 (C-refactor 3d 推奨)。`/clear` 後の新セッション再開を推奨。
