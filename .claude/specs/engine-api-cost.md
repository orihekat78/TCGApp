# engine.cost.* — コスト評価・支払いAPI

宣言能力 / カード使用 / アシスト等のコスト評価。
rules: [21](../rules/21-declared-ability-cost.md), [04](../rules/04-game-setup.md)

## Cost Descriptor

```typescript
type Cost =
  | { kind: 'sleepSelf' }                          // 自身をスリープ (sleep状態必要)
  | { kind: 'sleepChar'; target: TargetingRef }    // 任意キャラスリープ
  | { kind: 'removeFromHand'; target: TargetingRef; n: number }
  | { kind: 'removeFromScene'; target: TargetingRef; n: number }
  | { kind: 'removeDeckTop'; player: 'self'; n: number }      // rules/21: 自分省略
  | { kind: 'discardEvidence'; n: number }
  | { kind: 'selfToDeckBottom' }                              // 例: デッキ下に移す
  | { kind: 'pay'; items: Cost[] }                            // AND
  | { kind: 'choice'; items: Cost[] }                         // OR (プレイヤー選択)
  | { kind: 'fileFrom'; n: number }                           // FILE消費 (該当能力用)
  | { kind: 'flipFaceUpEvidence'; n: { min: number; max: number } }
                                                              // 「裏向き証拠を1つ以上表向きにする」(D08026)
                                                              // n.min=1, n.max=Infinity 等。表向きにした枚数を
                                                              // EffectCtx.costPaid['flipFaceUpEvidence'].count に格納
  | { kind: 'custom'; check: (s, ctx) => boolean; pay: (s, ctx) => void };
```

- 「:」(コロン) 左側がコスト、右側が効果 (rules/21)
- 対象省略は **自身** (例: `sleepSelf`, `selfToDeckBottom`)
- 「自分の」も省略 (相手のカードはコスト不可)

## API

```typescript
engine.cost.canPay(state, cost, ctx): boolean
  // 一部でも支払えなければ false → 能力使用不可
  // デッキ N 枚未満リムーブ系も false (rules/26)

engine.cost.pay(state, cost, ctx): PayResult
  // すべて実行。1つでも失敗したら例外 (canPay 後に呼ぶこと)
  // 戻り値: { paidItems: PaidRecord[] }

engine.cost.preview(state, cost, ctx): CostPreview
  // UI表示用 (確認モーダル)
  // { description: string, requiresChoice: boolean, choices?: ... }
```

## ⚠ 重要な裁定 — rules: [21](../rules/21-declared-ability-cost.md), [25](../rules/25-qa-effects-resolution.md)

- **コストで行ったこと** は「自分の能力や効果によって〜したとき」の **条件を満たさない**
  → `engine.cost.pay` 内の mutation は `event.emit` 時に `{ viaCost: true }` フラグを付ける
  → 該当 Hook はこのフラグを見て発動可否判定する
- 宣言能力使用は **アクティブ状態不要** (ただし sleep コストがあれば実質必要)
- 宣言能力は **登場ターンからすぐ使用可** (名乗り状態でも可、rules/24)

## アシスト固有

```typescript
engine.cost.assist.canPay(state, p): boolean   // partner active 必要
engine.cost.assist.pay(state, p): void         // sleep + FILEへ移動
engine.cost.assist.willTransition(state, p): boolean  // 結果として 7枚以上で解決編移行
```

- アシストしたターンは事件解決不可 (rules/01) → `engine.flow.canSolveCase` で判定

## ネクストヒント固有

```typescript
engine.cost.nextHint.canStart(state, p): boolean   // FILE >= 1
engine.cost.nextHint.popToHand(state, p): CardId
engine.cost.nextHint.canPlayCard(state, p, cardId): boolean
  // 1で加えたカード自身は FILE 枚数判定に含めない (rules/12)
  // 色制限あり (rules/20)
```

## 手札の使用

```typescript
engine.cost.handUse.canPlay(state, p, cardId): boolean
  // - 1ターン1回 (turnState.handUseUsed=false)
  // - ネクストヒント実施ターンは不可
  // - 色制限 (rules/20)
  // - レベル <= FILE枚数 (rules/12 由来 イベント可使用条件)
```

## 関連
- [engine-api-targeting.md](engine-api-targeting.md)
- [engine-api-conditions.md](engine-api-conditions.md)
- [engine-api-flow-control.md](engine-api-flow-control.md)
