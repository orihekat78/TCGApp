// engine.mutate.gameResult — ゲーム結果操作プリミティブ
// rules: 01-victory-conditions.md, 14-refresh.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState } from '@/engine/types';
import { appendCausal } from '@/engine/log/causal.js';
import { isStructuredCausalResolutionActive } from '@/engine/log/effect-causal.js';
import { clearTerminalActionState } from './action-scopes.js';

// 'alt-lose': engine E3 (2026-07-02) — 「相手はゲームに敗北する」カード効果決着 (opponentLoses verb)
type WinReason = 'evidence' | 'deck-out' | 'concede' | 'alt-lose';

/**
 * ゲーム結果を設定する
 */
function set(s: GameState, winner: 'self' | 'opp', reason: WinReason): void {
  // The first terminal write owns the result. Every later write is a no-op,
  // including a contradictory winner/reason from a re-entrant effect path.
  if (s.gameResult !== undefined) return;
  // This is an engine invariant, not a UI projection: every terminal producer
  // (including deck-out and evidence) invalidates resumable action state first.
  clearTerminalActionState(s);
  s.gameResult = { winner, reason };
  if (s.causalLog !== undefined && !isStructuredCausalResolutionActive(s)) {
    appendCausal(s, {
      actor: winner,
      kind: 'game-result',
      source: { kind: 'player', side: winner },
      targets: [{ kind: 'player', side: winner === 'self' ? 'opp' : 'self' }],
      outcome: { type: 'state', state: 'success' },
    });
  }
}

/**
 * ゲーム結果をクリアする (テスト・リセット用)
 */
function clear(s: GameState): void {
  s.gameResult = undefined;
}

export const gameResult = {
  set,
  clear,
};
