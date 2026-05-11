# caseTraitConditioned

【事件特徴】 条件で内部能力を解放する wrapper。

## シグネチャ

```typescript
export function caseTraitConditioned(opts: {
  trait: string;                           // 例: '婚活'
  inner: AbilityDef;                       // 解放する能力
}): AbilityDef
```

## 戻り値

inner の condition に `caseTrait` を AND で追加した新しい AbilityDef を返す。

```typescript
{
  ...opts.inner,
  condition: opts.inner.condition
    ? { kind: 'and', cs: [
        { kind: 'caseTrait', trait: opts.trait },
        opts.inner.condition,
      ] }
    : { kind: 'caseTrait', trait: opts.trait },
  description: `【事件${opts.trait}】${opts.inner.description ?? ''}`,
  ruleRefs: [...new Set(['rules/17-icons.md', ...(opts.inner.ruleRefs ?? [])])],
}
```

## 出現カード

| Card | trait | inner |
|------|-------|-------|
| D11003/D11004 | 婚活 | 【宣言】【スリープ】 AP6000以下リム + 警察2枚条件 |
| D11005/D11006 | 婚活 | 【登場時】 自AP以下リム |

## 互換性

- inner に新キーがあっても spread で透過
- trait は string 必須 (将来 trait[]) のための拡張時は新クラスで分岐

## エッジケース

- 事件の特徴に該当 trait がない: 「持たない扱い」 (rules/17) → inner 効果不発動
- 事件複数特徴: いずれか1つでもマッチ で発動 (rules/17)
- 事件編→解決編で trait 変化はない → 移行後も継続

## 関連
- ルール: rules/17 (条件アイコン)
- engine-api: Condition.kind 'caseTrait' (既存)
