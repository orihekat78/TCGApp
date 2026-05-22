### 残課題

- Phase 9-F.2: MCTS strength tuning (UCB1 tree + 静的評価関数 + 並列化)
- Phase 9-G.2: リプレイ UI 層 (ReplayPanel / useReplayDriver / GameSetupModal mode)
- ~~Cleanup Phase 中/大規模 5 件 全完了~~:
  - #1 動的式評価括弧 → `a8bc6b1` (shunting-yard で precedence + parens)
  - #2 cost picker → 実は `populateCostParams` で実装済を確認 (`616728a` doc)
  - #3 ヒューリスティック sceneRemove cardValue → `d23f8cb` (`handUseCardSwitch`
    の removeUid を `cardValueSelf` 最低に変更)
  - #6 Playmat レスポンシブ → `bca62c9` (`useStageScale` で動的 transform)
  - #9 listener 漏れ → 実は配線済を確認 (`5d36582` doc)
- ~~user_request 20260521_01 triage 残 4 件~~ → **全 18 件 完了** (Phase δ + ε で #3 / #12 / #18 解決)
- ~~Phase 5 advance UI 残 — Misread UI~~ → 既に完了済 (`35a0736`)
- Souza Sub-task B+C — 公式 defer ([phase-5-advance-souza-deferred.md])、
  MVP に使用カード 0 枚で実装不要
