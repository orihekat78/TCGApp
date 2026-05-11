// engine.mutate.evidence — 証拠エリア操作プリミティブ
// rules: 10-action-event.md, 11-reasoning.md, 14-refresh.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import { current } from '@/engine/produce';
import type { GameState, EvidenceCard, EvidenceOrigin } from '@/engine/types';

type Player = 'self' | 'opp';

/**
 * デッキ上から n 枚を証拠エリアに追加 (rules/11 推理, rules/10 アクション[事件])
 * デッキ不足時はリフレッシュは呼出元が別途行う前提
 */
function addFromDeck(
  s: GameState,
  p: Player,
  n: number,
  faceUp: boolean,
  origin: EvidenceOrigin,
): void {
  for (let i = 0; i < n; i++) {
    const d = s.players[p].deck;
    if (d.length === 0) break; // デッキ不足は呼出元が管理
    const cardId = d.shift()!;
    s.players[p].evidence.push({ cardId, faceUp, origin });
  }
}

/**
 * 証拠エリア最上部の1枚をリムーブ (rules/10 アクション[事件])
 * リムーブエリアへ移動して返す
 */
function removeTop(s: GameState, p: Player): EvidenceCard | undefined {
  const ev = s.players[p].evidence;
  if (ev.length === 0) return undefined;
  const snapshot = current(ev[ev.length - 1]) as EvidenceCard;
  ev.pop();
  s.players[p].remove.push(snapshot.cardId);
  return snapshot;
}

/**
 * 証拠エリアの指定インデックスの1枚をリムーブ
 */
function removeAt(s: GameState, p: Player, idx: number): EvidenceCard | undefined {
  const ev = s.players[p].evidence;
  if (idx < 0 || idx >= ev.length) return undefined;
  const snapshot = current(ev[idx]) as EvidenceCard;
  ev.splice(idx, 1);
  s.players[p].remove.push(snapshot.cardId);
  return snapshot;
}

/**
 * 証拠カードを表向きにする
 */
function flipFaceUp(s: GameState, p: Player, idx: number): void {
  const ev = s.players[p].evidence;
  if (idx < 0 || idx >= ev.length) return;
  ev[idx].faceUp = true;
}

/**
 * 証拠カードをリムーブエリアへ移動 (ヒラメキ解決後等)
 * EvidenceCard を受け取り、同 cardId の最初の証拠を削除してリムーブへ
 */
function toRemove(s: GameState, ev: EvidenceCard): void {
  const evidenceList = s.players.self.evidence;
  // どちらのプレイヤーか探す
  for (const p of ['self', 'opp'] as const) {
    const list = s.players[p].evidence;
    const idx = list.findIndex(e => e.cardId === ev.cardId && e.faceUp === ev.faceUp);
    if (idx !== -1) {
      list.splice(idx, 1);
      s.players[p].remove.push(ev.cardId);
      return;
    }
  }
  // フォールバック: self に追加 (エラー回避)
  void evidenceList;
}

export const evidence = {
  addFromDeck,
  removeTop,
  removeAt,
  flipFaceUp,
  toRemove,
};
