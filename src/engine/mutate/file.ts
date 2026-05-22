// engine.mutate.file — FILEエリア操作プリミティブ
// rules: 05-turn-phases.md, 12-next-hint.md, 13-keywords.md (アシスト)
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import { current } from '@/engine/produce';
import type { GameState, FileCard } from '@/engine/types';

type Player = 'self' | 'opp';

/**
 * デッキ上から n 枚を裏向きで FILE に push (rules/05)
 * 先攻初手は n=1, 通常 n=2 (呼出元が判定)
 * カードには順番がある: もっとも新しく置かれたカードが1番上 (push=末尾が先頭扱い)
 */
function addFromDeckTop(s: GameState, p: Player, n: number): void {
  for (let i = 0; i < n; i++) {
    const d = s.players[p].deck;
    if (d.length === 0) break; // デッキ不足は呼出元が管理
    // Round 3: ネクストヒント時に表向きで手札に渡せるよう cardId を保持
    const cardId = d.shift();
    if (cardId === undefined) break;
    const card: FileCard = { type: 'card-back', cardId };
    s.players[p].file.push(card);
  }
  // user_request 20260522_01 #4/#16 fix: FILE 7 枚以上で事件編→解決編 自動遷移
  // (rules/01 + rules/13 + rules/25)。assist() に同等 check があるが、
  // auto-phase の addFromDeckTop は経由しないため独立で必要。
  if (s.players[p].case.status === '事件編' && s.players[p].file.length >= 7) {
    s.players[p].case.status = '解決編';
  }
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

export const file = {
  addFromDeckTop,
  popTop,
  insertAssistedPartner,
  removeAssistedPartner,
};
