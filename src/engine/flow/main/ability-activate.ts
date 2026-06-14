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
import { findCardOnBoard, useDeclaredAbility } from './declared-ability.js';
import { usePartnerAbility } from './partner-ability.js';

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
  sceneToDeckBottom?: { uids: string[] };
  removeAreaToDeckBottom?: { ids: string[] }; // cluster4 (2026-06-14)
  costChoice?: number;
  choiceIndex?: number;
}

function costParamsToDyn(costParams?: AbilityCostParams): Record<string, unknown> | undefined {
  if (!costParams) return undefined;
  const dyn: Record<string, unknown> = {};
  const params: Record<string, unknown> = {};
  if (costParams.flipFaceUpEvidence) params['flipFaceUpEvidence'] = costParams.flipFaceUpEvidence;
  if (costParams.sceneToDeckBottom) params['sceneToDeckBottom'] = costParams.sceneToDeckBottom;
  if (costParams.removeAreaToDeckBottom) params['removeAreaToDeckBottom'] = costParams.removeAreaToDeckBottom; // cluster4
  if (Object.keys(params).length > 0) dyn['costParams'] = params;
  if (costParams.costChoice !== undefined) dyn['costChoice'] = costParams.costChoice;
  if (costParams.choiceIndex !== undefined) dyn['choiceIndex'] = costParams.choiceIndex;
  return Object.keys(dyn).length > 0 ? dyn : undefined;
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
    useDeclaredAbility(state, uid, abilId);
    return;
  }
  const dyn = costParamsToDyn(costParams);
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
  const ability = findAbility(found.cardId, abilId);
  if (ability?.cost) {
    engineCost.pay(state, ability.cost, ctx);
  }
  useDeclaredAbility(state, uid, abilId, ctx);
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
      const dyn = costParamsToDyn(costParams);
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
