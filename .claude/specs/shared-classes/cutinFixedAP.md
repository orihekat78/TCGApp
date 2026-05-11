# cutinFixedAP

【カットイン】固定 AP+X (コンタクト中の攻撃キャラに付与)。

## シグネチャ

```typescript
export function cutinFixedAP(opts: {
  delta: number;                           // 例: 1000 / 2000 / -1000
  abilityId?: string;                      // default: 'a_cutin_ap'
  additionalCondition?: Condition;         // 例: 自分ターン中限定
}): AbilityDef
```

## 戻り値

```typescript
{
  id: opts.abilityId ?? 'a_cutin_ap',
  type: 'icon-cutin',
  scope: 'on-hand',
  condition: opts.additionalCondition,
  effect: {
    kind: 'atom', verb: 'charModifyAP',
    args: { uid: '$contact.byUid', delta: opts.delta, scope: 'contact' },
  },
  description: `【カットイン】AP${opts.delta >= 0 ? '＋' : '－'}${Math.abs(opts.delta)}`,
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
}
```

## 出現カード (delta 別)

| delta | カード |
|-------|-------|
| 1000 | D08015/D08016, D11013 (※D11013 は cutinConditionalDraw 拡張) |
| 2000 | D08017/D08018, D08023, D11017, D11018 |

## 互換性

- delta は number 必須 (将来 dynamic 対応するなら新クラス分岐)
- additionalCondition オプショナル追加可

## エッジケース

- 1コンタクト1枚 (rules/23) — engine 自動制御
- 色制限なし (rules/23) — 事件と異色でも使用可
- AP マイナスでも下限なし (rules/19)
- 使用後 リムーブエリア (engine 自動)
- $contact.byUid バインド = アクションした側 (ガードキャラ含む文脈時は targetUid 別途) (G21)

## 関連
- ルール: rules/09, rules/22, rules/23
- engine-api: EffectCtx.contact (G21)
