// cards/_shared/hiramekiDraw
// rules: 10-action-event.md, 14-refresh.md
// spec: .claude/specs/shared-classes/hiramekiDraw.md
//
// 【ヒラメキ】 N 枚ドロー。
// アクション[事件] によるリムーブ時のみ発動 (engine 側 `evidence:remove-by-action` Hook 限定)。
// デッキ0枚 → 自動リフレッシュ (rules/14)。
//
// 2026-05-27 Option C: type:'icon-flash' から type:'triggered' + trigger:{hook,optional:true}
// に統合。fire/skip semantics は triggered listener (handleEvidenceRemovedHook) が処理。

import type { AbilityDef } from '@/engine/types';

export function hiramekiDraw(opts?: {
  n?: number;
  abilityId?: string;
}): AbilityDef {
  const n = opts?.n ?? 1;
  return {
    id: opts?.abilityId ?? 'a_flash_draw',
    type: 'triggered',
    scope: 'on-evidence',
    trigger: { hook: 'evidence:remove-by-action', optional: true }, // ヒラメキ = 任意発動
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n } },
    description: `【ヒラメキ】カードを${n}枚引く。`,
    ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
  };
}
