# partnerColorKeyword

【パートナー色】 で キーワード付与する常時有効型能力。

## シグネチャ

```typescript
export function partnerColorKeyword(opts: {
  color: string | string[];
  kw: string;                              // '突撃' | '迅速' | '突撃[キャラ]' | etc
  scope?: AbilityScope;                    // default: 'on-scene'
  additionalCondition?: Condition;         // 追加条件 (例: 解決編限定)
  abilityId?: string;                      // default: 'a_pck_<kw>'
}): AbilityDef
```

## 戻り値

```typescript
{
  id: opts.abilityId ?? `a_pck_${opts.kw}`,
  type: 'continuous',
  scope: opts.scope ?? 'on-scene',
  condition: opts.additionalCondition
    ? { kind:'and', cs:[{ kind:'partnerColor', color: opts.color }, opts.additionalCondition] }
    : { kind:'partnerColor', color: opts.color },
  continuousModifier: {
    grantKeywords: () => [opts.kw],
  },
  description: `【パートナー${Array.isArray(opts.color) ? opts.color.join('/') : opts.color}】〚${opts.kw}〛`,
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
}
```

## 出現カード

| Card | 引数 |
|------|------|
| D08009/D08010 | { color:'青', kw:'突撃' } |
| D08022 | { color:'青', kw:'迅速' } |
| D11007/D11008 | { color:'黄', kw:'突撃' } |
| D11009/D11010 | { color:'黄', kw:'突撃[キャラ]' } |
| D11011 | { color:'黄', kw:'迅速', additionalCondition:{kind:'caseStatus',status:'解決編'} } |

## 互換性

- 後方互換: opts に新 オプショナルキー追加のみ可
- 破壊禁止: color/kw 必須を維持

## エッジケース

- パートナー色失効 (相手側が事件破壊等で色変動): keyword 失効 (rules/24)。ただし開始済アクション継続 (rules/22)
- スタン状態のキャラ: キーワードは付与されるが行動不可

## 関連
- ルール: rules/13, rules/17, rules/24
- engine-api: continuousModifier (G23)
