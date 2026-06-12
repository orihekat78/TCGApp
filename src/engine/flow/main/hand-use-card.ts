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
 * 手札の使用 共通ゲート: 色 / レベル / 1ターン1回 / nextHint 済を判定。
 * scene 上限は呼出側 (canHandUseCard / canHandUseCardSwitch) で別途。
 */
function handUseGateCommon(state: GameState, p: Player, cardId: string): boolean {
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
  return true;
}

/**
 * canHandUseCard — 通常の手札使用が可能か (scene 上限 5 未満)。
 * scene が 5 でキャラ登場するときは canHandUseCardSwitch を使う (rules/20 §スイッチ)。
 */
export function canHandUseCard(state: GameState, p: Player, cardId: string): boolean {
  if (!handUseGateCommon(state, p, cardId)) return false;
  // キャラの場合: 現場上限 5 (rules/20) — スイッチ経路は canHandUseCardSwitch
  const d = readDef.card(cardId);
  if (d?.kind === 'character' && state.players[p].scene.length >= 5) return false;
  return true;
}

/**
 * canHandUseCardSwitch — 手札使用 + スイッチ (rules/20 §スイッチ) が可能か判定。
 * 条件: 通常ゲート ∧ cardId がキャラ ∧ 現場が満員 (5 枚)。
 * リムーブ対象 removeUid の検証 (scene に存在するか) は呼出側 / mutate.scene.switchEnter 側。
 */
export function canHandUseCardSwitch(state: GameState, p: Player, cardId: string): boolean {
  if (!handUseGateCommon(state, p, cardId)) return false;
  const d = readDef.card(cardId);
  if (d?.kind !== 'character') return false;
  if (state.players[p].scene.length < 5) return false;
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
  switchRemoveUid?: string,
): void {
  // switch 経路と通常経路でゲート判定を切替 (rules/20 §スイッチ)。
  const isSwitch = switchRemoveUid !== undefined;
  if (isSwitch) {
    if (!canHandUseCardSwitch(state, p, cardId)) {
      throw new Error(`handUseCard: switch not allowed for ${p} cardId=${cardId}`);
    }
  } else if (!canHandUseCard(state, p, cardId)) {
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
  // Round 4b: payload kind は event-use / character-use に分離。
  // eventRemoveByAP (cards/_shared) 等の matcher が `kind === 'event-use'` を期待する契約。
  const d = readDef.card(cardId);
  const emitKind = d?.kind === 'event' ? 'event-use' : 'character-use';
  event.emit(
    state,
    'effect:declared',
    { kind: emitKind, cardId },
    { player: p, cardId },
  );
  // キャラの場合: 現場へ登場 (rules/05 §01 + rules/06 + rules/12 §3 — アクティブ・名乗り状態で登場)
  // NextHint と同じパターン (flow/main/next-hint.ts L105-119) を踏襲。
  // 手札の使用とは異なり、効果による登場ではないので viaEffect:false。
  if (d?.kind === 'character') {
    // 手札から除去 (refactor 1a 2026-06-12: mutate 層経由。indexOf+splice と同一挙動)
    mutate.hand.remove(state, p, [cardId]);
    // 現場登場 (名乗り状態 = rules/05 同ターン登場)。switch 経路では既存 1 枚を
    // 先にリムーブしてから enter (mutate.scene.switchEnter)。
    const newChar = isSwitch
      ? mutate.scene.switchEnter(state, p, cardId, switchRemoveUid as string, {
          named: true,
          viaEffect: false,
        })
      : mutate.scene.enter(state, p, cardId, {
          named: true,
          viaEffect: false,
        });
    event.emit(
      state,
      'enter',
      { uid: newChar.uid, viaEffect: false, enterOrder: newChar.enterOrder, enterOrderThisTurn: newChar.enterOrderThisTurn },
      { player: p, cardId, uid: newChar.uid },
    );
  } else if (d?.kind === 'event') {
    // Round 4a (バグ D): イベントカードは使い切り、使用後リムーブエリアへ (rules/06)。
    // 旧実装は kind='character' 分岐のみで event 用処理が欠落、使用後も手札に残るバグだった。
    // 効果自体は 'effect:declared' hook の listener (Round 4b で整備予定) が
    // pendingEffects に積む設計。本 fix は「手札除去 + リムーブ移動」のみを保証する。
    mutate.hand.remove(state, p, [cardId]); // refactor 1a: mutate 層経由
    mutate.remove.add(state, p, [cardId]);
  }
}
