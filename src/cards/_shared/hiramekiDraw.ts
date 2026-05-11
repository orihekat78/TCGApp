// cards/_shared/hiramekiDraw
// rules: 10-action-event.md, 14-refresh.md
// spec: .claude/specs/shared-classes/hiramekiDraw.md
//
// 【ヒラメキ】 N 枚ドロー。
// アクション[事件] によるリムーブ時のみ発動 (engine 側 `evidence:remove-by-action` Hook 限定)。
// デッキ0枚 → 自動リフレッシュ (rules/14)。

import type { AbilityDef } from '@/engine/types';

export function hiramekiDraw(opts?: {
  n?: number;
  abilityId?: string;
}): AbilityDef {
  const n = opts?.n ?? 1;
  return {
    id: opts?.abilityId ?? 'a_flash_draw',
    type: 'icon-flash',
    scope: 'on-evidence',
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n } },
    description: `【ヒラメキ】カードを${n}枚引く。`,
    ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
  };
}
