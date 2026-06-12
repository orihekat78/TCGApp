---
name: refactor-phase
description: Use when executing a phase of the refactor plan (.claude/specs/refactor-plan/) — リファクタフェーズの着手・検証ゲート・レビュー・記録・commit を行うとき。挙動不変リファクタ、phases.md、INDEX 状態列、smoke baseline、敵対レビューが関わる作業全般。
---

# refactor-phase — リファクタフェーズ実行手順

挙動完全不変が大前提 (骨格凍結の例外「動作不変な内部最適化」)。**Fable 主体**で実施する
(セッション本体 /model fable 推奨。subagent 規約: 実作業 opus / 難判断 fable / 機械 lens のみ sonnet)。

## 1. 着手前

- working tree が clean か確認 (他フェーズ diff との混在禁止。残差分があれば先に切り分け)
- main 直 commit 禁止 → branch を切る (例: `refactor/phase-XX`)
- [INDEX.md](../../specs/refactor-plan/INDEX.md) の状態列を更新し、[phases.md](../../specs/refactor-plan/phases.md) の該当節 + §レビュー記録の前例を読む
- Phase 3 系 (高リスク) は **着手前に個別設計レビュー必須**
- 着手前に full vitest を 1 回流し pass 件数 (baseline) を控える

## 2. 調査・実装

- **決定論スクリプト優先**: grep / md5 / diff / node で機械検証できるものをエージェントに依頼しない
- 1 ステップ = 1 関心事。各ステップ後に `npx tsc --noEmit`
- 計画と実態が食い違ったら (1c「75定義は全コピー」/ 2a「chooser 固定」の前例)、
  挙動不変を優先して計画を補正し、補正内容を phases.md に記録する

## 3. 挙動不変ゲート (全部、この順)

| ゲート | コマンド | 合格基準 |
|---|---|---|
| typecheck | `npx tsc --noEmit` | 0 err (tests/ は対象外 — テストの型崩れは vitest 実走でのみ検出) |
| unit | `npx vitest run` | full pass・着手前 baseline から件数が減らない |
| smoke | `npm run smoke:1000` → `npm run check:smoke-baseline` | baseline 完全一致 (flow/cost/effect 経路を触ったら必須) |
| e2e | `npx playwright test tests/e2e/engine-extensions-2026-06-05.spec.ts tests/e2e/reuse-cards-2026-06-05.spec.ts tests/e2e/task-d-extensions-2026-06-12.spec.ts` | 回帰 0 |
| eslint | `npm run lint` | 既知 baseline (46err 前後) と比較し **新規 0** (stash 比較で切り分け) |
| 規約 lint | pre-commit と同じ 7 本 (`npm run pre-commit` でまとめて可) | 0 err |

## 4. レビュー (right-sizing)

- 低〜中リスク: 決定論検証 + **1 lens** (Agent tool、refactor は `model:'fable'` か opus)。
  高リスク (Phase 3 系): フルパネル Workflow
- reviewer に vitest 等を再実走させない — メインループの結果をプロンプトに書いて渡す
- 指摘は同フェーズ内で全解消してから次へ

## 5. 記録 → commit

1. phases.md §レビュー記録に追記 (実装内容 / レビュー手法・トークン量 / 指摘と解消 / 検証結果)、
   INDEX 状態列 `✅`、memory.md、関連 BUG-XXX.md の status/commit 更新
2. **`npm run docs` は全 .md 編集が終わった最後に 1 回** (specs/memory を後から編集すると
   mapping docs が再び out-of-sync になり pre-commit が落ちる)
3. 明示 add (`git add -A` 禁止) で 1 フェーズ = 1 commit → main へ ff-merge → **push する**
   (2026-06-12 にユーザー許可済。旧ドキュメントの「push は手動運用」は stale)
4. push 後 GitHub Actions CI の green を確認 (`gh run watch` / `gh run list -L1`)
5. commit hook が促す通り NEXT-SESSION-PROMPT.md を更新し、1〜2 フェーズ消化済みなら
   /clear での新セッション再開を推奨してターンを終える

## 罠 (実際に踏んだもの)

| 罠 | 対処 |
|---|---|
| `git restore` が autocrlf で LF→CRLF 化 | 機械置換スクリプトは EOL 自動判別必須 |
| ブロックコメント内の `charModify*/` 等 | `*/` で早期終端 → 構文エラー。「系」等で回避 |
| fixture/定義の grep | `--include="*.ts"` だけだと **.tsx を取りこぼす** |
| Python subprocess (Windows) | cp932 decode 例外で後続の復元処理が飛ぶ。一時改変→復元は Bash 直列で |
| Markdown 100 行制約 | phases.md 肥大時は分割 |
