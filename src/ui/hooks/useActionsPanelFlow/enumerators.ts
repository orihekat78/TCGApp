// useActionsPanelFlow/enumerators.ts — Phase 3d 分割 (候補列挙 / can-check, body 無改変移送, 2026-06-22)
import * as flow from '@/engine/flow/index.js';
import { engine } from '@/engine';
import { makeAbilityCtx } from './cost.js';
import type { Player } from './cost.js';

/**
 * 推理対象の uid 候補を engine.canReason で列挙する。
 * 対象 = 自プレイヤーの partner + 自プレイヤーの scene キャラ。
 */
export function enumReasoningCandidates(
  state: import('@/engine/types/game-state.js').GameState,
  player: Player,
): string[] {
  const candidates: string[] = [];
  const partnerUid = `partner:${player}`;
  if (flow.canReason(state, partnerUid)) candidates.push(partnerUid);
  for (const c of state.players[player].scene) {
    if (flow.canReason(state, c.uid)) candidates.push(c.uid);
  }
  return candidates;
}

/**
 * パートナー能力の候補列挙 (Phase 8.8a)。
 *
 * - パートナーカードに登録された declared ability を取り出す
 * - `flow.canPartnerAbility` で使用可能なものだけに絞る
 * - 戻り値は abilId の配列 (picker.candidates に渡す)
 */
export function enumPartnerAbilityIds(
  state: import('@/engine/types/game-state.js').GameState,
  player: Player,
): string[] {
  const cardId = state.players[player].partner.cardId;
  if (!cardId) return [];
  const def = engine.cards.get(cardId);
  if (!def) return [];
  return def.abilities
    .filter((a) => a.type === 'declared')
    .filter((a) => flow.canPartnerAbility(state, player, a.id))
    .filter((a) => {
      // Phase 8.8c: cost 支払不能な能力は除外
      if (!a.cost) return true;
      const ctx = makeAbilityCtx({
        player,
        uid: `partner:${player}`,
        cardId,
        abilityId: a.id,
        area: 'partner-area',
      });
      return engine.cost.canPay(state, a.cost, ctx);
    })
    .map((a) => a.id);
}

/**
 * 宣言能力の source 候補列挙 (Phase 8.8b)。
 *
 * - 自プレイヤーの scene キャラのうち declared ability を持つ uid を返す
 * - engine の canDeclaredAbility が必要となる ability ごとに判定されるため、
 *   ここでは「最低 1 つの declared ability が canDeclaredAbility を満たす」キャラを抽出
 * - case / partner は別フロー (8.8a パートナー能力 / case は engine 未対応)
 */
export function enumDeclaredAbilitySources(
  state: import('@/engine/types/game-state.js').GameState,
  player: Player,
): string[] {
  const sources: string[] = [];
  // 1. scene chars
  for (const c of state.players[player].scene) {
    const def = engine.cards.get(c.cardId);
    if (!def) continue;
    const hasUsable = def.abilities.some((a) => {
      if (a.type !== 'declared') return false;
      if (!flow.canDeclaredAbility(state, c.uid, a.id)) return false;
      // Phase 8.8c: cost 支払不能なら使用不可
      if (a.cost) {
        const ctx = makeAbilityCtx({
          player,
          uid: c.uid,
          cardId: c.cardId,
          abilityId: a.id,
          area: 'scene',
        });
        if (!engine.cost.canPay(state, a.cost, ctx)) return false;
      }
      return true;
    });
    if (hasUsable) sources.push(c.uid);
  }
  // 2. case card (user_request 20260522_01 #5 fix)
  const caseCardId = state.players[player].case.cardId;
  if (caseCardId) {
    const def = engine.cards.get(caseCardId);
    if (def) {
      const caseUid = `case:${player}`;
      const hasUsable = def.abilities.some((a) => {
        if (a.type !== 'declared') return false;
        if (!flow.canDeclaredAbility(state, caseUid, a.id)) return false;
        if (a.cost) {
          const ctx = makeAbilityCtx({
            player,
            uid: caseUid,
            cardId: caseCardId,
            abilityId: a.id,
            area: 'case',
          });
          if (!engine.cost.canPay(state, a.cost, ctx)) return false;
        }
        return true;
      });
      if (hasUsable) sources.push(caseUid);
    }
  }
  return sources;
}

/**
 * 指定 uid の使用可能 declared ability ids を列挙 (Phase 8.8b)。
 */
export function enumDeclaredAbilityIdsFor(
  state: import('@/engine/types/game-state.js').GameState,
  uid: string,
): string[] {
  // uid から cardId / owner player / area を引く (user_request 20260522_01 #5: case 対応)
  let cardId: string | null = null;
  let owner: Player | null = null;
  let area: 'scene' | 'case' = 'scene';
  if (uid === 'case:self' || uid === 'case:opp') {
    owner = uid === 'case:self' ? 'self' : 'opp';
    cardId = state.players[owner].case.cardId ?? null;
    area = 'case';
  } else {
    for (const p of ['self', 'opp'] as const) {
      const c = state.players[p].scene.find((x) => x.uid === uid);
      if (c) {
        cardId = c.cardId;
        owner = p;
        break;
      }
    }
  }
  if (!cardId || !owner) return [];
  const def = engine.cards.get(cardId);
  if (!def) return [];
  return def.abilities
    .filter((a) => a.type === 'declared')
    .filter((a) => flow.canDeclaredAbility(state, uid, a.id))
    .filter((a) => {
      if (!a.cost) return true;
      const ctx = makeAbilityCtx({
        player: owner!,
        uid,
        cardId: cardId!,
        abilityId: a.id,
        area,
      });
      return engine.cost.canPay(state, a.cost, ctx);
    })
    .map((a) => a.id);
}

/**
 * アクション宣言フローの target identifier: opp 事件 を表す virtual uid。
 *
 * picker.candidates に通常の scene uid と混ぜて入れることで、target ピッカー上で
 * 「相手 case (事件)」を選択可能にする。実 uid と衝突しない接頭辞 'case:' を使う。
 */
export const ACTION_CASE_TARGET_OPP = 'case:opp' as const;

/**
 * source 候補列挙: アクション可能な自プレイヤーのキャラ + パートナー (rules/07)。
 *   - flow.canAction が active / 名乗り / 迅速・突撃キーワード等の全条件をカバー
 */
export function enumActionSourceCandidates(
  state: import('@/engine/types/game-state.js').GameState,
  player: Player,
): string[] {
  const candidates: string[] = [];
  const partnerUid = `partner:${player}`;
  if (flow.canAction(state, partnerUid)) candidates.push(partnerUid);
  for (const c of state.players[player].scene) {
    if (flow.canAction(state, c.uid)) candidates.push(c.uid);
  }
  return candidates;
}

/**
 * target 候補列挙: byUid から見たアクション対象 (rules/07)。
 *   - opp.scene の sleep/stun キャラ (canActionAgainstChar 経由で target-expander 反映)
 *   - 'case:opp' (canActionAgainstCase: opp.evidence ≥ 1)
 *
 * 注: byUid 側のプレイヤーは canActionAgainstCase が判定するため、self/opp 双方の
 * 視点で同じ列挙関数を呼べる (将来 opp ターン用に拡張する場合の互換性確保)。
 */
export function enumActionTargetCandidates(
  state: import('@/engine/types/game-state.js').GameState,
  byUid: string,
): string[] {
  const candidates: string[] = [];
  // opp 側を対象に想定 (self ターン中のアクション → 相手陣に攻撃)
  for (const c of state.players.opp.scene) {
    if (flow.canActionAgainstChar(state, byUid, c.uid)) candidates.push(c.uid);
  }
  if (flow.canActionAgainstCase(state, byUid, 'opp')) {
    candidates.push(ACTION_CASE_TARGET_OPP);
  }
  return candidates;
}

/**
 * UI 側 can-check: src/ai/move-enumerator.ts canAssist と同条件。
 * ActionsPanel の disabled 表示と runAssistFlow 内 not-allowed 判定で共有する。
 */
export function canAssistForUi(
  state: import('@/engine/types/game-state.js').GameState,
  player: Player,
): boolean {
  const ps = state.players[player];
  if (ps.partner.state !== 'active') return false;
  if (ps.partner.location !== 'partner-area') return false;
  if (state.turnState[player].assistedThisTurn) return false;
  return true;
}

/**
 * UI 側 can-check: src/ai/move-enumerator.ts canSolveCase と同条件。
 */
export function canSolveCaseForUi(
  state: import('@/engine/types/game-state.js').GameState,
  player: Player,
): boolean {
  const ps = state.players[player];
  if (ps.case.status !== '解決編') return false;
  if (ps.evidence.length < ps.case.requiredEvidence) return false;
  if (ps.partner.state !== 'active') return false;
  if (state.turnState[player].assistedThisTurn) return false;
  // E3 P53: 「自分は【事件解決】できない」case (B09107) は事件解決不可 (canWin / AI canSolveCase と同 gate)
  if (engine.read.game.cannotSolveCase(state, player)) return false;
  return true;
}

