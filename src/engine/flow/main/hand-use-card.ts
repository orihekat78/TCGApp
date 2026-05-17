// engine.flow.main.handUseCard — 手札の使用 (rules/05 01.)
// rules: 05-turn-phases.md, 12-next-hint.md, 20-color-and-switch.md, 17-icons.md (FILE 枚数)
//
// 条件:
//   - cardId が手札にある
//   - turnFlags.handUseUsed === false (1 ターン 1 回制限)
//   - turnFlags.nextHintUsed === false (rules/05: ネクストヒントを行ったターンは不可)
//   - カードの色 ⊆ 事件の色 (rules/20)
//   - カードのレベル ≤ FILE 枚数 (rules/12 でいうイベント使用可レベル)
//
// 実装境界:
//   - Phase 4 では canHandUseCard / handUseCard はゲート + flag セットのみ。
//   - 実際のカード効果解決は呼出元が engine.event.queue / engine.resolve 経由で行う。
//   - handUseCard は effect:declared hook を emit して、Phase 5 のカード登録経由で
//     pendingEffects に積まれる設計。

import type { GameState } from '../../types/index.js';
import { mutate } from '../../mutate/index.js';
import { event } from '../../event/index.js';
import { def as readDef } from '../../read/def.js';

type Player = 'self' | 'opp';

/**
 * 色制限チェック: カードの全色が事件の色に含まれているか (rules/20)
 *   - 2色カードは両方とも事件が持つ必要あり
 *   - CardDef が未登録なら true (Phase 5 で TSV 登録時に強制される設計)
 */
function colorAllowed(state: GameState, p: Player, cardId: string): boolean {
  const d = readDef.card(cardId);
  if (!d) return true; // 未登録は寛容
  const caseColors = state.players[p].case.colors;
  if (d.colors.length === 0) return true; // 色なしカードは制限なし
  for (const c of d.colors) {
    if (!caseColors.includes(c)) return false;
  }
  return true;
}

/**
 * レベル制限チェック: カードのレベル ≤ FILE 枚数 (rules/12)
 *   - CardDef が未登録なら true
 *   - level が未定義なら制限なし扱い
 */
function levelAllowed(state: GameState, p: Player, cardId: string): boolean {
  const d = readDef.card(cardId);
  if (!d) return true;
  if (d.level === undefined) return true;
  return d.level <= state.players[p].file.length;
}

/**
 * canHandUseCard — 手札の使用が可能か判定する。
 */
export function canHandUseCard(state: GameState, p: Player, cardId: string): boolean {
  // 手札にあるか
  if (!state.players[p].hand.includes(cardId)) return false;
  // 1 ターン 1 回制限 (rules/05)
  if (state.turnState[p].handUseUsed) return false;
  // ネクストヒント済ターンは不可 (rules/05)
  if (state.turnState[p].nextHintUsed) return false;
  // 色 (rules/20)
  if (!colorAllowed(state, p, cardId)) return false;
  // レベル (rules/12)
  if (!levelAllowed(state, p, cardId)) return false;
  // キャラの場合: 現場上限 5 (rules/20) — switch 経路は Phase 5 advance で追加するまで保留
  const d = readDef.card(cardId);
  if (d?.kind === 'character' && state.players[p].scene.length >= 5) return false;
  return true;
}

/**
 * handUseCard — 手札の使用を宣言する。
 *
 * - turnFlags.handUseUsed=true をセット
 * - effect:declared hook を emit (Phase 5 で登録された listener が pendingEffects に積む)
 * - ログ追加
 *
 * 実際のカード効果解決は呼出元が engine.resolve.runAllUntilEmpty を実行する責務。
 */
export function handUseCard(
  state: GameState,
  p: Player,
  cardId: string,
  _ctx?: unknown,
): void {
  if (!canHandUseCard(state, p, cardId)) {
    throw new Error(`handUseCard: not allowed for ${p} cardId=${cardId}`);
  }
  // フラグ + ログ
  mutate.flag.setHandUseUsed(state, p, true);
  mutate.log.append(state, {
    ts: Date.now(),
    player: p,
    turn: state.turn.number,
    action: 'handUseCard',
    target: cardId,
  });
  event.emit(
    state,
    'effect:declared',
    { kind: 'handUseCard', cardId },
    { player: p, cardId },
  );
  // キャラの場合: 現場へ登場 (rules/05 §01 + rules/06 + rules/12 §3 — アクティブ・名乗り状態で登場)
  // NextHint と同じパターン (flow/main/next-hint.ts L105-119) を踏襲。
  // 手札の使用とは異なり、効果による登場ではないので viaEffect:false。
  const d = readDef.card(cardId);
  if (d?.kind === 'character') {
    // 手札から除去
    const handIdx = state.players[p].hand.indexOf(cardId);
    if (handIdx !== -1) state.players[p].hand.splice(handIdx, 1);
    // 現場登場 (名乗り状態 = rules/05 同ターン登場)
    const newChar = mutate.scene.enter(state, p, cardId, {
      named: true,
      viaEffect: false,
    });
    event.emit(
      state,
      'enter',
      { uid: newChar.uid, viaEffect: false, enterOrder: newChar.enterOrder },
      { player: p, cardId, uid: newChar.uid },
    );
  }
}
