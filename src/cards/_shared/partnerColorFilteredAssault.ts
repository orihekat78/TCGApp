// cards/_shared/partnerColorFilteredAssault — engine mega-wave W4 r62 (2026-07-03)
// rules: 13-keywords.md, 17-icons.md, 24-qa-naming-stun.md
//
// 【パートナー色】で **filter 付き突撃** (「突撃[レベル4以下のキャラ]」B07096 等) を付与する
// 常時有効型能力。partnerColorKeyword の grantFilteredAssault 版 (共通クラスは破壊的変更禁止 →
// 新クラス追加で対応)。消費は read.char.filteredAssaultKeywords → action.ts namedExceptionAllowed。

import type { AbilityDef, AbilityScope, Condition, FilteredAssaultGrant } from '@/engine/types';
import type { TargetFilter } from '@/engine/types';

export function partnerColorFilteredAssault(opts: {
  color: string | string[];
  targetKind: 'char' | 'case';
  filter: TargetFilter;
  label: string;
  scope?: AbilityScope;
  additionalCondition?: Condition;
  abilityId?: string;
}): AbilityDef {
  const partnerCond: Condition = { kind: 'partnerColor', color: opts.color };
  const condition: Condition = opts.additionalCondition
    ? { kind: 'and', cs: [partnerCond, opts.additionalCondition] }
    : partnerCond;
  const colorLabel = Array.isArray(opts.color) ? opts.color.join('/') : opts.color;
  const grant: FilteredAssaultGrant = { targetKind: opts.targetKind, filter: opts.filter };

  return {
    id: opts.abilityId ?? 'a_pcfa',
    type: 'continuous',
    scope: opts.scope ?? 'on-scene',
    condition,
    continuousModifier: {
      grantFilteredAssault: [grant],
    },
    description: `【パートナー${colorLabel}】〚突撃［${opts.label}］〛`,
    ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
  };
}
