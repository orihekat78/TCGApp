# hiramekiDraw

【ヒラメキ】 N 枚ドロー。

## シグネチャ

```typescript
export function hiramekiDraw(opts?: {
  n?: number;                              // default: 1
  abilityId?: string;                      // default: 'a_flash_draw'
}): AbilityDef
```

## 戻り値

```typescript
{
  id: opts?.abilityId ?? 'a_flash_draw',
  type: 'icon-flash',
  scope: 'on-evidence',
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: opts?.n ?? 1 } },
  description: `【ヒラメキ】カードを${opts?.n ?? 1}枚引く。`,
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
}
```

## 出現カード

- D08013/D08014 (吉田歩美)
- D08024 (あら…頼もしいじゃない…)

## 互換性

- n パラメータで枚数可変 (将来 N=2 等で再利用)
- abilityId カスタマイズ可

## エッジケース

- デッキ0枚 → ドロー時自動リフレッシュ (rules/14)
- リムーブも0枚 → 敗北 (rules/14)
- 解決中のヒラメキ持ちカード自身は リムーブにない → リフレッシュ時シャッフル対象外 (rules/10)
- 「能力/効果でリムーブ」では発動しない (rules/10) — engine 側で `evidence:remove-by-action` Hook 限定

## 関連
- ルール: rules/10, rules/14
