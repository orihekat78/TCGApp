// engine.mutate.hand — 手札操作プリミティブ
// rules: 04-game-setup.md (マリガン), 05-turn-phases.md (手札の使用), 12-next-hint.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState, CardId } from '@/engine/types';

type Player = 'self' | 'opp';

/** 手札にカードを追加する */
function add(s: GameState, p: Player, ids: CardId[]): void {
  s.players[p].hand.push(...ids);
}

/**
 * 手札から指定 ID のカードを削除する
 * 同じ ID が複数ある場合は最初の1枚のみ削除
 */
function remove(s: GameState, p: Player, ids: CardId[]): void {
  for (const id of ids) {
    const idx = s.players[p].hand.indexOf(id);
    if (idx !== -1) {
      s.players[p].hand.splice(idx, 1);
    }
  }
}

/** 手札 → リムーブエリアへ移動 (使用済みイベント等) */
function discardToRemove(s: GameState, p: Player, ids: CardId[]): void {
  remove(s, p, ids);
  s.players[p].remove.push(...ids);
}

/** 手札 → デッキの下へ移動 (マリガン用: rules/04) */
function toDeckBottom(s: GameState, p: Player, ids: CardId[]): void {
  remove(s, p, ids);
  s.players[p].deck.push(...ids);
}

export const hand = {
  add,
  remove,
  discardToRemove,
  toDeckBottom,
};
