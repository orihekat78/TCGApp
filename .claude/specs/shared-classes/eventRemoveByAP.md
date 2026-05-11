# eventRemoveByAP

イベントカード共通: 「AP X 以下のキャラを 1枚まで選びリムーブ」 効果。

## シグネチャ

```typescript
export function eventRemoveByAP(opts: {
  apMax: number;                           // 例: 8000
  side?: 'self' | 'opp' | 'either';        // default: 'either'
  additionalCondition?: Condition;         // 例: 【パートナー青】
  state?: ('active'|'sleep'|'stun')[];     // 状態指定 (例: スリープ限定)
  abilityId?: string;                      // default: 'a_event_remove_ap'
}): AbilityDef
```

## 戻り値

```typescript
{
  id: opts.abilityId ?? 'a_event_remove_ap',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', matcher: (p,s) => p.kind === 'event-use' },
  condition: opts.additionalCondition,
  effect: {
    kind: 'choice', chooser: 'self', options: [{
      kind: 'atom', verb: 'sceneRemove',
      args: {
        uid: '$pick', cause: 'effect',
        target: {
          kind: 'pick',
          query: {
            area: 'scene', side: opts.side ?? 'either',
            filter: { apMax: opts.apMax },
            state: opts.state,
          },
          n: { min: 0, max: 1 }, chooser: 'self',
        },
      },
    }],
  },
  description: `AP${opts.apMax}以下のキャラを1枚まで選び、リムーブする。`,
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
}
```

## 出現カード

| Card | 引数 |
|------|------|
| D08025 (蘭の一撃) | { apMax: 8000, additionalCondition:{kind:'partnerColor',color:'青'} } |
| D11020 (18の想起) a1 | { apMax: 9999, state:['sleep'], (level7以下追加 → 別フィルタ要) } |
| D11020 a2 | { apMax: 8000, additionalCondition:{kind:'removeTraitAtLeast',player:'self',trait:'神奈川県警',n:3} } |

## 互換性

- apMax 必須・追加 filter は side/state で吸収
- 「AP+レベル」など複合フィルタが必要なら新クラス eventRemoveByAPLevel
- 「コンタクトによってリムーブされない」効果は AP判定でない (cause:'effect') ので貫通

## エッジケース

- 対象 0枚: 0枚選択可 (rules/15) → 効果無し
- 自陣のキャラも対象可 (side:'either')
- 使用後 リムーブエリア (engine 自動)
- 条件不成立: 「能力/効果を持っていない扱い」(rules/17) → 効果無し

## 関連
- ルール: rules/09, rules/15, rules/17, rules/19
