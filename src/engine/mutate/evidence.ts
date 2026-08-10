// engine.mutate.evidence — 証拠エリア操作プリミティブ
// rules: 10-action-event.md, 11-reasoning.md, 14-refresh.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import { current } from '@/engine/produce';
import { event } from '../event/index.js'; // engine additive wave-3: evidence:removed emit (mutate/char.ts setcard:enter と同パターン)
import { remove as removeMut } from './remove.js'; // engine additive wave-4: remove:exit emit (remove→証拠 離脱)
import { deck as deckMut } from './deck.js';
import type { GameState, EvidenceCard, EvidenceOrigin, CardId } from '@/engine/types';

type Player = 'self' | 'opp';
export type DeckToEvidenceStep = { kind: 'move' | 'refresh'; count: number };

/**
 * デッキ上から n 枚を証拠エリアに追加 (rules/11 推理, rules/10 アクション[事件])
 * デッキ不足・取得後のexact exhaustionは内部で即時リフレッシュする。
 * resolvingCardId は解決中イベント/ヒラメキのremove除外用 (rules/14, 26)。
 */
function addFromDeck(
  s: GameState,
  p: Player,
  n: number,
  faceUp: boolean,
  origin: EvidenceOrigin,
  resolvingCardId?: CardId,
  onStep?: (step: DeckToEvidenceStep) => void,
): number {
  let added = 0;
  for (let i = 0; i < n; i++) {
    const d = s.players[p].deck;
    // Existing callers historically guarded only before each take. Keep the
    // initial/cross-refresh behavior here so every evidence path has one owner.
    if (d.length === 0 && !deckMut.refreshAfterTake(s, p, resolvingCardId, (count) => onStep?.({ kind: 'refresh', count }))) break;
    const cardId = d.shift()!;
    s.players[p].evidence.push({ cardId, faceUp, origin });
    added++;
    onStep?.({ kind: 'move', count: 1 });
    if (!deckMut.refreshAfterTake(s, p, resolvingCardId, (count) => onStep?.({ kind: 'refresh', count }))) break;
  }
  return added;
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
  // engine additive wave-3 (2026-06-30): 証拠リムーブ observer (原因非依存、rules/10/14)。push 後に emit。
  event.emit(s, 'evidence:removed', { player: p });
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
  // engine additive wave-3 (2026-06-30): 証拠リムーブ observer (removeTop と同観測)。
  event.emit(s, 'evidence:removed', { player: p });
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
 * 証拠カードを裏向きにする (flipFaceUp の逆)。
 * engine拡張 wave (2026-06-23): 「自分の表向きの証拠を N つまで選び、裏向きにする」(B05013/B06017/B06019)。
 * 順番 (位置) は変えない (B05013 Q&A) — faceUp フラグのみ false 化、配列位置は不変。
 */
function flipFaceDown(s: GameState, p: Player, idx: number): void {
  const ev = s.players[p].evidence;
  if (idx < 0 || idx >= ev.length) return;
  ev[idx].faceUp = false;
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
      // engine additive wave-3 (2026-06-30): 証拠リムーブ observer (ヒラメキ解決後等の remove も観測)。
      event.emit(s, 'evidence:removed', { player: p });
      return;
    }
  }
  // フォールバック: self に追加 (エラー回避)
  void evidenceList;
}

/**
 * 指定 cardId を証拠エリアに追加する (rules: イベント自身を証拠化「このカードを表向きのまま証拠として得る」)。
 * イベント使用後は handUseCard が当該カードを **リムーブエリア** へ置くため、リムーブから当該 cardId を
 * 1 枚 (最後の出現) 取り除いてから証拠へ移す。fromArea==='remove' で当該 cardId がリムーブに **無い**
 * 場合は証拠化しない (B06026 Q&A: 解決時にリムーブエリアを離れていたら「得られない」, rules/14)。
 * fromArea で取り除き元を切替 (既定 'remove' = イベント自身経路 / 'none' = handToEvidence 直接付与)。
 */
function gainCard(
  s: GameState,
  p: Player,
  cardId: string,
  faceUp: boolean,
  origin: EvidenceOrigin,
  fromArea: 'remove' | 'none' = 'remove',
): void {
  if (fromArea === 'remove') {
    const list = s.players[p].remove;
    const idx = list.lastIndexOf(cardId);
    // B06026 Q&A (rules/14): 効果解決までにリフレッシュ等で当該カードがリムーブエリアを離れていた場合、
    // 証拠として得られない。idx===-1 = source 不在 → 証拠化せず no-op で返す。
    // イベント自身経路 (handUseCard が remove へ置いた直後の同期解決) は常に idx!==-1 のため挙動不変。
    // 非同期 (キャラの【現場リムーブ時】等、B06026) でのみ idx===-1 が起こりうる。
    if (idx === -1) return;
    list.splice(idx, 1);
    removeMut.emitExit(s, p, cardId); // wave-4: remove→証拠 離脱 (原因非依存 remove:exit)
  }
  s.players[p].evidence.push({ cardId, faceUp, origin });
}

/**
 * 2026-06-06 タスクC: 証拠エリア最上部の n 枚を **デッキ上** へ戻す (元の順序を保持)。
 * 「この推理によって証拠を得ない」(B03038) の忠実実現 — addFromDeck (deck.shift→evidence.push) の逆操作。
 * net で「証拠 0・デッキ復元」(rules/11 §LP≤0「証拠を1つも得ない」と同じ状態) を作る。
 * 証拠が n 枚未満なら在る分だけ戻す。戻り値 = 実際に戻した枚数。
 */
function toDeckTop(s: GameState, p: Player, n: number): number {
  const ev = s.players[p].evidence;
  const taken: string[] = [];
  for (let i = 0; i < n && ev.length > 0; i++) {
    const cardId = ev[ev.length - 1]!.cardId; // primitive read (draft 不要)
    ev.pop();
    taken.push(cardId); // taken = [最後に得た, ...] = deck 逆順
  }
  taken.reverse(); // [deck[0], deck[1], ...] 元の deck 順に復元
  s.players[p].deck.unshift(...taken);
  return taken.length;
}

export const evidence = {
  addFromDeck,
  gainCard,
  removeTop,
  removeAt,
  flipFaceUp,
  flipFaceDown,
  toRemove,
  toDeckTop,
};
