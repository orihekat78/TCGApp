// engine.mutate.log — ゲームログ操作プリミティブ
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState, LogEntry } from '@/engine/types';

/**
 * ログエントリを追加する
 */
function append(s: GameState, entry: LogEntry): void {
  s.log.push(entry);
}

/**
 * ログをすべてクリアする
 */
function clear(s: GameState): void {
  s.log = [];
}

export const log = {
  append,
  clear,
};
