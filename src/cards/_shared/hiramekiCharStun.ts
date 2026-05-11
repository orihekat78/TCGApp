// cards/_shared/hiramekiCharStun
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 24-qa-naming-stun.md
// spec: .claude/specs/shared-classes/hiramekiCharStun.md
//
// 【ヒラメキ】 キャラ1枚を選んでスリープさせる。
// アクション[事件] によるリムーブ時のみ発動 (engine 側 `evidence:remove-by-action` Hook 限定)。
// スタン状態のキャラはスリープにならない (rules/24 スタン特殊)。

import type { AbilityDef } from '@/engine/types';

export function hiramekiCharStun(opts?: {
  side?: 'self' | 'opp' | 'either';
  n?: { min: number; max: number };
  abilityId?: string;
}): AbilityDef {
  return {
    id: opts?.abilityId ?? 'a_flash_stun',
    type: 'icon-flash',
    scope: 'on-evidence',
    effect: {
      kind: 'choice',
      chooser: 'self',
      options: [
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$pick',
            state: 'sleep',
            target: {
              kind: 'pick',
              query: { area: 'scene', side: opts?.side ?? 'either' },
              n: opts?.n ?? { min: 0, max: 1 },
              chooser: 'self',
            },
          },
        },
      ],
    },
    description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
    ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
  };
}
