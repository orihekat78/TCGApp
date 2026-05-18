# 次セッション キックオフプロンプト

新しい Claude Code セッションを開始したら、以下を最初のユーザメッセージとしてコピペしてください。

---

## コピペ用プロンプト

```text
名探偵コナンTCG MVP — Round 3a UI 追加修正 完了 (2026-05-18 / 最新 `d15b495`)。
次の作業を開始したい。

## 完了状態

**Round 2 (18 バグ全解消) + Round 3a (9/12 解消)** 計 14 連続 commit:

- Round 2 (2026-05-18): commits `e61bb7f` 〜 `d343fde` — Human-vs-CPU 全動作確認
- Round 3a (2026-05-18-2):
  - `8161efb`: B3 edition tag / B6 scrollbar 削除 / B9a-b FileArea+modal /
    B11 grayscale / B12 next-hint engine bug fix / A8 event カード組込 /
    A1+A10 説明
  - `d15b495`: scrollbar root cause hotfix (overflow: hidden 統一)

## テスト状況

- **1434 PASS + 1 skipped** / 189 test files / typecheck clean / docs:check clean
- 1000戦 smoke: heuristic × heuristic / 3.x s / **0 例外 / 0 timeout** / 524/476 baseline 完全維持 (Round 2+3a 全 9 commit で regression 0)

## 残課題 (本セッションで選んでください)

### Round 3 残 3 項目

1. **Round 3b**: B4 LogPanel HandZone パターン化 (collapsed/expanded + backdrop click 閉) — 規模小-中
2. **Round 3c**: B7 チュートリアル矢印/吹き出し (TutorialStep.target 拡張 + TutorialHighlight 新規 + 33 step mapping) — 規模大、2-3 コミット分割可
3. **Round 3d**: B5 CPU-vs-CPU 観戦モード (GameSetupModal button + 両プレイヤー AI 自動化 + Playwright 連続 screenshot) — 規模中

### Phase 5 advance UI 残

- Misread UI / Souza Sub-task B+C / 「発見された」参照機構

### Phase 9 継続

- 9-F: MCTS / 9-G: ローカル保存・リプレイ / 9-H: パフォーマンス計測

### 運用

- Round 2+3 全 commits の **origin/main push** (現在 local main のみ)

## 作業手順

1. `.claude/CLAUDE.md` 規約を確認
2. `git log --oneline -15` で Round 2+3a の 14 commits を確認
3. `.claude/sessions/2026-05-18.md` で Round 2 全容、`2026-05-18-2.md` で Round 3a 全容把握
4. `~/.claude/plans/encapsulated-crafting-firefly.md` で Round 3 plan の残項目確認
5. 上記候補から 1 つ選んで brainstorming → plan → 実装
6. UI 編集を含む場合は Playwright screenshot + console error 確認 必須

## エッジケース (CLAUDE.md §設計レビュー)

- engine 編集は §骨格凍結原則 §例外 (バグ修正のみ) を厳守
- Round 2+3 で追加された utility 再利用優先: uidNames / handUseReason / computeChapterTag / useMulligan / CardListModal
- Round 3 で追加: FileCard.card-back に cardId 必須 (B12 fix の前提)、deckBuilder に event カード 4 枚追加 (A8)
- prefers-reduced-motion / aria-label / React 19 fiber static flag 回避
```

---

## 参考

- 直近 commit: `d15b495` (Round 3a-hotfix 手札 scrollbar) — local main のみ (未 push)
- ベース: 1434 PASS + 1 skipped / 189 files / typecheck clean / docs:check clean
- 主要レポート:
  - `.claude/sessions/2026-05-18.md` — Round 2 全 18 バグ詳細 + メタ原因サマリ
  - `.claude/sessions/2026-05-18-2.md` — Round 3a 9 件詳細
  - `~/.claude/plans/encapsulated-crafting-firefly.md` — Round 3 plan (3b/3c/3d 詳細記載)
  - `.claude/reports/smoke-2026-05-18-{1..5}.{json,md}` — 1000戦 smoke レポート群
