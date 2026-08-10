// engine.mutate.log — ゲームログ操作プリミティブ
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState, LegacyLogEntry } from '@/engine/types';
import { appendLegacyAsCausal } from '@/engine/log/causal.js';
import { isStructuredCausalResolutionActive } from '@/engine/log/effect-causal.js';

/**
 * ログエントリを追加する
 */
function append(s: GameState, entry: LegacyLogEntry): void {
  if (typeof entry === 'object' && entry !== null
    && ('schemaVersion' in entry || 'eventId' in entry)) {
    throw new Error('Causal entries must use the causal log writer, not the legacy writer');
  }
  if (s.causalLog !== undefined) {
    if (s.gameResult !== undefined) return;
    if (isStructuredCausalResolutionActive(s)) return;
    appendLegacyAsCausal(s, entry);
    return;
  }
  s.log.push(entry);
}

/**
 * ログをすべてクリアする
 */
function clear(s: GameState): void {
  s.log = [];
  delete s.causalLog;
}

export const log = {
  append,
  clear,
};
