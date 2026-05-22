// cards/_shared/caseDeclaredEvidenceFlip
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md,
//        19-special-rules.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
// spec: .claude/specs/shared-classes/caseDeclaredEvidenceFlip.md
//
// 事件カード【解決編】【宣言】【ターン1】
// 〚裏向き証拠を1つ以上表向き〛 コストで対象 AP 修正。
// dyn: `cost.flipFaceUpEvidence.count * <delta>` で表向きにした証拠枚数を乗ずる。

import type { AbilityDef } from '@/engine/types';
import type { Condition, TargetFilter } from '@/engine/types';

export function caseDeclaredEvidenceFlip(opts: {
  delta: number;
  targetFilter?: TargetFilter;
  side?: 'self' | 'opp' | 'either';
  additionalCondition?: Condition;
  abilityId?: string;
}): AbilityDef {
  const baseCond: Condition = { kind: 'caseStatus', status: '解決編' };
  const condition: Condition = opts.additionalCondition
    ? { kind: 'and', cs: [baseCond, opts.additionalCondition] }
    : baseCond;

  const sign = opts.delta >= 0 ? '＋' : '－';

  return {
    id: opts.abilityId ?? 'a_case_decl_flip',
    type: 'declared',
    // user_request 20260522_01 #5 fix: 事件カードは 'case' area 所在のため
    // 'on-scene' scope だと UI の declared ability 列挙で弾かれて発動不能。
    // 条件 (caseStatus: '解決編') で適切に gate されるため 'always' で OK。
    scope: 'always',
    condition,
    limit: { kind: 'turn', n: 1 },
    cost: { kind: 'flipFaceUpEvidence', n: { min: 1, max: Infinity } },
    effect: {
      kind: 'choice',
      chooser: 'self',
      options: [
        {
          kind: 'atom',
          verb: 'charModifyAP',
          args: {
            uid: '$pick',
            delta: { dyn: `cost.flipFaceUpEvidence.count * ${opts.delta}` },
            scope: 'turn',
            target: {
              kind: 'pick',
              query: {
                area: 'scene',
                side: opts.side ?? 'either',
                filter: opts.targetFilter ?? {},
              },
              n: { min: 0, max: 1 },
              chooser: 'self',
            },
          },
        },
      ],
    },
    description: `【解決編】【宣言】【ターン1】〚裏向き証拠を1つ以上表向きにする〛: AP${sign}${Math.abs(opts.delta)}/コスト`,
    ruleRefs: ['rules/01', 'rules/17', 'rules/19', 'rules/21', 'rules/26'],
  };
}
