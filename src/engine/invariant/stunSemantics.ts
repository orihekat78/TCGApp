// engine.invariant.stunSemantics — スタン状態のセマンティクス確認
// rules: 03-field-areas.md (スタン特殊挙動)

import type { GameState } from '@/engine/types';

type CharState = 'active' | 'sleep' | 'stun';

/**
 * スタン状態でアクティブ化を試みた場合の挙動を確認する
 * - beforeState が 'stun' かつ attempted が 'active' の場合、
 *   結果は 'sleep' でなければならない (スタン特殊挙動)
 */
export function stunSemantics(
  s: GameState,
  uid: string,
  attempted: CharState,
  beforeState: CharState,
): void {
  if (beforeState !== 'stun' || attempted !== 'active') return;

  // スタン状態でアクティブ化を試みた → スリープになるはず
  let currentState: CharState | undefined;
  for (const p of ['self', 'opp'] as const) {
    const char = s.players[p].scene.find(c => c.uid === uid);
    if (char) {
      currentState = char.state;
      break;
    }
  }

  if (currentState === undefined) return; // キャラが見つからない (現場を離れた等)

  if (currentState !== 'sleep') {
    throw new Error(
      `stunSemantics: uid=${uid} was stun, attempted=active, but current state is '${currentState}' (expected 'sleep') (rules/03)`,
    );
  }
}
