// engine.effect.runAtom — Atom Verb dispatcher
// spec: .claude/specs/engine-api-effect-descriptor.md
// rules: 15-abilities-effects.md and others (per verb)
//
// 設計メモ:
//   - 各 Atom Verb は engine.mutate.* プリミティブの薄いラッパー
//   - 引数は AtomArgs (verb 毎に異なる shape) → unknown 受け取り内部で narrow
//   - 全ての mutate 呼び出しは Immer draft 前提 (produce 内で呼ぶこと)
//   - charSetAP / charSetLP は Phase 5 まで未サポート (throw)。
//     charOverrideAP/LP (rules/19: 「元のAPを X にする」) のみ setOverrideAP/LP にマップ。
//   - startContact / endActionEarly は Phase 3 では log のみ。Phase 4 フローで本実装
//   - deckRevealUntil の binding shape: Candidate { kind: 'card', cardId, area: 'deck', player }

// refactor Phase 3a (2026-06-22): runAtom を dispatcher 化し各 verb handler を atom-handlers/ へ分割。
// 外部 API (runAtom + _drainPending*Side + Pending*Side 型) は本 barrel が再 export して不変。
import type { GameState, AtomVerb, EffectCtx } from '../types/index.js';
export {
  _drainPendingDeckRevealSide,
  _drainPendingDeckReorderSide,
  _drainPendingDeckPlaceSide, // mini-wave #5 P2: deckPlaceSplitBound (top/bottom 振り分け) の drain
  _drainPendingContactStartAxId, // W6 step9 (row65): startContact 生成 ax.id の drain
  type PendingDeckRevealSide,
  type PendingDeckReorderSide,
  type PendingDeckPlaceSide,
} from './atom-handlers/_shared.js';
import {
  atomDraw,
  atomDrawUpToHandSize,
  atomDiscard,
  atomDiscardRandom,
  atomHandReveal,
  atomPartnerAreaRemove,
  atomMill,
  atomFileAdd,
  atomFilePopToHand,
  atomFileRemoveTop,
  atomFileFlipTop,
  atomEvidenceGain,
  atomSelfToEvidence,
  atomToPartnerArea,
  atomEvidenceLose,
  atomEvidenceToDeck,
  atomEvidenceFlip,
  atomEvidenceFlipDown,
  atomEvidenceToHand,
  atomHandToEvidence,
  atomHandToFileBottom,
  atomUseEventFromHand,
  atomEvidenceToDeckBottom,
  atomHandAddFromDeck,
  atomInvokeLeaveToRemoveOfCard,
  atomHandAddFromDeckBottom,
  atomHandAddFromRemove,
  atomHandToDeckBottom,
  atomDeckShuffle,
  atomRemoveAreaAllToDeckBottom,
  atomRemoveAreaToDeckTop,
} from './atom-handlers/core.js';
import {
  atomSceneEnter,
  atomSceneSwitch,
  atomSceneRemove,
  atomCharRemoveSetCard,
  atomSceneToHand,
  atomSceneToDeck,
  atomSceneToEvidence,
  atomSceneSetState,
  atomSceneDisguise,
} from './atom-handlers/scene.js';
import {
  atomCharModifyAP,
  atomCharModifyLP,
  atomCharModifyLevel,
  atomCharOverrideAP,
  atomCharOverrideLP,
  atomCharGrantKeyword,
  atomCharRevokeKeyword,
  atomCharDisableOriginal,
  atomCharGrantAbility,
  atomCharSetTurnEffect,
  atomCharSetCard,
  atomCharStackCard,
} from './atom-handlers/char.js';
import {
  atomDeckRevealUntil,
  atomDeckToBottomBound,
  atomDeckPlaceSplitBound,
  atomDeckBottomReorderBound, // S2 B08057: bottom 済 bound block の並べ替え surface
  atomBoundToRemove,
  atomSouza,
  atomBindPick,
} from './atom-handlers/picks.js';
import {
  atomPartnerAssist,
  atomPartnerSetState,
  atomPartnerSolveCase,
  atomOpponentLoses,
  atomCaseToResolved,
  atomStartContact,
  atomEndActionEarly,
  atomSetEventUseBan,
  atomSetNextHintBan,
  atomSetShippuWaive,
  atomSetCutinBan,
  atomSetDisguiseBan,
  atomSetHiramekiSuppress,
  atomSetEvidenceGainSuppress,
  atomReserveEffect,
  atomLog,
  atomExpandActionTargets,
  atomDeclareName,
} from './atom-handlers/misc.js';

export function runAtom(s: GameState, verb: AtomVerb, args: unknown, ctx: EffectCtx): void {
  const a = args as Record<string, unknown>;
  // Task D E0 (2026-06-12): pick-bind writeback。PA 短縮形 pick が解決済み (uid が実 uid) かつ
  // `bind` が指定されていれば、ctx.bindings[bind] に {kind:'char',uid,cardId,player} を蓄積する。
  // 後続 atom は `uid: '$<bind>.uid'` (resolveBindRef) で同一キャラを参照できる。
  // human (applyPickAndContinuation の continuation ctx) / AI (初期 walk 同期解決 → runtime
  // entryToCtx の ctx) の両経路を本 preamble 1 箇所でカバーする (rules/15 効果解決順)。
  // multi-pick は per-uid atom が順に実行されるため重複を避けつつ全 picked が蓄積される。
  if (typeof a.bind === 'string' && typeof a.uid === 'string' && !a.uid.startsWith('$')) {
    const bindUid = a.uid;
    const found = (['self', 'opp'] as const)
      .flatMap(p => s.players[p].scene.map(c => ({ c, p })))
      .find(({ c }) => c.uid === bindUid);
    if (found) {
      const bindings = ctx.bindings as Record<string, unknown[]>;
      const arr = Array.isArray(bindings[a.bind]) ? bindings[a.bind]! : (bindings[a.bind] = []);
      if (!arr.some(e => (e as { uid?: string }).uid === bindUid)) {
        arr.push({ kind: 'char', uid: bindUid, cardId: found.c.cardId, player: found.p });
      }
    }
  }
  switch (verb) {
    case 'draw':
      return atomDraw(s, a, ctx);
    case 'drawUpToHandSize':
      return atomDrawUpToHandSize(s, a, ctx);
    case 'discard':
      return atomDiscard(s, a, ctx, verb);
    case 'discardRandom':
      return atomDiscardRandom(s, a, ctx);
    case 'handReveal':
      return atomHandReveal(s, a, ctx, verb);
    case 'partnerAreaRemove':
      return atomPartnerAreaRemove(s, a, ctx, verb);
    case 'mill':
      return atomMill(s, a, ctx);
    case 'fileAdd':
      return atomFileAdd(s, a, ctx);
    case 'filePopToHand':
      return atomFilePopToHand(s, a, ctx);
    case 'fileRemoveTop':
      return atomFileRemoveTop(s, a, ctx);
    case 'fileFlipTop':
      return atomFileFlipTop(s, a, ctx);
    case 'evidenceGain':
      return atomEvidenceGain(s, a, ctx);
    case 'selfToEvidence':
      return atomSelfToEvidence(s, a, ctx);
    case 'toPartnerArea':
      return atomToPartnerArea(s, a, ctx);
    case 'evidenceLose':
      return atomEvidenceLose(s, a, ctx);
    case 'evidenceToDeck':
      return atomEvidenceToDeck(s, a, ctx);
    case 'evidenceFlip':
      return atomEvidenceFlip(s, a, ctx, verb);
    case 'evidenceFlipDown':
      return atomEvidenceFlipDown(s, a, ctx, verb);
    case 'evidenceToHand':
      return atomEvidenceToHand(s, a, ctx, verb);
    case 'handToEvidence':
      return atomHandToEvidence(s, a, ctx, verb);
    case 'handToFileBottom':
      return atomHandToFileBottom(s, a, ctx, verb); // engine mega-wave W1 (2026-07-03, P41)
    case 'evidenceToDeckBottom':
      return atomEvidenceToDeckBottom(s, a, ctx, verb); // engine mega-wave W1 (2026-07-03, B03084 a1 前段)
    case 'handAddFromDeck':
      return atomHandAddFromDeck(s, a, ctx);
    case 'handAddFromDeckBottom':
      return atomHandAddFromDeckBottom(s, a, ctx);
    case 'handAddFromRemove':
      return atomHandAddFromRemove(s, a, ctx, verb);
    case 'handToDeckBottom':
      return atomHandToDeckBottom(s, a, ctx, verb);
    case 'sceneEnter':
      return atomSceneEnter(s, a, ctx, verb);
    case 'sceneSwitch':
      return atomSceneSwitch(s, a, ctx);
    case 'sceneRemove':
      return atomSceneRemove(s, a, ctx, verb);
    case 'charRemoveSetCard':
      return atomCharRemoveSetCard(s, a, ctx, verb);
    case 'sceneToHand':
      return atomSceneToHand(s, a, ctx, verb);
    case 'sceneToDeck':
      return atomSceneToDeck(s, a, ctx, verb);
    case 'sceneToEvidence':
      return atomSceneToEvidence(s, a, ctx, verb); // engine mega-wave W1 (2026-07-03, P38)
    case 'sceneSetState':
      return atomSceneSetState(s, a, ctx, verb);
    case 'sceneDisguise':
      return atomSceneDisguise(s, a, ctx);
    case 'charModifyAP':
      return atomCharModifyAP(s, a, ctx, verb);
    case 'charModifyLP':
      return atomCharModifyLP(s, a, ctx, verb);
    case 'charModifyLevel':
      return atomCharModifyLevel(s, a, ctx, verb);
    case 'charSetAP':
      throw new Error('charSetAP: not yet supported — Phase 5 must define mutate.char.setExact (distinct from setOverride)');
    case 'charSetLP':
      throw new Error('charSetLP: not yet supported — Phase 5 must define mutate.char.setExact');
    case 'charOverrideAP':
      return atomCharOverrideAP(s, a, ctx);
    case 'charOverrideLP':
      return atomCharOverrideLP(s, a, ctx);
    case 'charGrantKeyword':
      return atomCharGrantKeyword(s, a, ctx, verb);
    case 'charRevokeKeyword':
      return atomCharRevokeKeyword(s, a, ctx);
    case 'charDisableOriginal':
      return atomCharDisableOriginal(s, a, ctx);
    case 'charGrantAbility':
      return atomCharGrantAbility(s, a, ctx, verb);
    case 'charSetTurnEffect':
      return atomCharSetTurnEffect(s, a, ctx);
    case 'charSetCard':
      return atomCharSetCard(s, a, ctx, verb);
    case 'charStackCard':
      return atomCharStackCard(s, a, ctx, verb);
    case 'partnerAssist':
      return atomPartnerAssist(s, a, ctx);
    case 'partnerSetState':
      return atomPartnerSetState(s, a, ctx);
    case 'partnerSolveCase':
      return atomPartnerSolveCase(s, a, ctx);
    case 'opponentLoses':
      return atomOpponentLoses(s, a, ctx);
    case 'caseToResolved':
      return atomCaseToResolved(s, a, ctx);
    case 'startContact':
      return atomStartContact(s, a, ctx);
    case 'endActionEarly':
      return atomEndActionEarly(s, a, ctx);
    case 'deckRevealUntil':
      return atomDeckRevealUntil(s, a, ctx);
    case 'deckToBottomBound':
      return atomDeckToBottomBound(s, a, ctx);
    case 'deckPlaceSplitBound':
      return atomDeckPlaceSplitBound(s, a, ctx);
    case 'deckBottomReorderBound': // S2 B08057
      return atomDeckBottomReorderBound(s, a, ctx);
    case 'boundToRemove':
      return atomBoundToRemove(s, a, ctx);
    case 'deckShuffle':
      return atomDeckShuffle(s, a, ctx);
    case 'removeAreaAllToDeckBottom':
      return atomRemoveAreaAllToDeckBottom(s, a, ctx);
    case 'removeAreaToDeckTop':
      return atomRemoveAreaToDeckTop(s, a, ctx, verb);
    case 'souza':
      return atomSouza(s, a, ctx);
    case 'useEventFromHand':
      return atomUseEventFromHand(s, a, ctx, verb); // engine mega-wave W6 step3 (2026-07-04, r63 P18)
    case 'setEventUseBan':
      return atomSetEventUseBan(s, a, ctx);
    case 'setShippuWaive':
      return atomSetShippuWaive(s, a, ctx); // engine mega-wave W6 step4 (2026-07-04, B09090/P16)
    case 'setNextHintBan':
      return atomSetNextHintBan(s, a, ctx);
    case 'setCutinBan':
      return atomSetCutinBan(s, a, ctx);
    case 'setDisguiseBan':
      return atomSetDisguiseBan(s, a, ctx);
    case 'setHiramekiSuppress':
      return atomSetHiramekiSuppress(s, a, ctx);
    case 'setEvidenceGainSuppress':
      return atomSetEvidenceGainSuppress(s, a, ctx);
    case 'reserveEffect':
      return atomReserveEffect(s, a, ctx);
    case 'leaveInterceptRedirect':
      // W6 step10 (row9): 宣言的 marker — 実行経路なし (consult-leave-intercept.ts が def 走査時に
      // args.destination を読む)。誤って runAtom に到達しても盤面無変化 (fail-safe no-op)。
      return;
    case 'invokeLeaveToRemoveOfCard':
      return atomInvokeLeaveToRemoveOfCard(s, a, ctx);
    case 'bindPick':
      return atomBindPick(s, a, ctx, verb);
    case 'declareName':
      return atomDeclareName(s, a, ctx);
    case 'log':
      return atomLog(s, a, ctx);
    case 'noop':
      return;
    case 'expandActionTargets':
      return atomExpandActionTargets(s, a, ctx);

    default: {
      // exhaustiveness check
      const _exhaustive: never = verb;
      throw new Error(`unknown atom verb: ${String(_exhaustive)}`);
    }
  }
}
