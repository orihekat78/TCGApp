# engine.effect.* — Effect Descriptor (DSL)

カード効果は **JSON シリアライズ可能** な Descriptor として記述する。
`engine.effect.run(s, descriptor, ctx)` が解釈・実行する。
TypeScript 関数で書く場合 (最終手段) は `{ kind: 'custom', fn: (s, ctx) => ... }`。

## トップレベル形

```typescript
type Effect =
  | { kind: 'sequence'; steps: Effect[] }                  // 順次
  | { kind: 'parallel'; steps: Effect[] }                  // 同時 (副作用なし統合)
  | { kind: 'choice'; options: Effect[]; chooser: 'self'|'opp'|'owner' }
  | { kind: 'optional'; effect: Effect }                   // 「〜してもよい」
  | { kind: 'conditional'; if: Condition; then: Effect; else?: Effect }
  | { kind: 'forEach'; over: Targeting; do: Effect }
  | { kind: 'replace'; trigger: TriggerRef; with: Effect } // 「代わりに〜」(rules/15 即時)
  | { kind: 'negate'; trigger: TriggerRef }                // 「〜を無効にする」(rules/15 即時)
  | { kind: 'atom'; verb: AtomVerb; args: AtomArgs }       // 末端動詞
  | { kind: 'custom'; fn: (s, ctx) => void };              // 最終手段
```

## Atom Verb 一覧 (mutate API への糖衣)

```typescript
type AtomVerb =
  // ドロー / FILE / 証拠
  | 'draw'              // { player, n }
  | 'discard'           // { player, target }
  | 'mill'              // { player, n } デッキ上をリムーブ
  | 'fileAdd'           // { player, n }
  | 'filePopToHand'     // { player } ネクストヒントの 1 部分
  | 'evidenceGain'      // { player, n }
  | 'evidenceLose'      // { player, n }
  | 'evidenceFlip'      // { player, idx }
  // 現場
  | 'sceneEnter'        // { player, cardId, named?, viaEffect? }
  | 'sceneSwitch'       // { player, cardId, removeUid }
  | 'sceneRemove'       // { uid, cause }
  | 'sceneSetState'     // { uid, state }
  | 'sceneDisguise'     // { uid, newCardId }
  // キャラ修正
  | 'charModifyAP'      // { uid, delta, scope }
  | 'charModifyLP'      // { uid, delta, scope }
  | 'charSetAP'         // 「APを X にする」 { uid, val }
  | 'charSetLP'
  | 'charOverrideAP'    // 「元のAPを 0」 { uid, val|null }
  | 'charOverrideLP'
  | 'charGrantKeyword'  // { uid, kw, scope }
  | 'charRevokeKeyword'
  | 'charDisableOriginal'
  | 'charSetTurnEffect' // { uid, key, val }
  | 'charSetCard'       // { uid, cardId, faceUp }
  | 'charStackCard'     // { uid, n }
  // パートナー / 事件
  | 'partnerAssist'     // { player }
  | 'partnerSetState'   // { player, state }
  | 'partnerSolveCase'  // { player } 勝利判定
  | 'caseToResolved'    // { player } (rules/01 一方通行)
  // フロー
  | 'startContact'      // 「コンタクトを発生させる」
  | 'endActionEarly'
  // 証拠 / 手札 (G25/G30)
  | 'evidenceToHand'    // { player, target } 自証拠を選択して手札へ (D08013)
  | 'handAddFromRemove' // { player, target } リムーブから条件カードを手札へ (D11012 ヒラメキ)
  // デッキ操作 (新規 G18/G22)
  | 'deckRevealUntil'   // { player, filter, bind, bindMatch }
                        // - 上から1枚ずつ公開し filter にマッチするまで。マッチしたカード = $bindMatch
                        // - 公開した残り = $bind.rest
                        // - 全めくりでもマッチなしなら $bindMatch=null
                        // - 公開中はリフレッシュ判定なし (rules/26)
  | 'deckToBottomBound' // { player, bindKey, order? } バインド変数を一括デッキ下
  // メタ
  | 'log'
  | 'noop';
```

## TriggerRef 形 (replace/negate 用)

「代わりに/無効にする」が指す対象 Trigger の参照。
カード能力の発火条件を表す `TriggerDef` ([engine-api-card-abilities.md](engine-api-card-abilities.md)) とは目的が異なるので別型。

```typescript
type TriggerRef =
  | { on: 'reasoning'; by?: TargetingRef }
  | { on: 'action'; by?: TargetingRef; against?: TargetingRef }
  | { on: 'contact-ap-judge' }
  | { on: 'evidence-remove' }
  | { on: 'enter'; who: TargetingRef }
  | { on: 'leave'; who: TargetingRef }
  | { on: 'refresh'; player: 'self'|'opp' }
  | { on: 'effect-resolution'; matcher: object };
```

## Scope 一覧

```typescript
type Scope = 'contact' | 'action' | 'turn' | 'opp-turn' | 'permanent' | 'until-leave';
```

## ユーティリティ Builder

```typescript
engine.effect.seq(...steps): Effect
engine.effect.choose(opts, chooser): Effect
engine.effect.may(eff): Effect           // optional
engine.effect.when(cond, then, else?): Effect
engine.effect.atom(verb, args): Effect
engine.effect.run(state, descriptor, ctx): void
engine.effect.validate(descriptor): ValidationResult   // 起動前 lint
engine.effect.serialize/deserialize(descriptor): string
```

## 使用例

```typescript
// 「【登場時】 自分の現場のキャラを1枚選びAP+1000 (このターン中)」
const onEnter = engine.effect.choose([
  engine.effect.atom('charModifyAP', { uid: '$pick', delta: 1000, scope: 'turn' }),
], 'owner');
```

## 関連
- [engine-api-targeting.md](engine-api-targeting.md) — `TargetingRef`
- [engine-api-conditions.md](engine-api-conditions.md) — `Condition`
- [engine-api-resolver.md](engine-api-resolver.md)
- [card-authoring-convention.md](card-authoring-convention.md) — 1行atom / comment-above 規約
