// cards/_shared/caseResolvedHandRemove
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 25-qa-effects-resolution.md
// spec: .claude/specs/shared-classes/caseResolvedHandRemove.md
//
// 事件カード共通: 解決編に移行したとき 手札を N 枚リムーブ。
//
// === Hook 契約 ===
// case:to-resolved Hook (rules/01) を購読する。payload: { player: 'self' | 'opp' }。
// caseToResolved atom verb から emit される。一方通行 (rules/01: 解決編→事件編なし)
// のためゲーム中 1 回しか発火しない。

import type { AbilityDef, GameState } from '@/engine/types';

export function caseResolvedHandRemove(opts?: {
  n?: number;
  abilityId?: string;
}): AbilityDef {
  const n = opts?.n ?? 1;
  return {
    id: opts?.abilityId ?? 'a_case_resolved_handremove',
    type: 'triggered',
    scope: 'on-scene',
    trigger: {
      hook: 'case:to-resolved',
      matcher: (p: unknown, _s: GameState) => {
        if (!p || typeof p !== 'object') return false;
        const o = p as { player?: unknown };
        return o.player === 'self';
      },
    },
    effect: {
      kind: 'choice',
      chooser: 'self',
      options: [
        {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            target: {
              kind: 'pick',
              query: { area: 'hand', side: 'self' },
              n: { min: n, max: n },
              chooser: 'self',
            },
          },
        },
      ],
    },
    description: `この事件が解決編になったとき、自分は手札を${n}枚リムーブする。`,
    ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md'],
  };
}
