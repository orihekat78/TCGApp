# caseDeclaredEvidenceFlip

事件カード【解決編】【宣言】【ターン1】 〚裏向き証拠を1つ以上表向き〛 コストで対象 AP 修正。

## シグネチャ

```typescript
export function caseDeclaredEvidenceFlip(opts: {
  delta: number;                           // 表向きにした証拠1つあたりの AP 修正量 (例: +1000 / -1000)
  targetFilter?: TargetFilter;             // 対象キャラフィルタ (例: { trait:'少年探偵団' })
  side?: 'self' | 'opp' | 'either';        // default: 'either'
  additionalCondition?: Condition;         // 例: 神奈川県警在場
  abilityId?: string;                      // default: 'a_case_decl_flip'
}): AbilityDef
```

## 戻り値

```typescript
{
  id: opts.abilityId ?? 'a_case_decl_flip',
  type: 'declared',
  scope: 'on-scene',
  condition: opts.additionalCondition
    ? { kind:'and', cs:[{kind:'caseStatus',status:'解決編'}, opts.additionalCondition] }
    : { kind:'caseStatus', status:'解決編' },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'flipFaceUpEvidence', n: { min: 1, max: Infinity } },
  effect: {
    kind: 'choice', chooser: 'self', options: [{
      kind: 'atom', verb: 'charModifyAP',
      args: {
        uid: '$pick',
        delta: { dyn: `cost.flipFaceUpEvidence.count * ${opts.delta}` },   // G24 dyn
        scope: 'turn',
        target: {
          kind: 'pick',
          query: { area:'scene', side: opts.side ?? 'either',
                   filter: opts.targetFilter ?? {} },
          n: { min:0, max:1 }, chooser: 'self',
        },
      },
    }],
  },
  description: `【解決編】【宣言】【ターン1】〚裏向き証拠を1つ以上表向きにする〛: AP${opts.delta>=0?'＋':'－'}${Math.abs(opts.delta)}/コスト`,
  ruleRefs: ['rules/01', 'rules/17', 'rules/19', 'rules/21', 'rules/26'],
}
```

## 出現カード

| Card | 引数 |
|------|------|
| D08026 | { delta: +1000, targetFilter: { trait:'少年探偵団' }, side:'self' } |
| D11021 | { delta: -1000, additionalCondition:{kind:'sceneHas',query:{side:'self',filter:{trait:'神奈川県警'}},nMin:1} } |

## 互換性

- delta は正/負どちらも可
- targetFilter / additionalCondition で個別カードの差分を吸収
- 将来 AP 以外 (LP 修正等) は新クラス caseDeclaredEvidenceFlipLP

## エッジケース

- 裏向き証拠 0枚: cost.canPay=false → 宣言不可 (rules/26)
- 対象 0枚: 0枚選択可 (rules/15) → 効果無し、ただし【ターン1】カウント済 (rules/24)
- AP マイナス下限なし (rules/19)

## 関連
- ルール: rules/01, rules/15, rules/19, rules/21, rules/26
- engine-api: Cost.kind 'flipFaceUpEvidence' (G17), EffectCtx.costPaid + dyn (G21/G24)
