# 次セッション再開プロンプト (2026-06-22 — refactor Phase 3a 完了 / 次フェーズ未定)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-22、セッション㊲ — branch `refactor/phase-3a` を main へ ff-merge 済 (`8df034e2`)、push 認可待ち)
refactor-plan Phase 3a (atom-handlers.ts 分割) を完了。
- ★開始時に `git ls-remote origin main` で `8df034e2` が origin 取込み済か確認。
  **push が未認可で終わった** ため、未取込みなら `git push origin main` (per-session 認可要求あり) を再実行し、
  push 後 `git ls-remote origin main` + GitHub Actions CI (`gh run list -L1`) green を確認。
- 直前 ㊱ (BUG-133〜136) は main 取込み済 (`9728c967`)。

## ㊲ サマリ (検証済: byte-identity 52/52 / tsc0 / vitest 2783 pass / smoke baseline winsA=498 一致 / e2e 26 / eslint delta0 / 規約lint8)
atom-handlers.ts 1828 行 (単一 runAtom switch・55 verb) を **決定論 codemod** で extract-and-dispatch 分割:
- barrel atom-handlers.ts (runAtom=preamble+dispatch switch + 外部API再export) + atom-handlers/_shared.ts +
  atom-handlers/{core,scene,char,picks,misc}.ts。計画 4→5 補正 (misc 分離)。case body 無改変・外部API不変。
- 着手前フルパネル設計レビュー (opus 4 lens、BLOCKER=log脱漏/MAJOR=import分配を着手前解消) + 実装後レビュー(opus) APPROVE。
- 記録: refactor-plan/{INDEX(3a✅),phases,review-records,phase-3a-design}.md / memory.md。
- 残: 新6ファイルに test pair 無し (lint:test-pair warn、純粋リファクタで既存 atom-handlers.test.ts が runAtom 経由網羅、新test不要)。

## 次にやること (要ユーザー選択)
C-refactor 継続 (推奨、骨格凍結の動作不変例外):
  - **Phase 3b** = pick-resolution 再設計 (resolve-picks/apply-pick/resolver を walk/pending/continuation に 3分割 +
    BUG-054〜121 の 15+ パッチを意味 group 化)。**3 系で最高リスク** (BUG パッチ済 core を触る)。着手前個別設計レビュー必須。
  - Phase 3c (side-channel 8→5) / 3d (UI hooks 分割) / 4 (周辺整理、低リスク)。INDEX.md 状態列参照。
B) デザイン刷新 (.claude/design/RESUME.md、frontend-design skill、project-design-redesign-2026-06-19)。
A) カード追加 (engine-gate DEFER 多数、DEFERRED-INDEX)。
→ 開始時にユーザーへ方向確認。

## プロセス必須 (refactor-phase skill に従う)
- 骨格凍結: refactor は「動作不変な内部最適化」例外。挙動完全不変が絶対。1 フェーズ=1 commit=セッション境界。
- 着手前: working tree clean 確認 / branch first / INDEX 状態列更新 / baseline vitest 件数控える / Phase3系は個別設計レビュー必須。
- ★大規模 byte-exact 分割は **決定論 codemod + per-body md5 自己検証** が王道 (string/comment/template-aware lexer)。
  autocrlf で working tree=CRLF / git=LF のため byte 比較は **EOL 正規化必須**。
- 挙動不変ゲート (全部、この順): tsc0 / full vitest (baseline 件数維持) / smoke:1000 + check:smoke-baseline 一致 /
  e2e 3 spec / eslint (HEAD と delta 0、stash 比較) / 規約 lint (pre-commit 7本)。
- tsconfig `noUnusedLocals/noUnusedParameters` が import/param 過不足を即検知。tsc は src のみ (tests/ は vitest が唯一 gate)。
- Read hook が file を line1 で切る → Bash cat/sed で読む。Write/Edit は Read 1回で登録後に使える。
- pre-commit = docs:check + 規約 lint 群。新 src で structure/mapping 変わる → `npm run docs` を全 .md 編集後に 1 回 → commit。
  auto docs の差分が source-hash のみは正常。effect.md の「ソース (N)」増加は正当 (分割反映)。
- git add は対象 + 再生成 auto docs。除外 .gitignore(.superpowers/)/.claude/design/.claude/reports(smoke)/c:\tmp。★`git reset`(空)は全unstage注意。
- ★push to main は classifier が per-session 認可要求あり。push 後 `git ls-remote origin main` で実取込みを必ず確認。
```

㊲ で refactor Phase 3a を完了し main へ ff-merge (`8df034e2`)。push 認可待ち。
次フェーズ未確定 — 開始時にユーザー確認 (C-refactor 3b 推奨)。`/clear` 後の新セッション推奨。
