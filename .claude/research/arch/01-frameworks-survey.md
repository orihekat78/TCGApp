# 01. フレームワーク選定

## 結論

**boardgame.io を土台として採用、効果スタックは自前実装** （部分採用方式）。

## 推奨理由

boardgame.io は turn-based ゲーム用の確立した OSS で、以下の機能が本案件に直接マッピングできる：

| 機能 | コナンTCGでの利用 |
|------|------------------|
| `phases` / `turn.stages` | オート/メイン/エンドフェイズ構造を素直に表現 |
| `setActivePlayers` | 相手プレイヤーの割り込み（ガード・カットイン）の基盤 |
| `ai.enumerate(G, ctx)` | 合法手列挙 API。CPU AI実装が大幅に簡略化 |
| 内蔵 MCTS Bot | CPU vs CPU 検証に即利用可 |
| immer 内蔵 | mutable に書く move を不変更新へ自動変換 |
| `Local()` multiplayer | CPU vs CPU テスト基盤 |
| `ctx.random` | 決定論的 RNG（リプレイ整合性確保） |

## トレードオフ

boardgame.io の最大の欠点：

- **「The Stack」型の優先権パッシングをネイティブサポートしない**
  - 関連: [Issue #828](https://github.com/boardgameio/boardgame.io/issues/828)
- → `G.effectStack` を自前で持ち、move ハンドラから操作する
- 詳細: [02-effect-stack-patterns.md](02-effect-stack-patterns.md)

## 代替案を不採用とした理由

| 代替案 | 不採用理由 |
|--------|-----------|
| 完全自前 (Zustand/XState 直接) | リプレイ・ネット同期・テスト基盤を全部書き直し |
| Redux Toolkit | カードごとの効果記述が冗長、TCG向きでない |
| Zustand 単体 | AI 探索向けの「pure reducer」契約が弱い |
| XState 単体 | 効果1個ごとに statechart を作ると爆発する |

## boardgame.io 採用時の制約

- `G` は **plain JSON のみ**
  - 使用不可: 関数 / Map / Set / Date / class インスタンス
  - 使用可: object / array / string / number / boolean / null
- ランダム性は **すべて `ctx.random` 経由** で扱う
- カードIDキー集合は Record で、順序付きはconfigured配列で表現

## 関連

- [02-effect-stack-patterns.md](02-effect-stack-patterns.md)
- [03-state-management.md](03-state-management.md)
- [07-serialization-replay.md](07-serialization-replay.md)

## 出典

- [boardgame.io 公式ドキュメント](https://boardgame.io/documentation/)
- [boardgame.io stages](https://github.com/boardgameio/boardgame.io/blob/main/docs/documentation/stages.md)
- [boardgame.io tutorial / AI enumerate](https://github.com/boardgameio/boardgame.io/blob/main/docs/documentation/tutorial.md)
- [boardgame.io immutability](https://github.com/boardgameio/boardgame.io/blob/main/docs/documentation/immutability.md)
