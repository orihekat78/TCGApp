// engine.flow.main.runNextHint — ネクストヒント (rules/05 02., rules/12)
//
// 概要:
//   1. FILE 最上部のカード (アシスト中パートナーを除く) を手札に加える
//   2. その直後、FILE 枚数以下のレベル のキャラ / イベントを 1 枚使用可能
//      - 1 で加えたカードも使用候補
//      - 1 で加えたカードは 2 の FILE 枚数判定に数えない (rules/12)
//      - 使用しない選択肢もあり
//   3. キャラはアクティブ状態で登場 (同ターン登場扱い = isNamed:true)
//   4. イベントは通常通り効果発動
//   5. turnFlags.nextHintUsed=true をセット
//
// 色制限 (rules/20) は使用するカードに適用 (効果による登場・カットイン・ヒラメキは除く)。

import type { GameState } from '../../types/index.js';
// Round 3: FILE_CARD_BACK_PLACEHOLDER は不要 (FileCard.card-back が cardId 保持するため)
import { mutate } from '../../mutate/index.js';
import { event } from '../../event/index.js';
import { def as readDef } from '../../read/def.js';

type Player = 'self' | 'opp';

/**
 * canStartNextHint — ネクストヒントを開始可能か判定する。
 *
 * - FILE 最上部 (アシストパートナー以外) が 1 枚以上必要 (= 実質 FILE ≥ 1 + 非アシスト)
 */
export function canStartNextHint(state: GameState, p: Player): boolean {
  const file = state.players[p].file;
  if (file.length === 0) return false;
  // アシストパートナー以外のカードが 1 枚以上あれば OK
  return file.some(f => f.type !== 'assisted-partner');
}

/**
 * 色制限 (rules/20): カードの全色が事件の色に含まれているか
 */
function colorAllowed(state: GameState, p: Player, cardId: string): boolean {
  const d = readDef.card(cardId);
  if (!d) return true;
  const caseColors = state.players[p].case.colors;
  if (d.colors.length === 0) return true;
  for (const c of d.colors) {
    if (!caseColors.includes(c)) return false;
  }
  return true;
}

/**
 * runNextHint — ネクストヒントを実行する。
 *
 * @param optionalCardId — 2. の段で使用するカード (省略時は FILE→手札のみ)
 *
 * - rules/12: 1 で加えたカードは FILE 枚数判定に数えない
 *   → 判定はカード使用の **時点** の FILE 枚数を見るが、手札に加わったカードは
 *     FILE から既に取り除かれているので自然に正しくなる
 */
export function runNextHint(state: GameState, p: Player, optionalCardId?: string): void {
  if (!canStartNextHint(state, p)) {
    throw new Error(`runNextHint: not startable for ${p}`);
  }
  // 1. FILE 最上部を手札へ (アシストパートナーは除く)
  // Round 3: FileCard.card-back に cardId を保持するよう拡張済 → 実 cardId を手札に push
  //   旧: FILE_CARD_BACK_PLACEHOLDER ('card-back') を push して UI 側で resolve できず "???"
  //   新: popped.cardId を渡し、cardResolvers が正常に名前/画像を解決可
  const popped = mutate.file.popTop(state, p);
  if (popped && popped.type === 'card-back') {
    mutate.hand.add(state, p, [popped.cardId]);
  } else if (popped && popped.type === 'assisted-partner') {
    // popTop でフィルタ済 (rules/12 アシスト中パートナーはネクストヒント対象外)
    mutate.hand.add(state, p, [popped.cardId]);
  }

  event.emit(state, 'file:pop', { player: p, popped }, { player: p });

  // 2. (任意) 1 枚使用
  if (optionalCardId !== undefined) {
    // 手札にあるか確認
    if (!state.players[p].hand.includes(optionalCardId)) {
      throw new Error(`runNextHint: ${optionalCardId} not in ${p} hand`);
    }
    // 色 (rules/20)
    if (!colorAllowed(state, p, optionalCardId)) {
      throw new Error(`runNextHint: ${optionalCardId} color violates case`);
    }
    // レベル ≤ 現在 FILE 枚数 (rules/12 — 1 で取った分は既に減算済)
    const d = readDef.card(optionalCardId);
    if (d && d.level !== undefined) {
      if (d.level > state.players[p].file.length) {
        throw new Error(`runNextHint: ${optionalCardId} level ${d.level} > FILE ${state.players[p].file.length}`);
      }
    }
    // 効果発動 hook (Phase 5 で listener が pendingEffects に積む)
    event.emit(
      state,
      'effect:declared',
      { kind: 'nextHintCardUse', cardId: optionalCardId },
      { player: p, cardId: optionalCardId },
    );
    // キャラの場合: 現場へ登場 (rules/12 §3 — アクティブ・名乗り状態で登場)。
    // 手札の使用とは異なり、ネクストヒントによる登場は **手動プレイ** = viaEffect:false。
    // rules/17 — enter Hook を emit して 【登場時】 listener を起動する。
    if (d && d.kind === 'character') {
      // 手札から除去
      const handIdx = state.players[p].hand.indexOf(optionalCardId);
      if (handIdx !== -1) state.players[p].hand.splice(handIdx, 1);
      // 現場登場 (名乗り状態 = rules/12 同ターン登場)
      const newChar = mutate.scene.enter(state, p, optionalCardId, {
        named: true,
        viaEffect: false,
      });
      event.emit(state, 'enter', {
        uid: newChar.uid,
        viaEffect: false,
        enterOrder: newChar.enterOrder,
      }, { player: p, cardId: optionalCardId, uid: newChar.uid });
    } else if (d && d.kind === 'event') {
      // Round 4a (バグ D 水平展開): ネクストヒント経由でイベントカード使用時も
      // 手札除去 + リムーブ移動を保証 (rules/06 §使い切り)。hand-use-card.ts と同じ修正。
      const handIdx = state.players[p].hand.indexOf(optionalCardId);
      if (handIdx !== -1) state.players[p].hand.splice(handIdx, 1);
      mutate.remove.add(state, p, [optionalCardId]);
    }
  }

  // 3. フラグセット
  mutate.flag.setNextHintUsed(state, p, true);
  mutate.log.append(state, {
    ts: Date.now(),
    player: p,
    turn: state.turn.number,
    action: 'nextHint',
    target: optionalCardId,
  });
}
