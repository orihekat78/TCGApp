### 残課題

- Phase 9-F.2: MCTS strength tuning (UCB1 tree + 静的評価関数 + 並列化)
- Phase 9-G.2: リプレイ UI 層 (ReplayPanel / useReplayDriver / GameSetupModal mode)
- ~~Cleanup #1 動的式評価括弧~~ → 完了 (`a8bc6b1`)
- ~~Cleanup #2 cost picker~~ → 実は Phase 9-B B3 fix (`populateCostParams`) で
  実装済を確認 (cost tests 31 PASS、smoke 0 exception)。MVP に multi-option
  human picker UI が必要なカード無しのため UI 部分は defer 継続
- ~~Cleanup #9 listener 漏れ~~ → 実は配線済を確認 (`triggered.ts` 7 hook +
  `misread.ts` + `hirameki.ts`)、cards で使用される全 hook が網羅されており
  実害なし
- Cleanup #3 ヒューリスティック (sceneRemove cardValue) / #6 Playmat レスポンシブ
- ~~user_request 20260521_01 triage 残 4 件~~ → **全 18 件 完了** (Phase δ + ε で #3 / #12 / #18 解決)
- ~~Phase 5 advance UI 残 — Misread UI~~ → 既に完了済 (`35a0736`)
- Souza Sub-task B+C — 公式 defer ([phase-5-advance-souza-deferred.md])、
  MVP に使用カード 0 枚で実装不要
