# hiramekiCharStun

【ヒラメキ】 キャラ1枚を選んでスリープさせる。

## シグネチャ

```typescript
export function hiramekiCharStun(opts?: {
  side?: 'self' | 'opp' | 'either';        // default: 'either'
  n?: { min: number; max: number };        // default: { min:0, max:1 }
  abilityId?: string;                      // default: 'a_flash_stun'
}): AbilityDef
```

## 戻り値

```typescript
{
  id: opts?.abilityId ?? 'a_flash_stun',
  type: 'icon-flash',
  scope: 'on-evidence',
  effect: {
    kind: 'choice', chooser: 'self', options: [{
      kind: 'atom', verb: 'sceneSetState',
      args: {
        uid: '$pick', state: 'sleep',
        target: {
          kind: 'pick',
          query: { area: 'scene', side: opts?.side ?? 'either' },
          n: opts?.n ?? { min:0, max:1 },
          chooser: 'self',
        },
      },
    }],
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
}
```

## 出現カード

- D08019/D08020 (阿笠博士)
- D11009/D11010 (萩原研二)

## 互換性

- side パラメータで対象範囲を絞れる (将来 trait/level 等の制約は別クラス hiramekiCharStunFiltered)
- n は将来 2枚以上 用に拡張可能

## エッジケース

- 対象 0枚: 0枚選択可 (rules/15)
- 対象キャラがスタン状態: スリープにならない (rules/24 スタン特殊)
- 解決中のヒラメキ持ちカードは リムーブエリアにない (rules/10) → リフレッシュ時シャッフル対象外
- 「能力/効果でリムーブ」の場合は ヒラメキ不発動 (rules/10) — `evidence:remove-by-action` Hook 限定

## 関連
- ルール: rules/03, rules/10, rules/15, rules/24
