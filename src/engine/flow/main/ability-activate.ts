// engine.flow.main.activateAbility — 宣言/パートナー能力の dispatch 契約 (Phase 2c, BUG-116 構造解消)
// rules: 21-declared-ability-cost.md (コストはすべて行う / 一部でも行えなければ使用不可)
//
// 旧契約 (〜2026-06-12): 呼出元 (UI dispatch / AI policy / e2e) が cost + EffectCtx を各自構築し
// engine.cost.pay → flow.useXxx を呼ぶ分担だった。渡し忘れると cost が silent skip され
// effect だけ走る (BUG-116)。本 helper は cost+ctx 構築と pay を engine 側に一元化し、
// 呼出元は {uid, abilId, costParams?} のみ渡す。
//
// costParams は「人間 (UI picker) / AI (greedy) が事前に選んだ picker 値」のみを運ぶ最小
// payload。picker 選択値は engine 内で再現できないため action 引数として残る (Phase 2c 設計制約)。
// pay は produce 内で呼ぶ前提 (draft mutate + ctx.viaCost flag)。pay が ctx に積む
// costPaid / dyn は useDeclaredAbility → effect 解決へ伝播する (BUG-085 維持)。

import type { GameState, AbilityDef, EffectCtx } from '../../types/index.js';
import { cost as engineCost } from '../../cost/index.js';
import { def as readDef } from '../../read/def.js';
import { canActivateDeclaredAbility, findCardOnBoard, useDeclaredAbility, findDeclaredAbility, resolveDeclaredPaymentPlan } from './declared-ability.js';
import { usePartnerAbility } from './partner-ability.js';
import { mutate } from '../../mutate/index.js';
import { declaredCostParamsToDyn } from './declared-cost-params.js';
import { _clearPendingSetCardReplacementSide } from '../../effect/pending-state.js';

type Player = 'self' | 'opp';

/**
 * 呼出元が運ぶ cost/choice picker 選択値。activate 系 helper が EffectCtx.dyn へ詰め替える。
 * 対応 channel は cost.pay / resolveEffectPicks が読む dyn キーと 1:1:
 *   - flipFaceUpEvidence → ctx.dyn.costParams.flipFaceUpEvidence.indices (pay.ts readFlipIndices)
 *   - sceneToDeckBottom  → ctx.dyn.costParams.sceneToDeckBottom.uids (pay.ts readSceneToDeckUids)
 *   - removeAreaToDeckBottom → ctx.dyn.costParams.removeAreaToDeckBottom.ids (pay.ts readRemoveAreaToDeckIds, cluster4)
 *   - costChoice         → ctx.dyn.costChoice (choice cost の branch index)
 *   - choiceIndex        → ctx.dyn.choiceIndex (top-level choice effect の option index)
 */
export interface AbilityCostParams {
  flipFaceUpEvidence?: { indices: number[] };
  /** Exact physical hand occurrences selected for a remove-from-hand cost. */
  removeFromHand?: { indices: number[] };
  sceneToDeckBottom?: { uids: string[] };
  removeAreaToDeckBottom?: { ids: string[] }; // cluster4 (2026-06-14)
  partnerAreaRemove?: { ids: string[] };
  /**
   * 裏向きセットの物理 occurrence 選択。`hostUids` のみは既存 AI/保存済み呼出との互換用。
   * 人間 dispatch は同じ添字の `instanceIds` も必須で、裏面の cardId は運ばない。
   */
  removeSetCard?: { hostUids: string[]; instanceIds?: string[] };
  removeStackedCards?: { instanceIds: string[] };
  /** Public UI payment mode. Explicit printed selection never falls back. */
  paymentMode?: 'printed' | 'alternative';
  alternativeCostProviderUid?: string;
  costChoice?: number;
  /** One selected branch index per encountered nested cost choice. */
  costChoicePath?: number[];
  choiceIndex?: number;
  // mega-wave W6 step1 (2026-07-04): declareName verb への宣言カード名供給 (UI= DeclareCardNameModal /
  // AI= 省略可、未供給は atom 側で空文字 fallback)。ctx.dyn.declaredName として effect 解決へ伝播。
  declaredName?: string;
}

function findAbility(cardId: string, abilId: string): AbilityDef | undefined {
  return readDef.card(cardId)?.abilities?.find((a: AbilityDef) => a.id === abilId);
}

/**
 * activateDeclaredAbility — 宣言能力の cost 支払い + 使用宣言 (atomic)。
 *
 * - uid から所有者/cardId/area を逆引きして EffectCtx を構築 (呼出元の ctx 構築は不要)
 * - カード def に cost があれば必ず engine.cost.pay を呼ぶ (BUG-116 の silent skip を構造排除)
 * - pay 済み ctx (costPaid/dyn) をそのまま useDeclaredAbility へ渡す (BUG-085 の伝播維持)
 * - cost が selfToDeckBottom 等で source を場外に出しても、pay 前に構築した ctx.source で
 *   useDeclaredAbility 側の BUG-108 救済が機能する
 */
export function activateDeclaredAbility(
  state: GameState,
  uid: string,
  abilId: string,
  costParams?: AbilityCostParams,
): void {
  const found = findCardOnBoard(state, uid);
  if (!found) {
    // 旧経路と同一の canonical throw (`useDeclaredAbility: card uid=... not on board`) に委譲
    _clearPendingSetCardReplacementSide();
    useDeclaredAbility(state, uid, abilId);
    return;
  }
  // Public UI dispatch authorizes through `isAllowed` first, where a human
  // removeSetCard cost must carry an exact physical-instance witness.  This
  // low-level mutator is also the deterministic AI/test resolver entrypoint;
  // preserve its established implicit fallback after all normal cost checks.
  // A supplied malformed witness still fails closed in canPayAtomically.
  if (!canActivateDeclaredAbility(state, uid, abilId, costParams, { allowImplicitRemoveSetCard: true })) {
    return;
  }
  const dyn = declaredCostParamsToDyn(costParams);
  const ctx: EffectCtx = {
    source: {
      cardId: found.cardId,
      uid,
      abilityId: abilId,
      player: found.player,
      area: found.area as EffectCtx['source']['area'],
    },
    bindings: {},
    ...(dyn ? { dyn } : {}),
  };
  // W6 step11 (row999 item4): rider declared (on-set-host) の cost も解決できるよう共有 helper 経由
  const ability = findDeclaredAbility(state, uid, found.cardId, found.area, abilId);
  if (ability?.cost) {
    const plan = resolveDeclaredPaymentPlan(state, ability, ctx, costParams, { allowLegacyInvalidAlternativeFallback: true });
    if (!plan) {
      _clearPendingSetCardReplacementSide();
      return;
    }
    if (plan.kind === 'alternative') {
      const removed = mutate.scene.removeToRemove(state, plan.providerUid, 'cost');
      if (removed.deferred || removed.prevented || removed.removed.uid !== plan.providerUid || !removed.removed.cardId) {
        _clearPendingSetCardReplacementSide();
        throw new Error('declared ability: alternative cost provider was replaced or deferred');
      }
      ctx.costPaid = { alternativeCost: { providerUid: plan.providerUid } };
    } else {
      engineCost.pay(state, ability.cost, ctx);
      ctx.costPaid ??= {};
    }
  }
  try {
    useDeclaredAbility(state, uid, abilId, ctx);
  } catch (error) {
    _clearPendingSetCardReplacementSide();
    throw error;
  }
}

/**
 * activatePartnerAbility — パートナー能力の cost 支払い + 使用宣言 (atomic)。
 * usePartnerAbility は ctx を取らない (効果は effect:declared listener 側) ため、
 * ctx は pay にのみ使用する。
 */
export function activatePartnerAbility(
  state: GameState,
  player: Player,
  abilId: string,
  costParams?: AbilityCostParams,
): void {
  const cardId = state.players[player].partner.cardId;
  if (cardId) {
    const ability = findAbility(cardId, abilId);
    if (ability?.cost) {
      const dyn = declaredCostParamsToDyn(costParams);
      const ctx: EffectCtx = {
        source: {
          cardId,
          uid: `partner:${player}`,
          abilityId: abilId,
          player,
          area: 'partner-area',
        },
        bindings: {},
        ...(dyn ? { dyn } : {}),
      };
      engineCost.pay(state, ability.cost, ctx);
    }
  }
  usePartnerAbility(state, player, abilId);
}
