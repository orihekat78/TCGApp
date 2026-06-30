// engine.mutate.remove — リムーブエリア操作プリミティブ
// rules: 03-field-areas.md, 14-refresh.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState, CardId } from '@/engine/types';
import { event } from '../event/index.js'; // engine additive wave-4: remove:exit emit

type Player = 'self' | 'opp';

/**
 * engine additive wave-4 (2026-07-01): リムーブエリアから離脱したカード **1枚につき** remove:exit emit。
 * 「自分のリムーブエリアにある〚特徴/種別〛のカードがリムーブエリアから離れたとき」(B05087/B05088) の観測足場。
 * payload 形 {player(=リムーブエリア所有者), cardId} を単一ソース化し、全離脱経路 (refresh / removeFromHere /
 * handAddFromRemove / removeAreaAllToDeckBottom / evidence.gainCard fromArea=remove) で payload drift を防ぐ。
 * remove:exit は **原因非依存** (リムーブ方法問わず発火、rules/17 【現場リムーブ時】類推) を契約とする。
 * ⚠ コスト由来発火 (removeAreaToDeckBottom コスト経路) を B05087/B05088 が拾うべきか (rules/21 コスト免除) は
 * card-wave 時に官報 Q&A で確定する (本 emit 自体は方法非依存に発火 = engine 側は method-agnostic で正しい)。
 * 除外: mutate/scene.ts の MR→PA redirect pop (相手ターン離脱の在場→PA 転送中の transient であり、既に
 * leave:to-remove emit 済 = リムーブエリア常駐カードの離脱ではない、rules/18①)。
 * 既存カードは remove:exit を宣言しないため emit しても queue 0 (= 挙動不変)。
 */
function emitExit(s: GameState, p: Player, cardId: CardId): void {
  event.emit(s, 'remove:exit', { player: p, cardId });
}

/**
 * リムーブエリアにカードを追加する
 */
function add(s: GameState, p: Player, ids: CardId[]): void {
  s.players[p].remove.push(...ids);
}

/**
 * リムーブエリアから指定カードを取り除く (現状の唯一の呼出は removeAreaToDeckBottom コスト経路)。
 * 実際に離脱したカード毎に remove:exit emit (idx===-1 = リムーブエリアに無いカードは emit しない)。
 */
function removeFromHere(s: GameState, p: Player, ids: CardId[]): void {
  for (const id of ids) {
    const idx = s.players[p].remove.indexOf(id);
    if (idx !== -1) {
      s.players[p].remove.splice(idx, 1);
      emitExit(s, p, id);
    }
  }
}

export const remove = {
  add,
  removeFromHere,
  emitExit,
};
