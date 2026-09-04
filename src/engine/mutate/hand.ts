// engine.mutate.hand — 手札操作プリミティブ
// rules: 04-game-setup.md (マリガン), 05-turn-phases.md (手札の使用), 12-next-hint.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState, CardId } from '@/engine/types';
import { event } from '../event/index.js';
import { advanceIndexedZoneEpoch } from '../state/indexed-zone-epoch.js';

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

/**
 * 手札 → リムーブエリアへ移動 (使用済みイベント等)
 *
 * engine mega-wave W3 (2026-07-03, r17): 'hand:removed' hook を **splice 前に** per-cardId emit する
 * (cutIn の「emit を discardToRemove より前に」原則の一般化 — カードが手札に残っている時点で emit
 * すれば on-hand scope の in-play scan がそのまま拾え、virtual-location handler 不要)。
 * attribution.byPlayer = リムーブを起こした効果の起動側 (省略時 p = 自己起因)。B05115
 * 「相手の能力や効果によって」は triggerByPlayerIs{side:'opp'} が payload.byPlayer を判定。
 * attribution.viaCost = 宣言コスト由来 (rules/21「コストで行ったことでは条件を満たさない」) → emit 抑止。
 * 既存カードは本 hook 未宣言 → listener 一致 0 件 = 挙動不変。
 */
function discardToRemove(
  s: GameState,
  p: Player,
  ids: CardId[],
  attribution?: { byPlayer?: Player; viaCost?: boolean },
): CardId[] {
  const removed: CardId[] = [];
  for (const id of ids) {
    const index = s.players[p].hand.indexOf(id);
    if (index === -1) continue;
    if (attribution?.viaCost !== true) {
        event.emit(
          s,
          'hand:removed',
          { player: p, cardId: id, byPlayer: attribution?.byPlayer ?? p },
          { player: p, cardId: id },
        );
    }
    s.players[p].hand.splice(index, 1);
    removed.push(id);
  }
  if (removed.length > 0) {
    s.players[p].remove.push(...removed);
    advanceIndexedZoneEpoch(s, p, 'remove');
  }
  return removed;
}

/**
 * engine mega-wave W3 (2026-07-03, r18): 手札公開の 'hand:reveal' emit 単一ソース (remove.ts emitExit
 * と同型の payload drift 防止)。呼出 = atomHandReveal (effect 経路) + cost/pay revealFromHand (コスト経路)。
 * コスト由来も無条件 emit — B09004 印字「自分の能力や効果、【宣言】能力のコストによって」がコストを
 * 明示的に含むため (rules/21 の一般原則はカード側文言が上書きする個別ケース、hook は方法非依存)。
 * zone 不変 (公開のみ)。ids 空は no-op。
 */
function emitReveal(s: GameState, p: Player, ids: CardId[], attribution?: { byPlayer?: Player; cause?: 'effect' | 'cost' }): void {
  if (ids.length === 0) return;
  event.emit(s, 'hand:reveal', { player: p, revealed: [...ids], byPlayer: attribution?.byPlayer ?? p, cause: attribution?.cause ?? 'effect' }, { player: p });
}

/** 手札 → デッキの下へ移動 (マリガン用: rules/04) */
function toDeckBottom(s: GameState, p: Player, ids: CardId[]): void {
  remove(s, p, ids);
  s.players[p].deck.push(...ids);
  if (ids.length > 0) advanceIndexedZoneEpoch(s, p, 'deck');
}

export const hand = {
  add,
  remove,
  discardToRemove,
  toDeckBottom,
  emitReveal,
};
