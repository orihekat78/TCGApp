// cards/_shared/cutinFixedAP
// rules: 09-cutin-disguise.md, 22-qa-action-contact.md, 23-qa-disguise-cutin.md
// spec: .claude/specs/shared-classes/cutinFixedAP.md
//
// 【カットイン】固定 AP+X (コンタクト中の攻撃キャラに付与)。
// $contact.byUid bind = アクションした側 (G21)。
// 1コンタクト1枚 制限は engine 側で自動制御。色制限なし。

import type { AbilityDef } from '@/engine/types';
import type { Condition } from '@/engine/types';

export function cutinFixedAP(opts: {
  delta: number;
  abilityId?: string;
  additionalCondition?: Condition;
}): AbilityDef {
  const sign = opts.delta >= 0 ? '＋' : '－';
  return {
    id: opts.abilityId ?? 'a_cutin_ap',
    type: 'icon-cutin',
    scope: 'on-hand',
    condition: opts.additionalCondition,
    effect: {
      kind: 'atom',
      verb: 'charModifyAP',
      args: { uid: '$contact.byUid', delta: opts.delta, scope: 'contact' },
    },
    description: `【カットイン】AP${sign}${Math.abs(opts.delta)}`,
    ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
  };
}
