# 05. CPU AI 設計

## 結論

3層構成、ストラテジーパターンで切替可能：

1. **Random AI** — Phase 1（必須・テストオラクル）
2. **Heuristic AI** — Phase 2（MVPデフォルト）
3. **Determinized MCTS** — Phase 3（任意・将来）

## Random AI（Phase 1）

- 合法手リストから一様サンプリング
- 実装コスト最小
- **AI回帰テスト** のベースライン (sanity oracle) として有用
  - 違法手生成検出
  - 無限ループ検出
  - ルールエンジンのデッドロック検出

## Heuristic AI（Phase 2 / MVPデフォルト）

線形評価関数で貪欲に最良手を選択：

```typescript
score(state) = w1·証拠リード差
             + w2·手札枚数差
             + w3·場のキャラ戦力差
             + w4·テンポ
             + w5·脅威カード残数
```

- 重み係数の初期値は経験的に推定
- 後段で N-Tuple Bandit や CMA-ES で自動チューニング可
- 評価関数の標準形: `evalState + Σ evalCard(own) - Σ evalCard(opp)`

### コナンTCG での重み付け方針

`.claude/rules/01-victory-conditions.md` から「証拠リード」が支配項。
事件解決のパス（FILE7枚 → 解決編 → 証拠数 ≥ レベル）を考慮した
時間割引（ゴールから逆算）が有効。

## Determinized MCTS（Phase 3 / 将来）

- 隠れ情報（相手手札・デッキ順）をランダムに具体化
- 各 determinization で UCT 探索 → 多数決
- **コスト**: 1手 = 10〜40 determinizations × 数千 playout
- TS シングルスレッドで 1〜数秒/手 → **Web Worker 必須** + 思考時間制限（800ms目安）

### MCTS の注意

determinization は「情報を隠す/集める価値」を見落とす。
コナンTCGの「捜査・推理」の駆け引きを過小評価する可能性あり。
顕在化したら **ISMCTS (Information Set MCTS)** へ切替検討。

## ニューラルネット系

**MVPでは却下**。
- 教師データ（人間リプレイ）がない
- self-play は MCTS の安定動作が前提
- 将来のトレーニング基盤として検討余地のみ残す

## Web Worker 設計

```
ai.worker.ts
  postMessage({state, config}) → {action, score, stats}
```

- 状態は構造化クローン可能なプレーンオブジェクト（[03-state-management.md](03-state-management.md)）
- メイン側で `AbortController` + タイムアウト保持
- boardgame.io の `ai.enumerate(G, ctx)` を内部で利用

## CPU vs CPU 観戦モード

- 両プレイヤーの AI を別 Worker で起動
- 思考過程（候補手・スコア）を UI に表示可能
- ステップ実行 / 倍速再生 / 一時停止に対応する UI 設計が必要（[../ux/](../ux/) で別途検討）

## 関連

- [03-state-management.md](03-state-management.md) - 状態の clone 戦略
- [06-test-strategy.md](06-test-strategy.md) - AI 自己対戦による回帰

## 出典

- [Ensemble Determinization MCTS for MTG (IEEE)](https://ieeexplore.ieee.org/document/6218176/)
- [Determinization and ISMCTS for Dou Di Zhu](http://orangehelicopter.com/academic/papers/cig11.pdf)
- [Evolving Evaluation Functions for CCG AI (arXiv 2105.01115)](https://arxiv.org/abs/2105.01115)
- [HearthSim/SabberStone](https://github.com/HearthSim/SabberStone)
