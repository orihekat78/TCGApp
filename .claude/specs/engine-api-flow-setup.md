# engine.flow.setup.* — ゲーム開始フロー API

ゲーム開始時の準備〜マリガン〜先攻決定〜表向き化〜Game Start。
rules: [04](../rules/04-game-setup.md)

## ゲーム開始シーケンス

```text
1. setup.init(deckA, deckB)
   - 各プレイヤーのパートナー/事件を裏向きで配置
   - デッキシャッフル
2. setup.decideFirstPlayer(method)
   - 'random' (じゃんけん同等) / 'manual' (UI選択)
3. setup.dealOpeningHand(p)
   - デッキから5枚ドローして手札へ
4. setup.mulligan(p, idsToReturn)
   - 先攻が先に決定 → 後攻が決定
   - 戻したカードはデッキシャッフル → 同枚数引く
5. setup.reveal()
   - 事件/パートナーを表向きにする
6. setup.startGame()
   - Game Start! → flow.startTurn(firstPlayer) へ移行
```

## API

```typescript
engine.flow.setup.init(state, decks: { self: Deck; opp: Deck }): void
  // パートナー/事件を裏向きでエリアに配置 (まだ表向きにしない)
  // requiredEvidence は後で setFirstPlayer 時に確定 (先攻7/後攻6)

engine.flow.setup.decideFirstPlayer(state, method: 'random'|'manual', chosen?): 'self'|'opp'
  // method='random' → engine.rng で決定
  // 戻り値: 先攻プレイヤー
  // 副作用: turn.player = 先攻, turn.number = 1, isFirstPlayerFirstTurn = true
  // requiredEvidence を 先攻=7 / 後攻=6 で設定

engine.flow.setup.dealOpeningHand(state, p): CardId[]
  // デッキから5枚ドローして手札へ (rules/04)

engine.flow.setup.canMulligan(state, p): boolean
  // 1ゲーム1回のみ (mulliganUsed フラグ)

engine.flow.setup.mulligan(state, p, idsToReturn: CardId[]): CardId[]
  // 1. ids を手札からデッキへ戻す
  // 2. デッキシャッフル
  // 3. 同枚数を引き直し (引き直しはデッキトップから, 選択不可)
  // 戻り値: 引き直したカード
  // mulliganUsed=true 設定
  // ⚠ 順序: 先攻プレイヤーが先に決定 → 後攻が決定 (UI 側で順序強制)

engine.flow.setup.reveal(state): void
  // 事件/パートナーを表向き化

engine.flow.setup.startGame(state): void
  // Game Start! ログ出力 → flow.startTurn(firstPlayer)
```

## State 初期化詳細

```typescript
engine.mutate.case.init(state, p, caseDef): void
  // status='事件編', requiredEvidence=先攻7|後攻6, colors=caseDef.colors
engine.mutate.partner.init(state, p, partnerDef): void
  // state='active', location='partner-area' で配置
```

## 内部 RNG

```typescript
engine.rng.seed(seed: string): void                 // 再現性確保
engine.rng.next(): number                           // [0,1)
engine.rng.shuffle<T>(arr: T[]): T[]                // Fisher-Yates
engine.rng.choice<T>(arr: T[]): T
```

- リプレイ/AI再現性のため seed を保持
- ゲーム開始時に `seed` を設定。以後の全ランダムはこの RNG を使う

## エッジケース — rules: [04](../rules/04-game-setup.md), [02](../rules/02-deck-construction.md)

| ケース | 挙動 |
|--------|------|
| デッキ40枚未満 | `setup.init` 例外 |
| パートナー/事件が0枚 | `setup.init` 例外 |
| 同IDカード4枚以上 | `setup.init` 例外 (rules/02) |
| マリガン2回試行 | `canMulligan` → false → 拒否 |
| マリガン後手札0枚 (5枚全戻し) | 仕様上可。デッキから5枚再ドロー |

## 関連
- [engine-api-flow-control.md](engine-api-flow-control.md)
- [engine-api-state-mutate.md](engine-api-state-mutate.md)
- [ui-game-setup-flows.md](2026-05-11-ui-game-setup-flows.md)
