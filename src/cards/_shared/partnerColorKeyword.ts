// cards/_shared/partnerColorKeyword
// rules: 13-keywords.md, 17-icons.md, 24-qa-naming-stun.md
// spec: .claude/specs/shared-classes/partnerColorKeyword.md
//
// 【パートナー色】 で キーワード付与する常時有効型能力。
// 共通クラスは破壊的変更禁止。新パターンは新クラスを追加して対応。

import type { AbilityDef, AbilityScope } from '@/engine/types';
import type { Condition } from '@/engine/types';

export function partnerColorKeyword(opts: {
  color: string | string[];
  kw: string;
  scope?: AbilityScope;
  additionalCondition?: Condition;
  abilityId?: string;
}): AbilityDef {
  const partnerCond: Condition = { kind: 'partnerColor', color: opts.color };
  const condition: Condition = opts.additionalCondition
    ? { kind: 'and', cs: [partnerCond, opts.additionalCondition] }
    : partnerCond;

  const colorLabel = Array.isArray(opts.color) ? opts.color.join('/') : opts.color;

  return {
    id: opts.abilityId ?? `a_pck_${opts.kw}`,
    type: 'continuous',
    scope: opts.scope ?? 'on-scene',
    condition,
    continuousModifier: {
      grantKeywords: () => [opts.kw], printedKeywordWhenIconValid: true,
    },
    description: `【パートナー${colorLabel}】〚${opts.kw}〛`,
    ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
  };
}
