# caseResolvedHandRemove

事件カード共通: 解決編に移行したとき 手札を N 枚リムーブ。

## シグネチャ

```typescript
export function caseResolvedHandRemove(opts?: {
  n?: number;                              // default: 1
  abilityId?: string;                      // default: 'a_case_resolved_handremove'
}): AbilityDef
```

## 戻り値

```typescript
{
  id: opts?.abilityId ?? 'a_case_resolved_handremove',
  type: 'triggered',
  scope: 'on-scene',                       // 事件は事件エリア固定
  trigger: {
    hook: 'effect:resolve:end',
    matcher: (p, s) =>
      p.kind === 'case-resolved' && p.player === 'self',
  },
  effect: {
    kind: 'choice', chooser: 'self', options: [{
      kind: 'atom', verb: 'discard',
      args: {
        player: 'self',
        target: {
          kind: 'pick',
          query: { area: 'hand', side: 'self' },
          n: { min: opts?.n ?? 1, max: opts?.n ?? 1 },
          chooser: 'self',
        },
      },
    }],
  },
  description: 'この事件が解決編になったとき、自分は手札を1枚リムーブする。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md'],
}
```

## 出現カード

- D08026 (青の古城探索事件)
- D11021 (千速と重悟の婚活パーティー)

## 互換性

- n オプショナルで枚数可変
- 一方通行: 解決編→事件編なし (rules/01) ので再発動の心配なし

## エッジケース

- 手札 N 枚未満: 必須効果「リムーブする」だが「可能な限り行う」(rules/15) → 残数のみリム
- アシスト直後の解決編移行: a1 はその場で発動 (rules/25 拒否不可)
- 手札0枚: 0枚リムーブで「発動した扱い」 (rules/24)

## 関連
- ルール: rules/01, rules/15, rules/25
