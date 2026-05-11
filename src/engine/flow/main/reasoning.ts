// engine.flow.main.doReasoning — 推理 (rules/05 05., rules/11)
//
// 概要:
//   1. アクティブな自キャラ (or パートナー) を 1 体選択
//   2. スリープ化
//   3. デッキ最上部から LP 枚を裏向きで証拠エリアに追加
//      - LP ≤ 0 の場合は 0 枚 (rules/11)
//
// 制限:
//   - 名乗り状態 (isNamed) は推理不可 (rules/11)
//   - 例外: 迅速 持ちは名乗り状態でも推理可 (rules/13)
//   - スリープ / スタンは推理不可
//
// Phase 4 境界:
//   - reasoning:declare → reasoning:before-add → reasoning:end Hook を emit
//   - LP は read.char.lp で取得 (override 反映済み)
//   - 証拠加算は mutate.evidence.addFromDeck で行う
//   - mislead 等は Phase 5 で reasoning:before-add listener として実装される
//     → Phase 4 は emit のみ、解決待機状態を作らない (呼出元が runAllUntilEmpty を回す)

import type { GameState, SceneCharacter, PartnerOnBoard } from '../../types/index.js';
import { mutate } from '../../mutate/index.js';
import { event } from '../../event/index.js';
import { char as readChar } from '../../read/char.js';
import { def as readDef } from '../../read/def.js';

/**
 * uid から対象を探す。パートナーは "partner:self" / "partner:opp" の形式で扱う。
 */
function findTarget(
  state: GameState,
  uid: string,
): { kind: 'char'; char: SceneCharacter; player: 'self' | 'opp' } |
   { kind: 'partner'; partner: PartnerOnBoard; player: 'self' | 'opp' } | null {
  // partner:self / partner:opp 形式の判定
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const p = uid === 'partner:self' ? 'self' : 'opp';
    return { kind: 'partner', partner: state.players[p].partner, player: p };
  }
  for (const p of ['self', 'opp'] as const) {
    const c = state.players[p].scene.find(c => c.uid === uid);
    if (c) return { kind: 'char', char: c, player: p };
  }
  return null;
}

/**
 * canReason — 推理可能か判定する。
 *
 * - 対象キャラ / パートナーが存在
 * - active 状態
 * - キャラの場合: 名乗りなし or 迅速持ち (rules/11, 13)
 * - パートナーの場合: 名乗り状態の概念なし (rules/06) → active なら常に可
 */
export function canReason(state: GameState, uid: string): boolean {
  const t = findTarget(state, uid);
  if (!t) return false;
  if (t.kind === 'partner') {
    return t.partner.state === 'active';
  }
  // char
  if (t.char.state !== 'active') return false;
  if (t.char.isNamed) {
    // 名乗り状態: 迅速持ちのみ可
    return readChar.hasKeyword(state, uid, '迅速');
  }
  return true;
}

/**
 * パートナーの LP を CardDef から取得する (Phase 4 簡易版)
 *   - Phase 5 で read.partner.lp 等の整備時に置き換え予定
 */
function partnerLP(state: GameState, p: 'self' | 'opp'): number {
  const cardId = state.players[p].partner.cardId;
  if (!cardId) return 0;
  return readDef.card(cardId)?.lp ?? 0;
}

/**
 * doReasoning — 推理を実行する。
 *
 * - reasoning:declare → スリープ化 → reasoning:before-add → 証拠追加 → reasoning:end
 * - LP は max(0, lp) で証拠枚数を決定 (rules/11)
 *
 * Phase 4 注意:
 *   - reasoning:before-add で mislead 等が listener として LP を下げる Effect を
 *     queue する想定。Phase 4 は Hook 発火のみ — 解決は呼出元が runAllUntilEmpty を実行。
 *   - LP 取得は emit 後の現時点の状態を参照する (発火→pendingに積まれる)。
 *     Phase 5 で listener を 即時解決 (replace/直接 LP 修正) に切替できるよう設計。
 */
export function doReasoning(state: GameState, uid: string): void {
  if (!canReason(state, uid)) {
    throw new Error(`doReasoning: not allowed for uid=${uid}`);
  }
  const t = findTarget(state, uid)!;
  const player = t.player;

  // reasoning:declare
  event.emit(state, 'reasoning:declare', { uid, player }, { player, uid });

  // スリープ化
  if (t.kind === 'char') {
    mutate.scene.setState(state, uid, 'sleep');
  } else {
    mutate.partner.setState(state, player, 'sleep');
  }

  // reasoning:before-add (mislead 等が ここで listener として LP を下げる)
  event.emit(state, 'reasoning:before-add', { uid, player }, { player, uid });

  // LP 取得 → max(0, LP) 枚を証拠に追加
  const lp = t.kind === 'char' ? readChar.lp(state, uid) : partnerLP(state, player);
  const lpToUse = Math.max(0, lp);
  if (lpToUse > 0) {
    mutate.evidence.addFromDeck(state, player, lpToUse, false, {
      turn: state.turn.number,
      via: 'reasoning',
      sourceCardId: t.kind === 'char' ? t.char.cardId : t.partner.cardId,
    });
  }

  // ログ + reasoning:end
  mutate.log.append(state, {
    ts: Date.now(),
    player,
    turn: state.turn.number,
    action: 'reasoning',
    target: uid,
    result: `evidence+${lpToUse}`,
  });
  event.emit(state, 'reasoning:end', { uid, player, gained: lpToUse }, { player, uid });
}
