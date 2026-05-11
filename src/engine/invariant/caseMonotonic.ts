// engine.invariant.caseMonotonic — 事件状態の単調性 (解決編→事件編は不可)
// rules: 01-victory-conditions.md, 06-card-types.md

import type { GameState } from '@/engine/types';

type Player = 'self' | 'opp';
type CaseStatus = '事件編' | '解決編';

/**
 * 事件状態の一方通行を確認する
 * 解決編→事件編への遷移は throw
 */
export function caseMonotonic(s: GameState, p: Player, prevStatus: CaseStatus): void {
  const current = s.players[p].case.status;
  if (prevStatus === '解決編' && current === '事件編') {
    throw new Error(
      `caseMonotonic: player ${p} case reverted from 解決編 to 事件編 (rules/01 一方通行)`,
    );
  }
}
