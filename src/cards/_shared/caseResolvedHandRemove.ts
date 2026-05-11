// cards/_shared/caseResolvedHandRemove
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 25-qa-effects-resolution.md
// spec: .claude/specs/shared-classes/caseResolvedHandRemove.md
//
// 事件カード共通: 解決編に移行したとき 手札を N 枚リムーブ。
//
// === Phase 5 契約 ===
// trigger.matcher は payload shape `{ kind: 'case-resolved', player: 'self' }` を
// 期待する。これは engine.mutate.case.toResolved が effect:resolve:end Hook に
// emit する契約として本ファイルで定義する。Phase 6 (resolver wiring) で
// 実装側を整合させる。
//
// 一方通行: 解決編→事件編なし (rules/01) → 再発動の心配なし。

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
      hook: 'effect:resolve:end',
      matcher: (p: unknown, _s: GameState) => {
        if (!p || typeof p !== 'object') return false;
        const o = p as { kind?: unknown; player?: unknown };
        return o.kind === 'case-resolved' && o.player === 'self';
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
