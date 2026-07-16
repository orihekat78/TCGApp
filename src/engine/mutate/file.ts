// engine.mutate.file — FILEエリア操作プリミティブ
// rules: 05-turn-phases.md, 12-next-hint.md, 13-keywords.md (アシスト)
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import { current } from '@/engine/produce';
import type { GameState, FileCard } from '@/engine/types';
import { caseOp } from './case.js';
import { deck as deckMut } from './deck.js';
import type { CardId } from '@/engine/types';

type Player = 'self' | 'opp';

/**
 * デッキ上から n 枚を裏向きで FILE に push (rules/05)
 * 先攻初手は n=1, 通常 n=2 (呼出元が判定)
 * カードには順番がある: もっとも新しく置かれたカードが1番上 (push=末尾が先頭扱い)
 * 各取得後にデッキ0なら即時リフレッシュ。公開中カードには使用しない (rules/14, 26)。
 */
function addFromDeckTop(s: GameState, p: Player, n: number, resolvingCardId?: CardId): number {
  let added = 0;
  for (let i = 0; i < n; i++) {
    const d = s.players[p].deck;
    if (d.length === 0 && !deckMut.refreshAfterTake(s, p, resolvingCardId)) break;
    // Round 3: ネクストヒント時に表向きで手札に渡せるよう cardId を保持
    const cardId = d.shift();
    if (cardId === undefined) break;
    const card: FileCard = { type: 'card-back', cardId };
    s.players[p].file.push(card);
    added++;
    if (!deckMut.refreshAfterTake(s, p, resolvingCardId)) break;
  }
  // user_request 20260522_01 #4/#16 fix: FILE 7 枚以上で事件編→解決編 自動遷移
  // (rules/01 + rules/13 + rules/25)。assist() に同等 check があるが、
  // auto-phase の addFromDeckTop は経由しないため独立で必要。
  if (s.players[p].case.status === '事件編' && s.players[p].file.length >= 7) {
    caseOp.toResolved(s, p); // BUG-089: hook 経由で a1 (caseResolvedHandRemove) を発火させる
  }
  return added;
}

/**
 * FILEエリア最上部のカードを手札に加えて返す (rules/12 ネクストヒント)
 * アシストしているパートナーは除く
 */
function popTop(s: GameState, p: Player): FileCard | undefined {
  const file = s.players[p].file;
  if (file.length === 0) return undefined;

  // アシストしているパートナーを除外して最上部を探す
  // "最上部" = 配列の末尾 (push したものが最新)
  for (let i = file.length - 1; i >= 0; i--) {
    if (file[i].type !== 'assisted-partner') {
      const snapshot = current(file[i]) as FileCard;
      file.splice(i, 1);
      return snapshot;
    }
  }
  return undefined; // アシストパートナーのみの場合
}

/**
 * アシスト時パートナーカードを FileCard として FILE に積む (上端=末尾) (rules/13 アシスト)
 */
function insertAssistedPartner(s: GameState, p: Player): void {
  const partnerCardId = s.players[p].partner.cardId;
  const card: FileCard = { type: 'assisted-partner', cardId: partnerCardId };
  s.players[p].file.push(card);
}

/**
 * アシストパートナーを FILE から取り除く (オートフェイズでパートナーエリアへ戻す際)
 */
function removeAssistedPartner(s: GameState, p: Player): void {
  const file = s.players[p].file;
  const idx = file.findIndex(f => f.type === 'assisted-partner');
  if (idx !== -1) {
    file.splice(idx, 1);
  }
}

/**
 * FILE 最上位の非 assisted-partner カードを表向きにする (Task D E3, 2026-06-12)
 * 「相手のFILEエリアにあるカードを上から1枚表向きにする」(B09021/B09108/B09023/B09005)。
 * ⚠ 公式Q&A: 最上位が既に表向きの場合は **何も起こらない** (下のカードへ降りない)。
 * 戻り値: 'flipped' = 表向き化した / 'noop' = 対象なし or 既に表向き。
 */
function flipTop(s: GameState, p: Player): 'flipped' | 'noop' {
  const file = s.players[p].file;
  for (let i = file.length - 1; i >= 0; i--) {
    const card = file[i]!;
    if (card.type === 'assisted-partner') continue;
    if (card.faceUp === true) return 'noop'; // 既に表向き → 何も起こらない (Q&A)
    card.faceUp = true;
    return 'flipped';
  }
  return 'noop';
}

/**
 * 手札等から来た cardId を FILE の **1番下** に **表向き** で置く (engine mega-wave W1 2026-07-03, P41)。
 * 「手札を1枚FILEエリアにあるカードの1番下に表向きで移す」(B05045 a2)。
 * rules/05: push=末尾=最上部 → 1番下 = 配列先頭 = unshift。faceUp=true 固定 (テキスト「表向きで」)。
 * ⚠ FILE≥7 解決編 auto-transition check は addFromDeckTop のみ保持 (アシスト時判定 rules/13 —
 *   本 verb は「7枚以上で移行」トリガーではない。latent: 効果で 7枚到達しても即移行しない現行モデル踏襲)。
 */
function insertBottomFaceUp(s: GameState, p: Player, cardId: string): void {
  s.players[p].file.unshift({ type: 'card-back', cardId, faceUp: true });
}

export const file = {
  addFromDeckTop,
  popTop,
  flipTop,
  insertBottomFaceUp,
  insertAssistedPartner,
  removeAssistedPartner,
};
