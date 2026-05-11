// engine.mutate.case — 事件カード操作プリミティブ
// rules: 01-victory-conditions.md, 06-card-types.md, 13-keywords.md (アシスト)
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState } from '@/engine/types';

type Player = 'self' | 'opp';

/**
 * 事件編→解決編への移行 (rules/01)
 * 一方通行: 解決編→事件編は不可
 * 既に解決編なら no-op
 */
function toResolved(s: GameState, p: Player): void {
  if (s.players[p].case.status === '解決編') return;
  s.players[p].case.status = '解決編';
}

export const caseOp = {
  toResolved,
};
