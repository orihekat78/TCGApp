// engine.mutate.case — 事件カード操作プリミティブ
// rules: 01-victory-conditions.md, 06-card-types.md, 13-keywords.md (アシスト)
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState } from '@/engine/types';

type Player = 'self' | 'opp';

/**
 * 事件カードを初期配置する (Phase 4 setup, rules/04, 06)
 * - cardId を設定
 * - status='事件編' (初期)
 * - colors を設定
 * - requiredEvidence は呼出元が後で setFirstPlayer 時に確定
 */
function init(s: GameState, p: Player, cardId: string, colors: string[]): void {
  s.players[p].case.cardId = cardId;
  s.players[p].case.status = '事件編';
  s.players[p].case.colors = colors;
}

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
  init,
  toResolved,
};
