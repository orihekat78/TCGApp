// engine.mutate.scratchTrace — 痕跡状態操作プリミティブ
// rules: 13-keywords.md (痕跡), 26-qa-deck-refresh.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState } from '@/engine/types';

type Player = 'self' | 'opp';
type TraceValue = '未発見' | '発見済';

/**
 * 痕跡状態を設定する (rules/13)
 * 一方通行ではないが invariant で保護 (発見済→未発見はエラー)
 */
function set(s: GameState, p: Player, v: TraceValue): void {
  s.scratchTrace[p] = v;
}

export const scratchTrace = {
  set,
};
