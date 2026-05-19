// cards/_shared/eventRemoveByAP
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
// spec: .claude/specs/shared-classes/eventRemoveByAP.md
//
// イベントカード共通: 「AP X 以下のキャラを 1枚まで選びリムーブ」 効果。
// cause:'effect' → 「コンタクトによってリムーブされない」効果を貫通。
//
// === Phase 5 契約 ===
// trigger.matcher は `effect:declared` の payload shape `{ kind: 'event-use' }` を
// 期待する。これは engine resolver が emit する契約として本ファイルで定義する。
// Phase 6 (resolver wiring) で実装側を整合させる。

import type { AbilityDef, GameState } from '@/engine/types';
import type { Condition } from '@/engine/types';

export function eventRemoveByAP(opts: {
  apMax: number;
  side?: 'self' | 'opp' | 'either';
  additionalCondition?: Condition;
  state?: ('active' | 'sleep' | 'stun')[];
  abilityId?: string;
}): AbilityDef {
  return {
    id: opts.abilityId ?? 'a_event_remove_ap',
    type: 'triggered',
    scope: 'on-hand',
    trigger: {
      hook: 'effect:declared',
      selfOnly: true,
      matcher: (p: unknown, _s: GameState) => {
        if (!p || typeof p !== 'object') return false;
        return (p as { kind?: unknown }).kind === 'event-use';
      },
    },
    condition: opts.additionalCondition,
    effect: {
      kind: 'choice',
      chooser: 'self',
      options: [
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            uid: '$pick',
            cause: 'effect',
            target: {
              kind: 'pick',
              query: {
                area: 'scene',
                side: opts.side ?? 'either',
                filter: { apMax: opts.apMax },
                state: opts.state,
              },
              n: { min: 0, max: 1 },
              chooser: 'self',
            },
          },
        },
      ],
    },
    description: `AP${opts.apMax}以下のキャラを1枚まで選び、リムーブする。`,
    ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
  };
}
