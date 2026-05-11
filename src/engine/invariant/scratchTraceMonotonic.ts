// engine.invariant.scratchTraceMonotonic — 痕跡状態の単調性 (発見済→未発見は不可)
// rules: 13-keywords.md, 26-qa-deck-refresh.md

import type { GameState } from '@/engine/types';

type Player = 'self' | 'opp';
type TraceValue = '未発見' | '発見済';

/**
 * 痕跡状態の一方通行を確認する
 * 発見済→未発見への遷移は throw
 */
export function scratchTraceMonotonic(s: GameState, p: Player, prevV: TraceValue): void {
  const current = s.scratchTrace[p];
  if (prevV === '発見済' && current === '未発見') {
    throw new Error(
      `scratchTraceMonotonic: player ${p} trace reverted from 発見済 to 未発見 (rules/13)`,
    );
  }
}
