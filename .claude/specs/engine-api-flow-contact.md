# engine.flow.contact.* / .actionCase.* / .guard.*

コンタクト中の行動・アクション[事件]・ガード判定。
アクション全体フローは [engine-api-flow-control.md](engine-api-flow-control.md) 参照。
rules: [08](../rules/08-contact.md), [09](../rules/09-cutin-disguise.md), [10](../rules/10-action-event.md), [22](../rules/22-qa-action-contact.md), [23](../rules/23-qa-disguise-cutin.md)

## コンタクト中 行動

```typescript
engine.flow.contact.canCutIn(state, p, cardId): boolean
  // 1コンタクト1枚 (rules/23) / cardId は手札のカットイン持ち
  // 色制限なし (事件と異色OK)
engine.flow.contact.cutIn(state, p, cardId, ctx): void
  // 効果1つ選んで使用 (2つ以上持つカードは1つ選択)
  // 使用後 リムーブエリアへ

engine.flow.contact.canDisguise(state, uid, cardId): boolean
  // 手札の変装持ちで、コンタクト中の自キャラと入替可
engine.flow.contact.disguise(state, uid, cardId, ctx): void
  // 引継ぎ table:
  //   ✓ スリープ状態, ✓ コンタクト免疫, ✓ ターン終了時リムーブ,
  //   ✓ カード名書き換え効果, ✓ 特徴変更, ✓ AP/LP修正, ✓ 持続効果
  //   ✕ 元のカード名/色 (変装後のものに変わる)
  // disguise:into Hook 発火 → 変装時効果処理 → コンタクト処理 続行 (rules/23)

engine.flow.contact.pass(state, p): void
engine.flow.contact.judge(state, ax): JudgeResult
  // AP同値もリムーブ (rules/08)
  // 攻撃キャラはリムーブされない
  // ブレットならガード不可 (rules/13)

engine.flow.contact.computeOrder(aAP, bAP, attackerSide): { firstUid; secondUid }
  // AP低い側が1番目
  // 同値 → アクションされた側 (非ターンプレイヤー)が1番目
  // contact:order-set Hook の payload を生成
```

## アクション[事件] — rules: [10](../rules/10-action-event.md)

```typescript
engine.flow.actionCase.removeOpponentEvidenceTop(state, byPlayer): EvidenceCard
  // 相手証拠最上部1枚リムーブ (LP無関係)
  // evidence:remove-by-action Hook 発火 → ヒラメキ判定窓へ

engine.flow.actionCase.flashWindow(state, ev, owner): void
  // ヒラメキ持ちなら相手選択
  // 効果解決後 リムーブエリアへ
  // ヒラメキ解決中はまだリムーブエリアにない (rules/10)
  //   → リフレッシュ時のシャッフル対象外

engine.flow.actionCase.gainSelfEvidence(state, byPlayer): void
  // 自分のデッキから1枚を裏向きで証拠エリアに追加
  // 1枚固定 (LP無関係)
  // ⚠ アクション中のキャラが現場を離れても、ここまでは進める (rules/10)
```

## ガード

```typescript
engine.flow.guard.candidates(state, byUid): SceneCharacter[]
  // active 必須。名乗り状態OK (rules/24)
  // AP条件なし (rules/07)
  // ブレット持ちならガード不可 (rules/13)

engine.flow.guard.canGuard(state, target, guardUid): boolean
  // ブレット判定 + 候補判定
```

## エッジケース

| ケース | 挙動 | rules |
|--------|------|-------|
| ガードまでに攻撃/対象が離脱 | アクションその時点で終了 | [07](../rules/07-action-flow.md) |
| ガード後に攻撃元キャラが離脱 | 仕様明示なし → contact-end まで進める扱い | [22](../rules/22-qa-action-contact.md) |
| カットイン2つ持ちカード | 1つ選んで効果適用 | [09](../rules/09-cutin-disguise.md) |
| 変装後ターン終了前に離脱 | 引継ぎ「ターン終了時リムーブ」失われる | [23](../rules/23-qa-disguise-cutin.md) |
| 「コンタクトによってリムーブされない」+カットイン直リムーブ | カットインは AP 判定でないので貫通する | [23](../rules/23-qa-disguise-cutin.md) |

## 関連
- [engine-api-flow-control.md](engine-api-flow-control.md)
- [engine-api-edge-cases.md](engine-api-edge-cases.md)
