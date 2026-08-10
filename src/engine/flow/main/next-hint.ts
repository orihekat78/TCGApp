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
import {
  completeEffectCausalTrace,
  recordCausalTraceOperation,
  startStandaloneCausalTrace,
} from '../../log/effect-causal.js';
import { eventUseAllowed, handUseCharRestrictAllows, nextHintColorIgnoreAllowed, effectiveHandLevel } from './hand-use-card.js';

type Player = 'self' | 'opp';

/**
 * canStartNextHint — ネクストヒントを開始可能か判定する。
 *
 * - FILE 最上部 (アシストパートナー以外) が 1 枚以上必要 (= 実質 FILE ≥ 1 + 非アシスト)
 */
export function canStartNextHint(state: GameState, p: Player): boolean {
  // wave use-restrict (2026-06-30): 「このターン中、自分はネクストヒントできない」(B06104/P・B09019/P・B09105/P)。
  // setNextHintBan verb がセット、resetTurnFlags でクリア。ネクストヒント全体 (step1 FILE→手札 含む) を不可にする
  // (eventUseBanned が step2 の event のみ gate するのと異なる)。手札の使用 (rules/05 01.) は別経路ゆえ無影響。
  if (state.turnState[p].nextHintBanned) return false;
  const file = state.players[p].file;
  if (file.length === 0) return false;
  // アシストパートナー以外のカードが 1 枚以上あれば OK
  return file.some(f => f.type !== 'assisted-partner');
}

/** Build the post-pop state without mutating. Rejected step-2 use must leave
 * FILE, events, flags, and logs untouched. */
function projectedNextHintState(state: GameState, p: Player): GameState | null {
  const file = state.players[p].file;
  const popIndex = file.map((f, i) => ({ f, i })).reverse().find(({ f }) => f.type !== 'assisted-partner')?.i;
  if (popIndex === undefined) return null;
  const popped = file[popIndex];
  return {
    ...state,
    players: {
      ...state.players,
      [p]: {
        ...state.players[p],
        file: file.filter((_, i) => i !== popIndex),
        // Step 2 sees the card just taken from FILE.  This keeps the pure
        // preflight identical to the real pop → hand-add sequence.
        hand: [...state.players[p].hand, popped.cardId],
      },
    },
  } as GameState;
}

/** UI candidate mirror of the engine's post-pop event-use preflight. */
export function nextHintEventUseAllowed(state: GameState, p: Player, cardId: string): boolean {
  const projected = projectedNextHintState(state, p);
  if (!projected) return false;
  return eventUseAllowed(projected, p, cardId);
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
    // W2 P09/r26: subset 失敗時のみ colorIgnore bypass (B03126 両経路 / B02087 NH 限定、A3 wave)
    if (!caseColors.includes(c)) return nextHintColorIgnoreAllowed(state, p, cardId);
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
  // Validate every optional step-2 use against the state after FILE pop,
  // before mutating or emitting anything. A rejected use must not consume
  // FILE, set a flag, append a log, or trigger file:pop listeners.
  let optionalDef: ReturnType<typeof readDef.card>;
  if (optionalCardId !== undefined) {
    const projected = projectedNextHintState(state, p);
    if (!projected || !projected.players[p].hand.includes(optionalCardId)) {
      throw new Error(`runNextHint: ${optionalCardId} not in ${p} hand`);
    }
    if (!colorAllowed(projected, p, optionalCardId)) {
      throw new Error(`runNextHint: ${optionalCardId} color violates case`);
    }
    const d = readDef.card(optionalCardId);
    optionalDef = d;
    if (d?.kind === 'character' && (projected.turnState[p].useEnterBannedCardNames ?? []).some(name => d.names.includes(name))) {
      throw new Error(`runNextHint: ${optionalCardId} use/enter banned this turn`);
    }
    const nhLvl = effectiveHandLevel(projected, p, optionalCardId);
    if (nhLvl !== undefined && nhLvl > projected.players[p].file.length) {
      throw new Error(`runNextHint: ${optionalCardId} level ${nhLvl} > FILE ${projected.players[p].file.length}`);
    }
    if (optionalDef?.kind === 'event' && projected.turnState[p].eventUseBanned) {
      throw new Error(`runNextHint: ${optionalCardId} event-use banned this turn`);
    }
    if (optionalDef?.kind === 'event' && !eventUseAllowed(projected, p, optionalCardId)) {
      throw new Error(`runNextHint: ${optionalCardId} event-use condition not met`);
    }
    if (optionalDef?.kind === 'character' && !handUseCharRestrictAllows(projected, p, optionalCardId)) {
      throw new Error(`runNextHint: ${optionalCardId} hand-use restricted by case`);
    }
  }

  const causalTrace = startStandaloneCausalTrace(state, {
    actor: p,
    kind: 'declare',
    source: { kind: 'player', side: p },
    targets: [{ kind: 'zone', side: p, zone: 'file' }],
    outcome: { type: 'state', state: 'active' },
  });

  const popped = mutate.file.popTop(state, p);
  if (popped && popped.type === 'card-back') {
    mutate.hand.add(state, p, [popped.cardId]);
  } else if (popped && popped.type === 'assisted-partner') {
    // popTop でフィルタ済 (rules/12 アシスト中パートナーはネクストヒント対象外)
    mutate.hand.add(state, p, [popped.cardId]);
  }

  const fileMove = popped === undefined ? undefined : recordCausalTraceOperation(state, causalTrace, {
    actor: p,
    kind: 'zone-move',
    source: { kind: 'zone', side: p, zone: 'file' },
    targets: [{ kind: 'zone', side: p, zone: 'hand' }],
    outcome: { type: 'move', from: 'file', to: 'hand', count: 1 },
  });

  event.emit(
    state,
    'file:pop',
    { player: p, popped },
    { player: p },
    { causalCorrelationEventId: fileMove?.eventId },
  );

  // 2. (任意) 1 枚使用
  if (optionalCardId !== undefined) {
    // 手札にあるか確認
    // 色 (rules/20)
    // レベル ≤ 現在 FILE 枚数 (rules/12 — 1 で取った分は既に減算済)
    // mini-wave #4: 手札内 continuous level modifier (B01009/B09095) を effectiveHandLevel で反映
    const d = optionalDef;
    const useOperation = recordCausalTraceOperation(state, causalTrace, {
      actor: p,
      kind: 'use',
      source: { kind: 'player', side: p },
      targets: [{ kind: 'zone', side: p, zone: 'hand' }],
      outcome: { type: 'state', state: 'active' },
    });
    // イベント使用不可 (B09034 §M3): ネクストヒントの step2 でも event 使用は不可 (rules/25 公式 Q&A:
    //   「ネクストヒントでイベントカードを使用することができ(ない)」)。step1 の FILE→手札は阻害しない
    //   (本ガードは optionalCardId ブロック内 = step2 のみ)。UI 側 toCandidate でも事前除外する。
    // P05 (wave-5): case card 継続の character 手札使用制限 (「特徴[X]以外のキャラを手札から使用できない」)。
    //   公式 Q&A:「ネクストヒントでの使用も『手札から使用』に含まれる」→ 手札の使用 (canHandUseCard) と同じ
    //   gate を character に課す。event/効果登場/カットイン/変装/ヒラメキ は対象外 (handUseCharRestrictAllows
    //   が非 character を素通り)。UI toCandidate 側の事前除外は card-wave で配線 (現状 consumer カード無)。
    // 効果発動 hook (Phase 5 で listener が pendingEffects に積む)
    event.emit(
      state,
      'effect:declared',
      // Round 4b: payload kind を event-use / character-use に分離。
      // hand-use-card.ts と同じ規約 (eventRemoveByAP matcher 'kind===event-use' との整合)。
      // BUG-132 GAP-2: payload に player を追加 (hand-use-card.ts と同一規約、additive)
      // mini-wave #2 (2026-07-10): viaNextHint flag — 「ネクストヒントで手札を使用したとき」(B01005/B03002/
      // B05005) を通常の手札の使用と判別する additive field (既存 matcher は未読で挙動不変)。
      { kind: d?.kind === 'event' ? 'event-use' : 'character-use', cardId: optionalCardId, player: p, viaNextHint: true },
      { player: p, cardId: optionalCardId, ...(d?.kind === 'event' ? { resolutionKind: 'normal-event' as const } : {}) },
      { causalCorrelationEventId: useOperation?.eventId },
    );
    // キャラの場合: 現場へ登場 (rules/12 §3 — アクティブ・名乗り状態で登場)。
    // 手札の使用とは異なり、ネクストヒントによる登場は **手動プレイ** = viaEffect:false。
    // rules/17 — enter Hook を emit して 【登場時】 listener を起動する。
    if (d && d.kind === 'character') {
      // 手札から除去 (refactor 1a 2026-06-12: mutate 層経由。indexOf+splice と同一挙動)
      mutate.hand.remove(state, p, [optionalCardId]);
      // 現場登場 (名乗り状態 = rules/12 同ターン登場)
      const newChar = mutate.scene.enter(state, p, optionalCardId, {
        named: true,
        viaEffect: false,
      });
      recordCausalTraceOperation(state, causalTrace, {
        actor: p,
        kind: 'zone-move',
        source: { kind: 'zone', side: p, zone: 'hand' },
        targets: [{ kind: 'zone', side: p, zone: 'scene' }],
        outcome: { type: 'move', from: 'hand', to: 'scene', count: 1 },
      });
      const enterOperation = recordCausalTraceOperation(state, causalTrace, {
        actor: p,
        kind: 'enter',
        source: { kind: 'player', side: p },
        targets: [{ kind: 'scene-card', side: p, uid: newChar.uid }],
        outcome: { type: 'state', state: 'success' },
      });
      event.emit(state, 'enter', {
        uid: newChar.uid,
        viaEffect: false,
        enterOrder: newChar.enterOrder,
        enterOrderThisTurn: newChar.enterOrderThisTurn,
      }, { player: p, cardId: optionalCardId, uid: newChar.uid }, {
        causalCorrelationEventId: enterOperation?.eventId,
      });
    } else if (d && d.kind === 'event') {
      // Round 4a (バグ D 水平展開): ネクストヒント経由でイベントカード使用時も
      // 手札除去 + リムーブ移動を保証 (rules/06 §使い切り)。hand-use-card.ts と同じ修正。
      mutate.hand.remove(state, p, [optionalCardId]); // refactor 1a: mutate 層経由
      mutate.remove.add(state, p, [optionalCardId]);
      recordCausalTraceOperation(state, causalTrace, {
        actor: p,
        kind: 'zone-move',
        source: { kind: 'zone', side: p, zone: 'hand' },
        targets: [{ kind: 'zone', side: p, zone: 'remove' }],
        outcome: { type: 'move', from: 'hand', to: 'remove', count: 1 },
      });
    }
  }

  // 3. フラグセット
  mutate.flag.setNextHintUsed(state, p, true);
  if (causalTrace === undefined) {
    mutate.log.append(state, {
      ts: Date.now(),
      player: p,
      turn: state.turn.number,
      action: 'nextHint',
      target: optionalCardId,
    });
  }
  completeEffectCausalTrace(state, causalTrace, p);
}
