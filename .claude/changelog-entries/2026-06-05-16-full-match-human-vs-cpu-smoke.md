## 1試合通し Playwright smoke (human vs CPU) — CLAUDE.md 6.3 compliance

**Round/Phase**: 2026-06-05 session 残課題対処 — 優先度 高 #2

CLAUDE.md 6.3 が要求する「人間 vs CPU を mulligan → 勝敗決定 (or max 30 turn) まで通して
操作」の smoke test を新規作成。既存 full-match.spec.ts は **観戦モード (AI vs AI)** をカバー
していたが、**人間 vs CPU** は未カバーだった。

### 新規 spec

`tests/e2e/full-match-human-vs-cpu.spec.ts`:
- GameSetupModal の「対戦開始」(human vs CPU mode) を click
- mulligan で「引き直しなし」を click (skip)
- 全ターンで self は **end-turn のみ** (最小行動) を実行 → opp は useOppTurnDriver が自動進行
- 勝敗決定 (gameResult set) または max 30 turn cap まで継続
- 各 step で console error 0 を保証
- AI speed を 0ms に上書き (default 400ms から短縮、test は 3〜5 秒で完了)

### 検証された UI 境界

- GameSetupModal → 対戦開始ボタン dispatch
- MulliganModal → 「引き直しなし」ボタン dispatch
- ActionsPanel の end-turn button → useConfirmation の ConfirmModal → 確定 dispatch
- useOppTurnDriver の自動進行 (turn.player='opp' 観測時)
- gameResult 到達検出 (evidence/deck-out/turn-cap)

### 実行結果

```
[smoke] 勝敗決定: winner=opp / reason=evidence / turn=13
✓ mulligan → 勝敗決定 or max 30 turn まで通して console error 0 (4.4s)
```

self が end-turn だけ (アクション無し) なので opp が evidence で勝つのは想定通り (smoke の
目的は「UI 配線 + engine 結合の全体疎通確認」、戦略性の検証ではない)。

### 関連発見

ConfirmModal が `runEndTurnFlow` の必須経路で挟まる。click だけでなく ConfirmModal の
「ターン終了」OK ボタン click が必要。

### 検証

- 新規 spec 1 件 pass
- 既存 full-match.spec.ts (観戦モード) 2 件 並走で全 pass
- pre-commit hook 全 lint clean (SKIP 不要)

### 残課題

- self が **実 action** (推理/アクション/【宣言】等) する full-match smoke は別途必要 (本 smoke は
  end-turn のみで「最低限の UI-engine 配線」確認に留まる、戦略性 UI バグの検出力は限定的)
- aiSpeedMs=0 で test 走るため、視覚的に **OppTurnOverlay の表示時間** を含む UX 検証は別 spec
