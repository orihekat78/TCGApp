// cards/_shared/caseTraitConditioned
// rules: 17-icons.md (条件アイコン)
// spec: .claude/specs/shared-classes/caseTraitConditioned.md
//
// 【事件特徴】 条件で内部能力を解放する wrapper。
// inner.condition に caseTrait を AND で追加した新しい AbilityDef を返す。

import type { AbilityDef } from '@/engine/types';
import type { Condition } from '@/engine/types';

export function caseTraitConditioned(opts: {
  trait: string;
  inner: AbilityDef;
}): AbilityDef {
  const traitCond: Condition = { kind: 'caseTrait', trait: opts.trait };
  const condition: Condition = opts.inner.condition
    ? { kind: 'and', cs: [traitCond, opts.inner.condition] }
    : traitCond;

  const innerRefs = opts.inner.ruleRefs ?? [];
  const ruleRefs = Array.from(new Set(['rules/17-icons.md', ...innerRefs]));

  return {
    ...opts.inner,
    condition,
    continuousModifier: opts.inner.continuousModifier?.grantKeywords
      ? { ...opts.inner.continuousModifier, printedKeywordWhenIconValid: true }
      : opts.inner.continuousModifier,
    description: `【事件${opts.trait}】${opts.inner.description ?? ''}`,
    ruleRefs,
  };
}
