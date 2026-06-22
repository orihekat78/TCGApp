# 次セッション再開プロンプト (2026-06-22 — refactor Phase 3b 完了 / 次フェーズ未定)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-22、セッション㊳ — branch `refactor/phase-3b` を main へ ff-merge 済、push 認可待ち)
refactor-plan Phase 3b (pick-resolution 責務 3 分割) を完了。
- ★開始時に `git ls-remote origin main` で 3b commit が origin 取込み済か確認。
  **push が未認可で終わった**なら `git push origin main` (per-session 認可要求あり) を再実行し、
  push 後 `git ls-remote origin main` + GitHub Actions CI (`gh run list -L1`) green を確認。
- 直前 ㊲ (Phase 3a) は main 取込み済 (`846109ec`)。

## ㊳ サマリ (検証済: 独立 byte-identity (vs HEAD) / tsc0 / vitest 2783 pass / smoke winsA=498 一致 / e2e 26 / eslint delta0 / 規約lint8)
resolve-picks.ts (849行) の pending管理 (連続ブロック L166-467) を **決定論 codemod** で新 pending-state.ts へ
verbatim 移送し、責務 3 分割 = resolve-picks(walk) / pending-state(pending) / apply-pick(continuation、無改変)。
- 旧 public pending API (17値+4型) は resolve-picks の **barrel 再export** で **importer 改変0** (apply-pick/resolver/UI/test 全て無変更)。
  private 7 fn のみ export 昇格 (additive)、getPendingQueue/syncLegacyPickProperty は private 維持。local Player 複製。
- 着手前フルパネル設計レビュー (opus 4 lens + critic 697k tok、BLOCKER0/MAJOR1+MINOR4 を着手前解消) +
  実装後レビュー (opus) APPROVE。BUG-054〜121 を 3 group 化した回帰テスト棚卸し (phase-3b-test-inventory.md)。
- 記録: refactor-plan/{INDEX(3b✅),phases,review-records,phase-3b-design,phase-3b-test-inventory}.md / memory.md。
- codemod=`c:/tmp/phase3b-split.mjs` / 独立検証=`c:/tmp/verify-3b.mjs` (一時、commit 対象外)。

## 次にやること (要ユーザー選択)
C-refactor 継続 (推奨、骨格凍結の動作不変例外、INDEX.md 状態列参照):
  - **Phase 3c** = globalThis side-channel 縮減 (8 → continuation/EffectCtx 統合可能な 5 へ移設)。**高リスク**。
    pending-state.ts に side-channel が集約済 (3b 成果) なので前提が整っている。着手前個別設計レビュー必須。
  - Phase 3d (UI hooks 分割: useActionsPanelFlow 921行 / useEngineDispatch 29 case) / 4 (周辺整理、低リスク)。
B) デザイン刷新 (.claude/design/RESUME.md、frontend-design skill、project-design-redesign-2026-06-19)。
A) カード追加 (engine-gate DEFER 多数、DEFERRED-INDEX)。
→ 開始時にユーザーへ方向確認。

## プロセス必須 (refactor-phase skill に従う)
- 骨格凍結: refactor は「動作不変な内部最適化」例外。挙動完全不変が絶対。1 フェーズ=1 commit=セッション境界。
- 着手前: working tree clean / branch first / INDEX 状態列更新 / baseline vitest 件数控える / Phase3系は個別設計レビュー必須。
- ★大規模 byte-exact 分割は **決定論 codemod + 独立 byte-identity verifier (git show HEAD から再構築)** が王道。
  ★codemod 自己 check は「written-file vs HEAD」で行う (slice を slice 自身と比較すると trailing-newline doubling /
  境界 double-blank を見逃す。3b で実際に踏んで独立 verifier が捕捉)。autocrlf で byte 比較は EOL 正規化必須。
- 挙動不変ゲート (全部、この順): tsc0 / full vitest (baseline 件数維持=2783) / smoke:1000 + check:smoke-baseline 一致 (winsA=498) /
  e2e 3 spec (engine-extensions/reuse-cards/task-d-extensions) / eslint (HEAD と delta 0=127) / 規約 lint (8本)。
- tsconfig `noUnusedLocals/noUnusedParameters` が import/param 過不足を即検知。tsc は src のみ (tests/ は vitest が唯一 gate)。
- Read hook が file を line1 で切る → Bash cat/sed で読む。Write/Edit は Read 1回で登録後に使える。
- pre-commit = docs:check + 規約 lint 群。新 src で structure/mapping 変わる → `npm run docs` を全 .md 編集後に 1 回 → commit。
  auto docs の差分が source-hash のみは正常。effect.md の「ソース (N)」増加は正当 (分割反映)。
- git add は対象 + 再生成 auto docs。除外 .gitignore(.superpowers/)/.claude/design/.claude/reports(smoke)/c:\tmp。★`git reset`(空)は全unstage注意。
- ★push to main は classifier が per-session 認可要求あり。push 後 `git ls-remote origin main` で実取込みを必ず確認。
```

㊳ で refactor Phase 3b を完了し main へ ff-merge。push 認可待ち。
次フェーズ未確定 — 開始時にユーザー確認 (C-refactor 3c 推奨)。`/clear` 後の新セッション再開を推奨。
