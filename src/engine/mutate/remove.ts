// engine.mutate.remove — リムーブエリア操作プリミティブ
// rules: 03-field-areas.md, 14-refresh.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState, CardId } from '@/engine/types';

type Player = 'self' | 'opp';

/**
 * リムーブエリアにカードを追加する
 */
function add(s: GameState, p: Player, ids: CardId[]): void {
  s.players[p].remove.push(...ids);
}

/**
 * リムーブエリアから指定カードを取り除く (効果による回収等)
 */
function removeFromHere(s: GameState, p: Player, ids: CardId[]): void {
  for (const id of ids) {
    const idx = s.players[p].remove.indexOf(id);
    if (idx !== -1) {
      s.players[p].remove.splice(idx, 1);
    }
  }
}

export const remove = {
  add,
  removeFromHere,
};
