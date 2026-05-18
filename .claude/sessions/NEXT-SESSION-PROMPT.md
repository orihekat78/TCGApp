# 次セッション キックオフプロンプト

新しい Claude Code セッションを開始したら、以下を最初のユーザメッセージとしてコピペしてください。

---

## コピペ用プロンプト

```text
名探偵コナンTCG MVP — Round 4b triggered listener 整備 完了 (2026-05-18 / 最新 `4c64c79`)。
次の作業を開始したい。

## 完了状態

**Round 2 (18 バグ全解消) + Round 3 (B4/B7) + Round 4a/4b** 計 20 連続 commit:

- Round 2 (2026-05-18-1): commits `e61bb7f` 〜 `d343fde` — Human-vs-CPU 全動作確認
- Round 3a (2026-05-18-2): commits `8161efb` + `d15b495` — UI polish 9 件
- Round 3b (2026-05-18-3): `ccdd4b5` — LogPanel HandZone パターン化
- Round 3c (2026-05-18-4/5): `f362175` + `c8118d0` — チュートリアル矢印機構 + 33 step マッピング
- Round 4a (2026-05-18-6): `e10b3a4` — RCA + 水平展開 + engine 3 fix (BUG-008/009 + next-hint 水平展開) + Obsidian Base 化 + 再発防止 spec
- Round 4b (2026-05-18-7): `4c64c79` — triggered ability 汎用 listener 整備 (7 hook 配線 + emit kind 分離)

## テスト状況

- **1455 PASS + 1 skipped** / 192 test files / typecheck clean / docs:check clean
- 1000戦 smoke: heuristic × heuristic / 3.4s / **0 例外 / 0 timeout** / 524/476 baseline 完全維持
- リスク・バグ管理: `.claude/bugs/index.base` を Obsidian で開いて集約 view (Round 4a 導入)

## 重要な反省 (Round 4a RCA より)

Round 1-3 で「セルフレビュー実施済」と書きながら水平展開・RCA が形骸化していた。
今後は以下を **必ず** 守る (CLAUDE.md §セルフレビュー 追記済):

1. **Playwright は 1 試合通し検証必須** — 静的 screenshot ≠ 機能確認
2. **`.claude/rules/` を毎回精読** してからプレイ (BUG-004 対応)
3. **新規バグ発見時は `.claude/bugs/BUG-XXX.md` 追加** + `index.base` を確認
4. **カード追加時は `card-addition-checklist.md` を必ず通す** (kind 分岐 / hook listener / resolver 確認)

## 残課題 (本セッションで選んでください)

### Round 4b 残 (engine 検証)

1. **BUG-006 Playwright 実機再現**: action[事件] state-machine 上の到達確認 (actionDeclareCase → guard → judge phase 経路の追跡)
2. **47 cards effect 個別検証**: D08015 元太登場時「ドロー1 + 手札リム1」発動、D08003 phase:end:start、eventRemoveByAP 等の triggered ability が実機で動作するか確認

### Round 4c (UI 課題)

3. **BUG-001 カード拡大表示**: パートナー/現場/事件カードクリック → 拡大 modal (共通 `useCardExpandModal` hook 導入)
4. **BUG-002 edition tag 隙間**: left-col grid gap=0 + 子 padding 調整
5. **BUG-010 opp turn 可視化**: `pauseOnAction` 利用 + MAX_MOVES timeout 明示化 + action ハイライト
6. **(旧 Round 3d) B5 CPU-vs-CPU 観戦モード**: GameSetupModal に観戦 button + 両プレイヤー AI hook + Playwright 連続 screenshot

### 運用

7. **origin/main push**: 現在 local main に約 22 commits 未 push、共有前に push

## 作業手順

1. `.claude/CLAUDE.md` 規約を確認 (Round 4a で §セルフレビュー追記)
2. `.claude/bugs/index.base` を Obsidian で開いてバグ状況確認
3. `git log --oneline -10` で Round 4a/4b の commit 確認
4. `.claude/sessions/2026-05-18-7.md` で Round 4b 詳細把握
5. **必要に応じて `.claude/rules/` 精読** (Playwright プレイ前は必須)
6. 上記候補から 1 つ選んで brainstorming → plan → 実装
7. UI 編集 / engine 修正を含む場合は **Playwright 1 試合通し検証** 必須

## エッジケース (CLAUDE.md §設計レビュー)

- engine 編集は §骨格凍結原則 §例外 (バグ修正のみ) を厳守
- Round 4a で追加された規約: `.claude/specs/card-addition-checklist.md` を必ず通す
- 新規バグ発見時: `.claude/bugs/BUG-XXX.md` 作成 + frontmatter (`id` / `severity` / `category` / `status` / `round` / `date_found`)
- Playwright で「ターン狩猟」せず、ルール理解した戦略的プレイで動作確認
- prefers-reduced-motion / aria-label / React 19 fiber static flag 回避
```

---

## 参考

- 直近 commit: `4c64c79` (Round 4b triggered listener) — local main のみ (未 push)
- ベース: 1455 PASS + 1 skipped / 192 files / typecheck clean / docs:check clean
- 主要レポート:
  - `.claude/sessions/2026-05-18-6.md` — Round 4a RCA + 水平展開 + 重大バグ修正 + Obsidian Base 導入
  - `.claude/sessions/2026-05-18-7.md` — Round 4b triggered listener (7 hook)
  - `.claude/specs/risk-and-bug-tracker.md` — RCA + 水平展開計画 + 凡例 (per-bug 詳細は `.claude/bugs/`)
  - `.claude/specs/card-addition-checklist.md` — カード追加時の必須チェック
  - `.claude/bugs/index.base` — Obsidian で開く集約 view
  - `.claude/reports/smoke-2026-05-18-{1..11}.{json,md}` — 1000戦 smoke レポート群
