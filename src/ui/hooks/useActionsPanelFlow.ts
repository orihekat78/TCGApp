// Phase 8 Task 8.5: ActionsPanel 操作フローのオーケストレーション
//
// spec: .claude/specs/2026-05-11-ui-action-flows.md
//
// このファイルは Task 8.1 (useEngineDispatch) + Task 8.3 (useConfirmation) を
// 組み合わせて、ActionsPanel の各ボタンが実行すべき非同期フローを提供する。
//
// Phase 8.5 では endTurn のみ実装。reasoning / action / handUseCard / nextHint /
// partnerAbility / declaredAbility / assist / solveCase は target picker や
// source unit selection を要するため Task 8.6+ で順次実装する。

import * as flow from '@/engine/flow/index.js';
import { engine } from '@/engine';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction, type DispatchResult } from './useEngineDispatch.js';
import { useConfirmation } from './useConfirmation.js';
import { useTargetPicker } from './useTargetPicker.js';
import { useSceneSwitchPickerStore } from './useSceneSwitchPickerStore.js';
import { def as readDef } from '@/engine/read/def.js';
import type { Cost, EffectCtx } from '@/engine/types';

/**
 * Phase 8.8c: cost を人間可読なテキストに変換 (confirm modal body 表示用)。
 */
function costToText(cost: Cost): string {
  switch (cost.kind) {
    case 'sleepSelf':         return 'このキャラをスリープ';
    case 'sleepChar':         return 'キャラ 1 枚をスリープ';
    case 'removeFromHand':    return `手札 ${cost.n} 枚をリムーブ`;
    case 'removeFromScene':   return `現場 ${cost.n} 枚をリムーブ`;
    case 'removeDeckTop':     return `デッキ上 ${cost.n} 枚をリムーブ`;
    case 'discardEvidence':   return `証拠 ${cost.n} 枚をリムーブ`;
    case 'selfToDeckBottom':  return 'このキャラをデッキの下へ';
    case 'pay':               return cost.items.map(costToText).join(' + ');
    case 'choice':            return cost.items.map(costToText).join(' / ');
    case 'fileFrom':          return `FILE から ${cost.n} 枚`;
    case 'flipFaceUpEvidence':return `証拠 ${cost.n.min}〜${cost.n.max} 枚を表向きに`;
    case 'custom':            return '(独自コスト)';
  }
}

/**
 * EffectCtx を能力 cost.pay / canPay 用に構築。
 */
function makeAbilityCtx(opts: {
  player: Player;
  uid: string;
  cardId: string;
  abilityId: string;
  area: 'scene' | 'partner-area';
}): EffectCtx {
  return {
    source: {
      cardId: opts.cardId,
      uid: opts.uid,
      abilityId: opts.abilityId,
      player: opts.player,
      area: opts.area,
    },
    bindings: {},
  };
}

type Player = 'self' | 'opp';

/** runEndTurnFlow / その他フローの返り値 */
export type FlowResult =
  | DispatchResult
  | { ok: false; reason: 'cancelled' };

/**
 * ターン終了フロー: 確認モーダル → accept で endTurn dispatch。
 *
 * - reject: { ok:false, reason:'cancelled' } (state 不変)
 * - accept: dispatchEngineAction の結果をそのまま返す
 */
export async function runEndTurnFlow(opts: { player: Player }): Promise<FlowResult> {
  const confirmation = useConfirmation();
  const accepted = await confirmation.ask({
    kind: 'standard',
    title: 'ターン終了',
    body: 'メインフェイズを終了し、相手のターンに移行します。',
    okLabel: 'ターン終了',
    cancelLabel: '戻る',
  });
  if (!accepted) {
    return { ok: false, reason: 'cancelled' };
  }
  return dispatchEngineAction({ type: 'endTurn', player: opts.player });
}

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
 * 推理フロー: target picker で対象選択 → confirm → reasoning dispatch。
 *
 * rules: 11-reasoning.md (active 必要、名乗り例外あり)、13-keywords.md (迅速)
 * spec: ui-action-flows.md ①推理
 *
 * - no-state / 0 候補 → 即時 abort
 * - picker cancel / confirm reject → { ok:false, reason:'cancelled' }
 * - accept → dispatchEngineAction reasoning の戻り値
 */
export async function runReasoningFlow(opts: { player: Player }): Promise<FlowResult> {
  const state = useGameStateStore.getState().gameState;
  if (state === null) return { ok: false, reason: 'no-state' };

  const candidates = enumReasoningCandidates(state, opts.player);

  const picker = useTargetPicker();
  const chosen = await picker.start({ candidates, purpose: 'reasoning' });
  if (chosen === null) {
    return { ok: false, reason: 'cancelled' };
  }

  const confirmation = useConfirmation();
  const accepted = await confirmation.ask({
    kind: 'standard',
    title: '推理',
    body: `${chosen} で推理します。`,
    okLabel: '推理',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };

  return dispatchEngineAction({ type: 'reasoning', uid: chosen });
}

/**
 * ネクストヒントフロー: 確認 → FILE 最上部を手札に + 続けて使用可。
 *
 * rules: 12-next-hint.md, 17-icons.md (【FILE(X)】)
 * spec: ui-action-flows.md ⑥ネクストヒント
 *
 * - canStartNextHint=false → not-allowed
 * - reject → cancelled
 * - accept → dispatchEngineAction nextHint (optionalCardId は MVP では省略、
 *   FILE pop + nextHintUsed フラグのみ。次段で「続けて 1 枚使用」UI を実装予定)
 */
export async function runNextHintFlow(opts: { player: Player }): Promise<FlowResult> {
  const state = useGameStateStore.getState().gameState;
  if (state === null) return { ok: false, reason: 'no-state' };
  if (!flow.canStartNextHint(state, opts.player)) {
    return { ok: false, reason: 'not-allowed' };
  }
  const fileCount = state.players[opts.player].file.length;
  const accepted = await useConfirmation().ask({
    kind: 'standard',
    title: 'ネクストヒント',
    body: `FILE 最上部 (現在 ${fileCount} 枚) のカードを手札に加え、続けて 1 枚使用できます。`,
    okLabel: 'ネクストヒント',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };
  return dispatchEngineAction({ type: 'nextHint', player: opts.player });
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
 * パートナー能力フロー (Phase 8.8a, spec: ui-action-flows.md ③):
 *   1. enumPartnerAbilityIds で使用可能能力を列挙
 *   2. 0 件 → not-allowed
 *   3. 1 件なら即 confirm、複数なら picker (purpose='partner-ability') で選択
 *   4. confirm モーダル → accept → dispatch `partnerAbility`
 *
 * rules: 13-keywords.md (パートナー共通能力) / 21-declared-ability-cost.md
 *
 * 注: cost 解決は engine の `usePartnerAbility` 内 effect listener が担当。
 * 明示的な cost.pay 呼出は Phase 8.8c (cost UI) で追加予定。
 */
export async function runPartnerAbilityFlow(opts: { player: Player }): Promise<FlowResult> {
  const state = useGameStateStore.getState().gameState;
  if (state === null) return { ok: false, reason: 'no-state' };
  const ids = enumPartnerAbilityIds(state, opts.player);
  if (ids.length === 0) return { ok: false, reason: 'not-allowed' };

  let chosenId: string;
  if (ids.length === 1) {
    chosenId = ids[0];
  } else {
    const picker = useTargetPicker();
    const picked = await picker.start({ candidates: ids, purpose: 'partner-ability' });
    if (picked === null) return { ok: false, reason: 'cancelled' };
    chosenId = picked;
  }

  // Phase 8.8c: cost 情報を取得 (modal 本文 + dispatch atomic payment 用)
  const partner = state.players[opts.player].partner;
  const partnerDef = partner.cardId ? engine.cards.get(partner.cardId) : null;
  const chosenAbil = partnerDef?.abilities.find((a) => a.id === chosenId);
  const cost = chosenAbil?.cost;
  const ctx = partner.cardId
    ? makeAbilityCtx({
        player: opts.player,
        uid: `partner:${opts.player}`,
        cardId: partner.cardId,
        abilityId: chosenId,
        area: 'partner-area',
      })
    : undefined;
  const costText = cost ? costToText(cost) : '無し';

  const accepted = await useConfirmation().ask({
    kind: 'standard',
    title: 'パートナー能力',
    body: `${chosenId} を発動します。\nコスト: ${costText}`,
    okLabel: '発動',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };

  return dispatchEngineAction({
    type: 'partnerAbility',
    player: opts.player,
    abilId: chosenId,
    ...(cost && ctx ? { cost, ctx } : {}),
  });
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
  return sources;
}

/**
 * 指定 uid の使用可能 declared ability ids を列挙 (Phase 8.8b)。
 */
export function enumDeclaredAbilityIdsFor(
  state: import('@/engine/types/game-state.js').GameState,
  uid: string,
): string[] {
  // uid から cardId / owner player を引く
  let cardId: string | null = null;
  let owner: Player | null = null;
  for (const p of ['self', 'opp'] as const) {
    const c = state.players[p].scene.find((x) => x.uid === uid);
    if (c) {
      cardId = c.cardId;
      owner = p;
      break;
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
        area: 'scene',
      });
      return engine.cost.canPay(state, a.cost, ctx);
    })
    .map((a) => a.id);
}

/**
 * 宣言能力フロー (Phase 8.8b, spec: ui-action-flows.md ④):
 *   1. enumDeclaredAbilitySources で使用可能なキャラ uid を列挙
 *   2. 0 件 → not-allowed
 *   3. 1 件なら即その uid、複数なら picker (purpose='declared-ability:source')
 *   4. 選択 source の ability ids を列挙
 *   5. 1 件なら即その abilId、複数なら picker (purpose='declared-ability:ability')
 *   6. confirm → dispatch declaredAbility
 *
 * rules: 21-declared-ability-cost.md (cost は engine 内部、8.8c で UI 化予定)
 *
 * Phase 8.8b スコープ外: case 由来の declared ability (engine 未対応) /
 * パートナーエリアの MR (rules/18) — 8.8a partnerAbility 経由なので別フロー
 */
export async function runDeclaredAbilityFlow(opts: { player: Player }): Promise<FlowResult> {
  const state0 = useGameStateStore.getState().gameState;
  if (state0 === null) return { ok: false, reason: 'no-state' };
  const sources = enumDeclaredAbilitySources(state0, opts.player);
  if (sources.length === 0) return { ok: false, reason: 'not-allowed' };

  const picker = useTargetPicker();

  // 1) source 選択 (1 件なら省略)
  let sourceUid: string;
  if (sources.length === 1) {
    sourceUid = sources[0];
  } else {
    const picked = await picker.start({ candidates: sources, purpose: 'declared-ability:source' });
    if (picked === null) return { ok: false, reason: 'cancelled' };
    sourceUid = picked;
  }

  // 2) ability 選択
  const stateAfterSrc = useGameStateStore.getState().gameState;
  if (stateAfterSrc === null) return { ok: false, reason: 'no-state' };
  const abilIds = enumDeclaredAbilityIdsFor(stateAfterSrc, sourceUid);
  if (abilIds.length === 0) return { ok: false, reason: 'not-allowed' };

  let chosenAbilId: string;
  if (abilIds.length === 1) {
    chosenAbilId = abilIds[0];
  } else {
    const picked = await picker.start({ candidates: abilIds, purpose: 'declared-ability:ability' });
    if (picked === null) return { ok: false, reason: 'cancelled' };
    chosenAbilId = picked;
  }

  // 3) cost 情報を取得して confirm
  let cardId: string | null = null;
  let owner: Player | null = null;
  for (const p of ['self', 'opp'] as const) {
    const c = stateAfterSrc.players[p].scene.find((x) => x.uid === sourceUid);
    if (c) {
      cardId = c.cardId;
      owner = p;
      break;
    }
  }
  const charDef = cardId ? engine.cards.get(cardId) : null;
  const chosenAbil = charDef?.abilities.find((a) => a.id === chosenAbilId);
  const cost = chosenAbil?.cost;
  const ctx = cardId && owner
    ? makeAbilityCtx({
        player: owner,
        uid: sourceUid,
        cardId,
        abilityId: chosenAbilId,
        area: 'scene',
      })
    : undefined;
  const costText = cost ? costToText(cost) : '無し';

  const accepted = await useConfirmation().ask({
    kind: 'standard',
    title: '宣言能力',
    body: `${sourceUid} の ${chosenAbilId} を発動します。\nコスト: ${costText}`,
    okLabel: '発動',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };

  // 4) dispatch (cost あれば atomic に pay → use)
  return dispatchEngineAction({
    type: 'declaredAbility',
    uid: sourceUid,
    abilId: chosenAbilId,
    ...(cost && ctx ? { cost, ctx } : {}),
  });
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
 * アクション宣言フロー: source 選択 → target 選択 → 確認 → dispatch。
 *
 * rules: 07-action-flow.md / 08-contact.md / 10-action-event.md / 13-keywords.md
 * spec: ui-action-flows.md ⑤アクション
 *
 * Phase 8.7a スコープ: 相手 CPU はガード/カットイン/変装を行わない簡略実装
 * (engine の policy.applyMove と同シーケンスで FSM を端まで進める)。
 * 対話的なガード/カットイン UI は Phase 8.7b 以降で追加。
 *
 * - no-state → no-state
 * - source 候補 0 または target 候補 0 → not-allowed
 * - picker cancel / confirm reject → cancelled
 * - accept → dispatchEngineAction の結果そのまま
 */
export async function runActionFlow(opts: { player: Player }): Promise<FlowResult> {
  const state = useGameStateStore.getState().gameState;
  if (state === null) return { ok: false, reason: 'no-state' };

  const sources = enumActionSourceCandidates(state, opts.player);
  if (sources.length === 0) return { ok: false, reason: 'not-allowed' };

  const picker = useTargetPicker();

  // 1. source 選択
  const source = await picker.start({ candidates: sources, purpose: 'action:source' });
  if (source === null) return { ok: false, reason: 'cancelled' };

  // 2. target 候補列挙 (source 確定後の state で)
  const stateAfterSrc = useGameStateStore.getState().gameState;
  if (stateAfterSrc === null) return { ok: false, reason: 'no-state' };
  const targets = enumActionTargetCandidates(stateAfterSrc, source);
  if (targets.length === 0) return { ok: false, reason: 'not-allowed' };

  // 3. target 選択
  const target = await picker.start({ candidates: targets, purpose: 'action:target' });
  if (target === null) return { ok: false, reason: 'cancelled' };

  // 4. 確認
  const isCase = target === ACTION_CASE_TARGET_OPP;
  const targetLabel = isCase ? '相手の事件' : target;
  const accepted = await useConfirmation().ask({
    kind: 'standard',
    title: 'アクション',
    body: `${source} で ${targetLabel} にアクションします。`,
    okLabel: 'アクション',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };

  // 5. dispatch — Phase 8 完全クローズ Commit 2:
  //   人間プレイヤーが attacker の場合は per-step dispatch で driver に委譲する。
  //   declare → ガード判定 → コンタクト → AP判定 までは useContactFlowDriver が
  //   activeActionId を監視して進める (CPU defender は AI 自動・self defender は
  //   将来追加されるモーダル経由)。既存の actionAgainstChar/actionAgainstCase は
  //   CPU vs CPU シナリオ用に温存。
  if (isCase) {
    return dispatchEngineAction({
      type: 'actionDeclareCase',
      byUid: source,
      targetPlayer: 'opp',
    });
  }
  return dispatchEngineAction({
    type: 'actionDeclareChar',
    byUid: source,
    targetUid: target,
  });
}

/**
 * 手札の使用フロー: 確認モーダル → accept → engine.handUseCard dispatch。
 *
 * rules: 05-turn-phases.md §手札の使用 (1 ターン 1 回 / ネクストヒント済不可) /
 *        20-color-and-switch.md (色制限) / 12-next-hint.md (レベル制限)
 * spec: ui-action-flows.md ①手札の使用
 *
 * - no-state → no-state
 * - canHandUseCard=false → not-allowed (色/レベル/フラグ/手札不在 全てここで弾く)
 * - reject → cancelled
 * - accept → dispatchEngineAction handUseCard
 *
 * カード効果の実体 (キャラ登場 / イベント効果) は engine の effect:declared hook と
 * Phase 5 listener が pendingEffects に積み、`runAllUntilEmpty` (dispatchEngineAction
 * 内 wrap) が解決する。本フローは「フラグ + ログ + hook emit」までの責任。
 */
export async function runHandUseFlow(opts: {
  player: Player;
  cardId: string;
}): Promise<FlowResult> {
  const state = useGameStateStore.getState().gameState;
  if (state === null) return { ok: false, reason: 'no-state' };

  // rules/20 §スイッチ: scene=5 でキャラ使用したい場合は switch 経路。
  const canNormal = flow.canHandUseCard(state, opts.player, opts.cardId);
  const canSwitch = !canNormal && flow.canHandUseCardSwitch(state, opts.player, opts.cardId);
  if (!canNormal && !canSwitch) {
    return { ok: false, reason: 'not-allowed' };
  }

  const accepted = await useConfirmation().ask({
    kind: 'standard',
    title: '手札の使用',
    body: `${opts.cardId} を使用します。`,
    okLabel: '使用',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };

  if (canNormal) {
    return dispatchEngineAction({
      type: 'handUseCard',
      player: opts.player,
      cardId: opts.cardId,
    });
  }

  // switch 経路: SceneSwitchPickerModal を Promise で待機。
  // candidates は現場全 char (アクティブ / スリープ / スタン / 名乗り 全て可、rules/20)。
  const sceneChars = state.players[opts.player].scene.map((c) => ({
    uid: c.uid,
    cardId: c.cardId,
    name: readDef.card(c.cardId)?.names?.[0] ?? c.cardId,
    state: c.state,
    isNamed: c.isNamed,
  }));
  const newCardName = readDef.card(opts.cardId)?.names?.[0] ?? opts.cardId;
  const removeUid = await new Promise<string | null>((resolve) => {
    useSceneSwitchPickerStore.getState()._open({
      cardId: opts.cardId,
      newCardName,
      candidates: sceneChars,
      resolve,
    });
  });
  if (removeUid === null) return { ok: false, reason: 'cancelled' };
  return dispatchEngineAction({
    type: 'handUseCardSwitch',
    player: opts.player,
    cardId: opts.cardId,
    removeUid,
  });
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
  return true;
}

/**
 * アシストフロー: warning モーダル → accept → mutate.partner.assist。
 *
 * rules: 13-keywords.md §アシスト / 01-victory-conditions.md §アシストしたターンは勝利できない
 * spec: ui-action-flows.md ③アシスト
 *
 * - no-state / not-allowed → reason そのまま返す (state 不変)
 * - reject → cancelled
 * - accept → dispatchEngineAction assist の戻り値
 *
 * 注: assist 後の FILE 7 枚到達 → 解決編 自動移行は engine 側 (mutate.partner.assist →
 * mutate.file.insertAssistedPartner) で処理されるため UI は気にしない。
 */
export async function runAssistFlow(opts: { player: Player }): Promise<FlowResult> {
  const state = useGameStateStore.getState().gameState;
  if (state === null) return { ok: false, reason: 'no-state' };
  if (!canAssistForUi(state, opts.player)) {
    return { ok: false, reason: 'not-allowed' };
  }
  const fileCount = state.players[opts.player].file.length;
  const accepted = await useConfirmation().ask({
    kind: 'warning',
    title: 'アシスト',
    body:
      `パートナーをスリープしてFILEへ移動します (現在 FILE ${fileCount} 枚 → ${fileCount + 1} 枚)。` +
      'このターン中は事件解決できなくなります。',
    okLabel: 'アシスト',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };
  return dispatchEngineAction({ type: 'assist', player: opts.player });
}

/**
 * 事件解決フロー: victory モーダル → accept → mutate.partner.solveCase でゲーム勝利。
 *
 * rules: 01-victory-conditions.md §事件解決
 * spec: ui-action-flows.md ④事件解決
 *
 * - no-state / not-allowed → そのまま返す
 * - reject → cancelled
 * - accept → dispatchEngineAction solveCase。`gameResult.winner` がセットされる。
 */
export async function runSolveCaseFlow(opts: { player: Player }): Promise<FlowResult> {
  const state = useGameStateStore.getState().gameState;
  if (state === null) return { ok: false, reason: 'no-state' };
  if (!canSolveCaseForUi(state, opts.player)) {
    return { ok: false, reason: 'not-allowed' };
  }
  const ps = state.players[opts.player];
  const accepted = await useConfirmation().ask({
    kind: 'victory',
    title: '事件解決 ★勝利',
    body:
      `必要証拠 ${ps.case.requiredEvidence} 件 / 現在 ${ps.evidence.length} 件。` +
      'パートナーをスリープして勝利を宣言します。',
    okLabel: '事件解決',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };
  return dispatchEngineAction({ type: 'solveCase', player: opts.player });
}
