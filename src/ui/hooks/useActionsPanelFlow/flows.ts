// useActionsPanelFlow/flows.ts — Phase 3d 分割 (run*Flow オーケストレーション, body 無改変移送, 2026-06-22)
import { useSyncExternalStore } from 'react';
import * as flow from '@/engine/flow/index.js';
import { engine } from '@/engine';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction, type DispatchResult } from '../useEngineDispatch.js';
import { useConfirmation } from '../useConfirmation.js';
import { useTargetPicker } from '../useTargetPicker.js';
import { useNextHintPicker, type NextHintCandidate } from '../useNextHintPicker.js';
import { useSceneSwitchPickerStore } from '../useSceneSwitchPickerStore.js';
import { currentInteractionEpoch, isCurrentLiveInteraction } from '@/ui/services/terminalInteractionGate.js';
import { useEvidenceFlipPicker } from '../useEvidenceFlipPicker.js';
import { useHandCostPicker } from '../useHandCostPicker.js';
import { useStackedCardCostPicker } from '../useStackedCardCostPicker.js';
import { useSetCardCostPicker } from '../useSetCardCostPicker.js';
import { useChoicePicker } from '../useChoicePicker.js';
import { useDeclareNamePicker } from '../useDeclareNamePicker.js';
import { declaredNameCandidates } from '@/engine/effect/declared-name-domain.js';
import { def as readDef } from '@/engine/read/def.js';
import { alternativeCostProviders } from '@/engine/cost/alternative.js';
import { eligibleRemoveSetCards } from '@/engine/cost/remove-set-card-eligible.js';
import { canOfferNextHintOptionalCard } from '@/engine/flow/main/next-hint.js';
import { effectiveHandLevel } from '@/engine/flow/main/hand-use-card.js';
import { sceneCap } from '@/engine/read/scene-cap.js';
import { uidToDisplayName, cardIdToDisplayName } from '@/ui/services/uidNames.js';
import { FILE_CARD_BACK_PLACEHOLDER, type Candidate, type Effect } from '@/engine/types';
import type { AbilityCostParams } from '@/engine/flow/index.js';
import { costToText, findFlipFaceUpCost, findRemoveFromHandCost, findRemoveStackedCardsCost, findRemoveSetCardCost, findCharacterStateCost, findChoiceCostAtPath, completeCostChoicePaths, findDeclareNameAtom, choiceOptionLabel, makeAbilityCtx } from './cost.js';
import type { Player } from './cost.js';
import {
  ACTION_CASE_TARGET_OPP,
  enumReasoningCandidates,
  enumPartnerAbilityIds,
  enumDeclaredAbilitySources,
  enumDeclaredAbilityChoicesFor,
  enumActionSourceCandidates,
  enumActionTargetCandidates,
  canAssistForUi,
  canSolveCaseForUi,
} from './enumerators.js';
import { canEndTurnForUi, subscribeEndTurnContract } from './end-turn-contract.js';
import { selectInteractionLocked } from '@/ui/state/interactionLock.js';

/** runEndTurnFlow / その他フローの返り値 */
export type FlowResult =
  | DispatchResult
  | { ok: false; reason: 'cancelled' };

/** Playmatもdispatch直前検証も同一のcanEndTurnForUi snapshotを使うreactive reader。 */
export function useCanEndTurnForUi(player: Player): boolean {
  return useSyncExternalStore(
    subscribeEndTurnContract,
    () => canEndTurnForUi(player),
    () => canEndTurnForUi(player),
  );
}

/**
 * ターン終了フロー: 確認モーダル → accept で endTurn dispatch。
 *
 * - reject: { ok:false, reason:'cancelled' } (state 不変)
 * - accept: dispatchEngineAction の結果をそのまま返す
 */
export async function runEndTurnFlow(opts: { player: Player }): Promise<FlowResult> {
  if (!canEndTurnForUi(opts.player)) return { ok: false, reason: 'not-allowed' };
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
  // 確認表示中に効果/picker が発生し得るため、dispatch 直前の最新stateで再検証。
  if (!canEndTurnForUi(opts.player)) return { ok: false, reason: 'not-allowed' };
  return dispatchEngineAction({ type: 'endTurn', player: opts.player });
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
  // Round 2: uid → 名前解決して人間可読 ("partner:self" → "江戸川コナン")。
  const chosenName = uidToDisplayName(state, chosen);
  const accepted = await confirmation.ask({
    kind: 'standard',
    title: '推理',
    body: `${chosenName} で推理します。`,
    okLabel: '推理',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };

  return dispatchEngineAction({ type: 'reasoning', uid: chosen });
}

/**
 * ネクストヒントフロー: picker で step1 (FILE→手札) + step2 (任意 1 枚使用) を提示。
 *
 * rules: 12-next-hint.md, 17-icons.md (【FILE(X)】), 20-color-and-switch.md (色制限)
 * spec: ui-action-flows.md ⑥ネクストヒント / plan「ネクストヒント step2 UI 実装」
 *
 * Option A (atomic, engine 不変): engine runNextHint(state, p, optionalCardId?) が
 * step1+step2 を 1 call で atomic 実行する設計を活かし、UI 側で候補を事前提示する。
 * これにより ❶❷ の間に他行動を挟む隙間が構造的に発生しない (rules/12 §Point)。
 *
 * フロー:
 *   1. canStartNextHint check
 *   2. FILE 最上部 cardId を算出 (配列末尾の非 assisted-partner、popTop と同ロジック)
 *   3. postPopCount = (非アシスト FILE 枚数 - 1)。候補 = FILE-top + 手札を
 *      level ≤ postPopCount かつ 色 ⊆ 事件色 で filter (rules/12 + rules/20)
 *   4. picker 提示 → use(cardId) / skip / cancel
 *   5. use → dispatch nextHint(optionalCardId) / skip → dispatch nextHint() / cancel → no-op
 *
 * NOTE: NH step2 のカード使用は handUseUsed を消費しない (engine が nextHintUsed のみ set)。
 */
export async function runNextHintFlow(opts: { player: Player }): Promise<FlowResult> {
  const state = useGameStateStore.getState().gameState;
  if (state === null) return { ok: false, reason: 'no-state' };
  const p = opts.player;
  if (!flow.canStartNextHint(state, p)) {
    return { ok: false, reason: 'not-allowed' };
  }

  // FILE 最上部 (非 assisted-partner) = 配列末尾から探す (mutate/file.ts popTop と同ロジック)
  const file = state.players[p].file;
  let fileTopCardId: string | null = null;
  for (let i = file.length - 1; i >= 0; i--) {
    if (file[i]!.type !== 'assisted-partner') { fileTopCardId = file[i]!.cardId; break; }
  }
  if (fileTopCardId === null) return { ok: false, reason: 'not-allowed' };

  // rules/12: step1 で抜いた分は step2 の FILE 枚数判定に数えない → file.length - 1。
  // BUG-094: rules/17 【FILE(X)】「アシストしているパートナーも枚数に数える」。閾値は
  // file.length (アシスト中パートナー含む) を基準にする (engine next-hint.ts:89 の post-pop
  // file.length 判定と一致)。旧実装は nonAssistedCount (パートナー除外) を使い、アシスト中は
  // 閾値が 1 少なくなって level=FILE枚数 のカードが候補から漏れていた (BUG-087 の base 誤り)。
  const postPopCount = file.length - 1;
  /** level ≤ postPopCount かつ 色 ⊆ 事件色 の キャラ/イベント のみ候補化 */
  const toCandidate = (cardId: string, source: 'file' | 'hand'): NextHintCandidate | null => {
    const d = readDef.card(cardId);
    if (!d) return null;
    if (d.kind !== 'character' && d.kind !== 'event') return null;
    // Engineと同じpost-pop preflight。色/level/event条件/使用禁止/事件の
    // 手札使用制限を一括判定し、満杯時のswitch victimだけは次pickerで選ぶ。
    if (!canOfferNextHintOptionalCard(state, p, cardId)) return null;
    // レベル ≤ postPopCount (rules/12)
    // 表示levelも有効値 (公式 QA: 手札にある間はそのレベル)。
    const lvl = effectiveHandLevel(state, p, cardId);
    if (lvl !== undefined && lvl > postPopCount) return null;
    return {
      cardId,
      source,
      name: d.names?.[0] ?? cardId,
      level: lvl ?? 0,
      kind: d.kind,
    };
  };

  const candidates: NextHintCandidate[] = [];
  const fileTopCand = toCandidate(fileTopCardId, 'file');
  if (fileTopCand) candidates.push(fileTopCand);
  for (const cardId of state.players[p].hand) {
    const c = toCandidate(cardId, 'hand');
    if (c) candidates.push(c);
  }

  const fileTopName = readDef.card(fileTopCardId)?.names?.[0] ?? fileTopCardId;
  const choice = await useNextHintPicker().ask({ fileTopCardId, fileTopName, candidates, postPopCount });

  if (choice.kind === 'cancel') return { ok: false, reason: 'cancelled' };
  if (choice.kind === 'use') {
    const chosenDef = readDef.card(choice.cardId);
    if (chosenDef?.kind === 'character' && state.players[p].scene.length >= sceneCap(state, p)) {
      const sceneChars = state.players[p].scene.map(character => ({
        uid: character.uid,
        cardId: character.cardId,
        name: readDef.card(character.cardId)?.names?.[0] ?? character.cardId,
        state: character.state,
        isNamed: character.isNamed,
      }));
      const interactionEpoch = currentInteractionEpoch();
      const switchRemoveUid = await new Promise<string | null>(resolve => {
        useSceneSwitchPickerStore.getState()._open({
          player: p,
          cardId: choice.cardId,
          newCardName: chosenDef.names?.[0] ?? choice.cardId,
          candidates: sceneChars,
          resolve,
        });
      });
      if (!isCurrentLiveInteraction(interactionEpoch)) return { ok: false, reason: 'not-allowed' };
      if (switchRemoveUid === null) return { ok: false, reason: 'cancelled' };
      return dispatchEngineAction({
        type: 'nextHint',
        player: p,
        optionalCardId: choice.cardId,
        switchRemoveUid,
      });
    }
    return dispatchEngineAction({ type: 'nextHint', player: p, optionalCardId: choice.cardId });
  }
  // skip: step1 のみ (FILE→手札、使用しない)
  return dispatchEngineAction({ type: 'nextHint', player: p });
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
    // Ability ids are not board UIDs. Present the existing public choice modal
    // instead of routing them through TargetPicker, which has no clickable
    // surface for `a1` / `a2` candidates.
    const partnerCardId = state.players[opts.player].partner.cardId;
    const partnerDef = partnerCardId ? engine.cards.get(partnerCardId) : null;
    const options = ids.map((id, index) => {
      const ability = partnerDef?.abilities.find((entry) => entry.id === id);
      return { index, label: ability?.description ?? `能力 (${id})` };
    });
    const choice = await useChoicePicker().ask({
      sourceName: partnerCardId ? cardIdToDisplayName(partnerCardId) : 'パートナー',
      options,
    });
    if (choice.kind === 'cancel') return { ok: false, reason: 'cancelled' };
    chosenId = ids[choice.index];
  }

  // Phase 8.8c: cost 情報を取得 (modal 本文表示用)。
  // Phase 2c: cost+ctx 構築 + pay は dispatcher (engine.flow.activatePartnerAbility) 側へ一元化。
  const partner = state.players[opts.player].partner;
  const partnerDef = partner.cardId ? engine.cards.get(partner.cardId) : null;
  const chosenAbil = partnerDef?.abilities.find((a) => a.id === chosenId);
  const cost = chosenAbil?.cost;
  // mega-wave W5 (r37): {dyn} n コスト (removeDeckTop 等) を confirm modal で実数表示するための resolve。
  const costText = cost
    ? costToText(cost, { state, ctx: { source: { player: opts.player, area: 'partner-area' }, bindings: {} } })
    : '無し';

  // Round 2: partner cardId → 名前解決して "[江戸川コナン] の [ability] を発動します" 表示。
  const partnerName = partner.cardId
    ? cardIdToDisplayName(partner.cardId)
    : 'パートナー';
  const accepted = await useConfirmation().ask({
    kind: 'standard',
    title: 'パートナー能力',
    body: `${partnerName} の能力 (${chosenId}) を発動します。\nコスト: ${costText}`,
    okLabel: '発動',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };

  return dispatchEngineAction({
    type: 'partnerAbility',
    player: opts.player,
    abilId: chosenId,
  });
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

  // 1) source 選択
  // 2026-05-30 user_request: 1 件でも自動選択せず必ず picker を通し、宣言できるカードを
  // 盤面で黄色強調 → クリック → その後に確認文言、という順序にする。
  const picked = await picker.start({ candidates: sources, purpose: 'declared-ability:source' });
  if (picked === null) return { ok: false, reason: 'cancelled' };
  const sourceUid: string = picked;

  // 2) ability 選択
  const stateAfterSrc = useGameStateStore.getState().gameState;
  if (stateAfterSrc === null) return { ok: false, reason: 'no-state' };
  const abilityChoices = enumDeclaredAbilityChoicesFor(stateAfterSrc, sourceUid);
  if (abilityChoices.length === 0) return { ok: false, reason: 'not-allowed' };

  let chosenAbilityChoice: typeof abilityChoices[number];
  if (abilityChoices.length === 1) {
    chosenAbilityChoice = abilityChoices[0];
  } else {
    // BUG-172 (2026-07-04, step12 batch2): 旧実装は picker.start({candidates: abilIds,
    // purpose:'declared-ability:ability'}) だったが、Playmat の picking UI は盤面 uid の
    // 強調のみで ability id ('a1'/'a2') にはクリック面が存在せず、flow が永久 await で hang
    // していた (宣言能力 2 つ持ちの human 経路は B09108 が初実戦 — 既出荷 B05028/B05045/B06069
    // も同 latent)。ChoicePickerModal (BUG-108 の択一 modal) を能力説明文で流用する。
    const srcName = uidToDisplayName(useGameStateStore.getState().gameState!, sourceUid);
    const options = abilityChoices.map((choice, index) => {
      const occurrenceLabel = choice.setCardId
        ? `\n発生元: ${cardIdToDisplayName(choice.setCardId)}（${index + 1}件目）`
        : '';
      return { index, label: `${choice.description}${occurrenceLabel}` };
    });
    const choice = await useChoicePicker().ask({ sourceName: srcName, options });
    if (choice.kind === 'cancel') return { ok: false, reason: 'cancelled' };
    chosenAbilityChoice = abilityChoices[choice.index];
  }
  const chosenAbilId = chosenAbilityChoice.abilId;
  const chosenSourceRef = {
    ...(chosenAbilityChoice.setCardId ? { setCardId: chosenAbilityChoice.setCardId } : {}),
    ...(chosenAbilityChoice.setCardInstanceId
      ? { setCardInstanceId: chosenAbilityChoice.setCardInstanceId }
      : {}),
    ...(chosenAbilityChoice.abilityOrigin
      ? { abilityOrigin: chosenAbilityChoice.abilityOrigin }
      : {}),
    ...(chosenAbilityChoice.abilityIndex !== undefined
      ? { abilityIndex: chosenAbilityChoice.abilityIndex }
      : {}),
  };

  // 3) cost 情報を取得して confirm (user_request 20260522_01 #5: case 対応)
  // Phase 2c: cost+ctx 構築 + pay は dispatcher (engine.flow.activateDeclaredAbility) 側へ
  // 一元化。本フローは picker 選択値を costParams に集めて dispatch へ渡すのみ。
  let cardId: string | null = null;
  let owner: Player | null = null;
  let sourceArea: 'scene' | 'case' | 'hand' | 'partner-area' | 'evidence' | 'file' = 'scene';
  if (sourceUid === 'case:self' || sourceUid === 'case:opp') {
    owner = sourceUid === 'case:self' ? 'self' : 'opp';
    cardId = stateAfterSrc.players[owner].case.cardId ?? null;
    sourceArea = 'case';
  } else if (sourceUid === 'partnerMR:self' || sourceUid === 'partnerMR:opp') {
    // M3 PA batch (rules/18): PA 常駐 MR sentinel
    owner = sourceUid === 'partnerMR:self' ? 'self' : 'opp';
    cardId = stateAfterSrc.players[owner].partnerAreaMR?.cardId ?? null;
    sourceArea = 'partner-area';
  } else if (['self', 'opp'].some((p) => {
    const mr = stateAfterSrc.players[p as Player].partnerAreaMR;
    if (mr?.uid !== sourceUid) return false;
    owner = p as Player;
    cardId = mr.cardId;
    sourceArea = 'partner-area';
    return true;
  })) {
    // Physical PA-MR UID resolved above.
  } else if (sourceUid.startsWith('hand:')) {
    // hand sentinel `hand:${player}:${cardId}` (B06103, W6 step11)
    const [, hp, ...rest] = sourceUid.split(':');
    if (hp === 'self' || hp === 'opp') {
      owner = hp;
      const token = rest.join(':');
      cardId = /^\d+$/.test(token) ? stateAfterSrc.players[hp].hand[Number(token)] ?? null : token || null;
      sourceArea = 'hand';
    }
  } else if (/^(evidence|file):(self|opp):(\d+)$/.test(sourceUid)) {
    const [, rawArea, playerText, indexText] = /^(evidence|file):(self|opp):(\d+)$/.exec(sourceUid)!;
    const player = playerText as Player;
    const index = Number(indexText);
    if (rawArea === 'evidence') {
      const entry = stateAfterSrc.players[player].evidence[index];
      if (entry?.faceUp) {
        owner = player;
        cardId = entry.cardId;
        sourceArea = 'evidence';
      }
    } else {
      const entry = stateAfterSrc.players[player].file[index];
      if (entry?.type === 'card-back' && entry.faceUp === true) {
        owner = player;
        cardId = entry.cardId;
        sourceArea = 'file';
      }
    }
  } else {
    for (const p of ['self', 'opp'] as const) {
      const c = stateAfterSrc.players[p].scene.find((x) => x.uid === sourceUid);
      if (c) {
        cardId = c.cardId;
        owner = p;
        break;
      }
    }
  }
  const chosenOccurrence = cardId ? flow.findDeclaredAbilityOccurrence(
    stateAfterSrc,
    sourceUid,
    cardId,
    sourceArea,
    chosenAbilId,
    chosenSourceRef,
  ) : undefined;
  const chosenAbil = chosenOccurrence?.ability;
  const cost = chosenAbil?.cost;
  // mega-wave W5 (r37): {dyn} n コスト (B04088 removeDeckTop $self.oppSceneCount*2) を実数表示。
  // evalDyn の oppSceneCount は ctx.source.player のみ参照 (uid 不要な dyn でも source 完備で渡す)。
  const costText = cost
    ? costToText(cost, {
        state: stateAfterSrc,
        ctx: {
          source: {
            player: owner ?? 'self',
            uid: sourceUid,
            cardId: cardId ?? undefined,
            area: sourceArea,
            ...chosenSourceRef,
          },
          bindings: {},
        },
      })
    : '無し';
  let costParams: AbilityCostParams | undefined;

  // Round 2: sourceUid → 名前解決。declaredAbility は scene キャラ/事件の宣言能力。
  const sourceName = uidToDisplayName(stateAfterSrc, sourceUid);
  // 2026-05-30 user_request: ability id ("a2") ではなく能力の説明文言を表示する。
  const abilityText = chosenAbil?.description ?? `能力 (${chosenAbilId})`;
  const accepted = await useConfirmation().ask({
    kind: 'standard',
    title: '宣言能力',
    body: `${sourceName} の宣言能力を発動します。\n${abilityText}\nコスト: ${costText}`,
    okLabel: '発動',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };
  if (!owner || !cardId) return { ok: false, reason: 'not-allowed' };

  // A replacement pays the entire declared cost.  When the ordinary cost is
  // also payable, it is a genuine player choice rather than an AI fallback.
  // Choose it before collecting any ordinary-cost parameters.
  let useAlternativeCost = false;
  if (cost && owner === 'self' && cardId) {
    const altState = useGameStateStore.getState().gameState;
    if (altState === null) return { ok: false, reason: 'no-state' };
    const altCtx = makeAbilityCtx({
      player: owner,
      uid: sourceUid,
      cardId,
      abilityId: chosenAbilId,
      area: sourceArea,
      ...chosenSourceRef,
    });
    const providers = alternativeCostProviders(altState, altCtx, chosenAbil!);
    const normalPayable = engine.cost.canPay(altState, cost, altCtx);
    if (providers.length > 0) {
      const alternatives = providers.map((uid, index) => ({
        index: normalPayable ? index + 1 : index,
        uid,
        // Public board position disambiguates same-name providers without
        // exposing hidden information or raw UID values.
        label: `${uidToDisplayName(altState, uid)}（現場${altState.players[owner ?? 'self'].scene.findIndex((char) => char.uid === uid) + 1}）をリムーブ`,
      }));
      const choice = await useChoicePicker().ask({
        sourceName,
        options: [
          ...(normalPayable ? [{ index: 0, label: `通常のコスト (${costText})` }] : []),
          ...alternatives.map(({ index, label }) => ({ index, label })),
        ],
      });
      if (choice.kind === 'cancel') return { ok: false, reason: 'cancelled' };
      const selectedAlternative = alternatives.find((alternative) => alternative.index === choice.index);
      if (selectedAlternative) {
        const providerUid = selectedAlternative.uid;
        if (!providerUid) return { ok: false, reason: 'not-allowed' };
        costParams = { paymentMode: 'alternative', alternativeCostProviderUid: providerUid };
        useAlternativeCost = true;
      } else if (normalPayable && choice.index === 0) {
        costParams = { paymentMode: 'printed' };
      } else {
        return { ok: false, reason: 'not-allowed' };
      }
    }
  }

  const removeStackedCost = findRemoveStackedCardsCost(cost);
  if (!useAlternativeCost && removeStackedCost && owner === 'self' && sourceArea === 'scene') {
    const stackedState = useGameStateStore.getState().gameState;
    if (stackedState === null) return { ok: false, reason: 'no-state' };
    const source = stackedState.players[owner].scene.find((char) => char.uid === sourceUid);
    const entries = source?.stackedCards;
    const stackedCount = Array.isArray(entries) ? entries.length : (typeof entries === 'number' ? entries : 0);
    if (stackedCount < removeStackedCost.n) {
      return { ok: false, reason: 'not-allowed' };
    }
    // With exactly n entries no choice exists; omit params so human and AI use
    // the same deterministic engine fallback. Otherwise retain exact identities.
    if (Array.isArray(entries) && entries.length > removeStackedCost.n) {
      const choice = await useStackedCardCostPicker().ask({
        sourceName,
        candidates: entries.map(({ instanceId, cardId }, index) => ({
          instanceId,
          cardId,
          ordinal: index + 1,
          hidden: cardId === FILE_CARD_BACK_PLACEHOLDER || cardId === 'back-card',
        })),
        nMin: removeStackedCost.n,
        nMax: removeStackedCost.n,
      });
      if (choice.kind === 'cancel') return { ok: false, reason: 'cancelled' };
      const unique = new Set(choice.instanceIds);
      const candidateIds = new Set(entries.map((entry) => entry.instanceId));
      if (choice.instanceIds.length !== removeStackedCost.n
        || unique.size !== choice.instanceIds.length
        || choice.instanceIds.some((id) => !candidateIds.has(id))) {
        return { ok: false, reason: 'not-allowed' };
      }
      costParams = { ...(costParams ?? {}), removeStackedCards: { instanceIds: choice.instanceIds } };
    }
  }

  // 3.5) BUG-085: 〚裏向きの証拠を1つ以上表向きにする〛コスト (caseDeclaredEvidenceFlip /
  //   D08005 等) は、どの裏向き証拠を表向きにするかを user に選ばせる必要がある。
  //   engine.cost.pay は ctx.dyn.costParams.flipFaceUpEvidence.indices を要求し、
  //   未供給だと "picks 0 out of [min,max]" で throw → dispatch 全体が rollback して
  //   「OK 押下後に何も起きない」症状になっていた (本バグの直接原因)。
  //   確認モーダル accept 後に証拠エリア拡大表示 (CardListModal) を流用した picker を出す。
  const flipCost = findFlipFaceUpCost(cost);
  if (!useAlternativeCost && flipCost && owner === 'self' && cardId) {
    const flipState = useGameStateStore.getState().gameState;
    if (flipState === null) return { ok: false, reason: 'no-state' };
    const evidence = flipState.players[owner].evidence;
    const candidates = evidence
      .map((e, index) => (!e.faceUp ? { index, cardId: e.cardId } : null))
      .filter((c): c is { index: number; cardId: string } => c !== null);
    // canPay は列挙時に facedown >= n.min を確認済だが、source/ability 選択中に状態が
    // 変わる可能性に備えて防御 (足りなければ使用不可)。
    if (candidates.length < flipCost.n.min) {
      return { ok: false, reason: 'not-allowed' };
    }
    const choice = await useEvidenceFlipPicker().ask({
      side: owner,
      sourceName,
      candidates,
      nMin: flipCost.n.min,
      nMax: flipCost.n.max,
    });
    if (choice.kind === 'cancel') return { ok: false, reason: 'cancelled' };
    // 選択 index を costParams に積む。dispatcher (activateDeclaredAbility) が
    // ctx.dyn.costParams.flipFaceUpEvidence.indices へ詰め替え (cost.pay が読む)、
    // costPaid.count → effect の $cost dyn にも繋がる (BUG-085 伝播)。
    costParams = { ...(costParams ?? {}), flipFaceUpEvidence: { indices: choice.indices } };
  }

  // The hand is an occurrence list: duplicate printed cards must remain
  // separately selectable. Collect exact indices before dispatch so engine
  // preflight and payment consume the same witness.
  const removeHandCost = findRemoveFromHandCost(cost, costParams?.costChoicePath ?? costParams?.costChoice);
  if (!useAlternativeCost && removeHandCost && owner === 'self' && cardId) {
    const handState = useGameStateStore.getState().gameState;
    if (handState === null) return { ok: false, reason: 'no-state' };
    const allowed = engine.target.candidates(handState, removeHandCost.target, makeAbilityCtx({ player: owner, uid: sourceUid, cardId, abilityId: chosenAbilId, area: sourceArea, ...chosenSourceRef }))
      .filter((candidate): candidate is Candidate & { kind: 'card'; index: number } => candidate.kind === 'card' && typeof candidate.index === 'number');
    if (allowed.length < removeHandCost.n) return { ok: false, reason: 'not-allowed' };
    const choice = await useHandCostPicker().ask({
      side: owner,
      sourceName,
      candidates: allowed.map(candidate => ({ index: candidate.index, cardId: candidate.cardId })),
      n: removeHandCost.n,
    });
    if (choice.kind === 'cancel') return { ok: false, reason: 'cancelled' };
    const allowedIndices = new Set(allowed.map(candidate => candidate.index));
    if (choice.indices.length !== removeHandCost.n
      || new Set(choice.indices).size !== choice.indices.length
      || choice.indices.some(index => !allowedIndices.has(index))) return { ok: false, reason: 'not-allowed' };
    costParams = { ...(costParams ?? {}), removeFromHand: { indices: choice.indices } };
  }

  // 3.6) 夜間 W0 (2026-07-11, B09027): cost kind:'choice' (「AかBを1枚リムーブする」択一コスト) の
  //   human branch 選択。engine cost.pay は ctx.dyn.costChoice 未供給時 first-payable auto-select
  //   に落ち、human は 2 番目の branch を選べない (readChosenIndex, pay.ts)。payable branch を
  //   canPay で絞り、2 択以上のときのみ ChoicePicker を出す (1 択は auto、0 択は防御 return —
  //   can-check 列挙済のため通常到達しない)。選択 index → costParams.costChoice →
  //   dispatcher (ability-activate.ts costParamsToDyn) が ctx.dyn.costChoice へ詰め替え。
  if (!useAlternativeCost && cost && findChoiceCostAtPath(cost, []) && owner === 'self' && cardId) {
    const ccState = useGameStateStore.getState().gameState;
    if (ccState === null) return { ok: false, reason: 'no-state' };
    const ccCtx = makeAbilityCtx({
      player: owner,
      uid: sourceUid,
      cardId,
      abilityId: chosenAbilId,
      area: sourceArea,
      ...chosenSourceRef,
    });
    const path: number[] = [];
    for (;;) {
      const choiceCost = findChoiceCostAtPath(cost, path);
      if (!choiceCost) break;
      const payable = choiceCost.items
        .map((item, index) => {
          const candidatePath = [...path, index];
          return {
            index,
            label: costToText(item, { state: ccState, ctx: ccCtx }),
            // A partial nested path is not a payment witness. Test every complete
            // continuation, otherwise an inner default branch can hide a payable one.
            ok: completeCostChoicePaths(cost, candidatePath).some((fullPath) =>
              engine.cost.canPay(ccState, cost, { ...ccCtx, dyn: { costChoicePath: fullPath } })),
          };
        })
        .filter((o) => o.ok);
      if (payable.length === 0) return { ok: false, reason: 'not-allowed' };
      const index = payable.length === 1
        ? payable[0]!.index
        : await (async () => {
          const choice = await useChoicePicker().ask({
            sourceName,
            options: payable.map(({ index: optionIndex, label }) => ({ index: optionIndex, label })),
          });
          return choice.kind === 'cancel' ? null : choice.index;
        })();
      if (index === null) return { ok: false, reason: 'cancelled' };
      path.push(index);
    }
    costParams = {
      ...(costParams ?? {}),
      ...(path.length === 1 ? { costChoice: path[0] } : {}),
      ...(path.length > 1 ? { costChoicePath: path } : {}),
    };
  }

  // Exact active-character cost selection. Keep this after cost-choice
  // resolution so only the selected payment branch can open a picker.
  const characterStateCost = findCharacterStateCost(
    cost,
    costParams?.costChoicePath ?? costParams?.costChoice,
  );
  if (!useAlternativeCost && characterStateCost && owner === 'self' && cardId) {
    const characterState = useGameStateStore.getState().gameState;
    if (characterState === null) return { ok: false, reason: 'no-state' };
    const min = characterStateCost.target.kind === 'pick' ? characterStateCost.target.n.min : 1;
    const max = characterStateCost.target.kind === 'pick' ? characterStateCost.target.n.max : 1;
    // Every shipped sleepChar/stunChar declaration currently pays exactly one.
    // Preserve legacy engine fallback for other cardinalities until they gain a
    // dedicated multi-select interaction.
    if (min === 1 && max === 1) {
      const characterCtx = makeAbilityCtx({
        player: owner,
        uid: sourceUid,
      cardId,
      abilityId: chosenAbilId,
      area: sourceArea,
      ...chosenSourceRef,
      });
      const active = engine.target.candidates(characterState, characterStateCost.target, characterCtx)
        .filter((candidate): candidate is Candidate & { kind: 'char' } => {
          if (candidate.kind !== 'char') return false;
          return characterState.players[candidate.player].scene
            .some(char => char.uid === candidate.uid && char.state === 'active');
        });
      if (active.length === 0) return { ok: false, reason: 'not-allowed' };
      const chosen = active.length === 1
        ? active[0]!
        : await (async () => {
          const choice = await useChoicePicker().ask({
            sourceName,
            options: active.map((candidate, index) => {
              const sceneIndex = characterState.players[candidate.player].scene
                .findIndex(char => char.uid === candidate.uid);
              const sideLabel = candidate.player === owner
                ? ''
                : candidate.player === 'self' ? '自分の' : '相手の';
              return {
                index,
                label: `${uidToDisplayName(characterState, candidate.uid)}（${sideLabel}現場${sceneIndex + 1}）`,
              };
            }),
          });
          return choice.kind === 'cancel' ? null : active[choice.index];
        })();
      if (chosen === null) return { ok: false, reason: 'cancelled' };
      if (chosen === undefined) return { ok: false, reason: 'not-allowed' };
      costParams = {
        ...(costParams ?? {}),
        [characterStateCost.kind]: { uids: [chosen.uid] },
      };
    }
  }

  // 3.6b) BUG-248: removeSetCard コストは、host だけでなく物理 set-card occurrence を
  // 人間に明示選択させる。裏向き entry の cardId は request/store/UI に渡さない。
  // choice cost は 3.6 で branch 確定後なので、選んだ branch だけを対象にする。
  const removeSetCost = findRemoveSetCardCost(cost, costParams?.costChoicePath ?? costParams?.costChoice);
  if (!useAlternativeCost && removeSetCost && owner === 'self' && cardId) {
    const setState = useGameStateStore.getState().gameState;
    if (setState === null) return { ok: false, reason: 'no-state' };
    const setCtx = makeAbilityCtx({ player: owner, uid: sourceUid, cardId, abilityId: chosenAbilId, area: sourceArea, ...chosenSourceRef });
    const candidates = eligibleRemoveSetCards(setState, removeSetCost, setCtx)
      .filter(({ entry }) => typeof entry.instanceId === 'string')
      .map(({ host, entry }, ordinal) => {
        const sceneIndex = setState.players[owner ?? 'self'].scene.findIndex(candidate => candidate.uid === host.uid);
        const hidden = !entry.faceUp;
        return {
          hostUid: host.uid,
          hostLabel: `${uidToDisplayName(setState, host.uid)}（現場${sceneIndex + 1}）`,
          instanceId: entry.instanceId!, ordinal: ordinal + 1, hidden,
          ...(hidden ? {} : { cardId: entry.cardId }),
        };
      });
    if (candidates.length < removeSetCost.n) return { ok: false, reason: 'not-allowed' };
    const choice = await useSetCardCostPicker().ask({
      player: owner,
      source: { uid: sourceUid, cardId, abilityId: chosenAbilId },
      candidates,
      n: removeSetCost.n,
    });
    if (choice.kind === 'cancel') return { ok: false, reason: 'cancelled' };
    if (choice.picks.length !== removeSetCost.n || new Set(choice.picks.map((pick) => pick.instanceId)).size !== choice.picks.length) {
      return { ok: false, reason: 'not-allowed' };
    }
    costParams = {
      ...(costParams ?? {}),
      removeSetCard: {
        hostUids: choice.picks.map((pick) => pick.hostUid),
        instanceIds: choice.picks.map((pick) => pick.instanceId),
      },
    };
  }

  // 3.7) BUG-108: 複数 option を持つ top-level choice effect (D11012 a1「LP＋1するか / AP＋2000する」)
  //   は user に択一させ、選択 index を ctx.dyn.choiceIndex に積む。useDeclaredAbility →
  //   resolveEffectPicks の choice unwrap が「選択 option のみ」を解決する。
  //   単一 option の choice (D11014 a2 step2 等) は modal を出さない (choiceIndex 既定 0)。
  //   AI 経路の択一は BUG-109 (PA 短縮形 AI no-op) と併せて別途対応 (現状 default 0)。
  const effect = chosenAbil?.effect as Effect | undefined;
  if (effect && effect.kind === 'choice' && effect.options.length > 1 && owner === 'self' && cardId) {
    const options = effect.options.map((o, index) => ({
      index,
      label: effect.labels?.[index] ?? choiceOptionLabel(o),
    }));
    const choice = await useChoicePicker().ask({ sourceName, options });
    if (choice.kind === 'cancel') return { ok: false, reason: 'cancelled' };
    costParams = { ...(costParams ?? {}), choiceIndex: choice.index };
  }

  // 3.8) CARD PHASE step12 batch2 (2026-07-04): declareName atom (「カード名を1つ指定し」
  //   B09108/B09003/PR105)。atom は効果解決中に ctx.dyn.declaredName を読むのみで pause しない
  //   (engine W6 step1 設計) → dispatch **前** に DeclareCardNameModal で宣言名を集め
  //   costParams.declaredName に積む (dispatcher が ctx.dyn へ詰め替え)。
  //   - 「〜する」句 (optional=false): 確定のみ。× / 背景 = 能力使用全体の取り消し。
  //   - 「してもよい」句 (optional=true): skip = declaredName 未供給 → atom 空文字 fallback →
  //     消費側 (nameOverride / boundNameMatchesDeclared) が no-op/false に落ちる decline 経路。
  const declareSpec = findDeclareNameAtom(effect);
  if (declareSpec && owner === 'self' && cardId) {
    const candidateNames = declaredNameCandidates(declareSpec.domain);
    const declared = await useDeclareNamePicker().ask({
      sourceName,
      prompt: abilityText,
      candidateNames,
      optional: declareSpec.optional,
      domain: declareSpec.domain,
    });
    if (declared.kind === 'cancel') return { ok: false, reason: 'cancelled' };
    if (declared.kind === 'declare') {
      costParams = { ...(costParams ?? {}), declaredName: declared.name };
    }
    // skip → declaredName 未供給のまま dispatch (decline)
  }

  // 4) dispatch — Phase 2c: cost+ctx 構築 + pay (atomic) は dispatcher 内の
  //   engine.flow.activateDeclaredAbility が行う。本フローは picker 選択値のみ渡す。
  return dispatchEngineAction({
    type: 'declaredAbility',
    uid: sourceUid,
    abilId: chosenAbilId,
    ...chosenSourceRef,
    ...(costParams ? { costParams } : {}),
  });
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

  // An unresolved source picker locks the action panel.  Only offer sources
  // that already have a legal public target; otherwise selecting one leaves
  // the target picker empty and the player cannot continue (BUG-273).
  const sources = enumActionSourceCandidates(state, opts.player)
    .filter((source) => enumActionTargetCandidates(state, source).length > 0);
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

  // 4. 確認 — Round 2: source/target uid を名前解決して人間可読化。
  // 名前解決は stateAfterSrc (target 列挙時の最新 state) を使用。
  const isCase = target === ACTION_CASE_TARGET_OPP;
  const sourceName = uidToDisplayName(stateAfterSrc, source);
  const targetLabel = isCase ? '相手の事件' : uidToDisplayName(stateAfterSrc, target);
  const accepted = await useConfirmation().ask({
    kind: 'standard',
    title: 'アクション',
    body: `${sourceName} で ${targetLabel} にアクションします。`,
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
  const initialStore = useGameStateStore.getState();
  const state = initialStore.gameState;
  if (state === null) return { ok: false, reason: 'no-state' };
  if (selectInteractionLocked(initialStore)) return { ok: false, reason: 'not-allowed' };

  // rules/20 §スイッチ: scene=5 でキャラ使用したい場合は switch 経路。
  const canNormal = flow.canHandUseCard(state, opts.player, opts.cardId);
  const canSwitch = !canNormal && flow.canHandUseCardSwitch(state, opts.player, opts.cardId);
  if (!canNormal && !canSwitch) {
    return { ok: false, reason: 'not-allowed' };
  }

  // Round 2: cardId → 名前解決 ("D08023" → "毛利蘭")。
  const cardName = cardIdToDisplayName(opts.cardId);
  const accepted = await useConfirmation().ask({
    kind: 'standard',
    title: '手札の使用',
    body: `${cardName} を使用します。`,
    okLabel: '使用',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };
  if (selectInteractionLocked(useGameStateStore.getState())) {
    return { ok: false, reason: 'not-allowed' };
  }

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
  const interactionEpoch = currentInteractionEpoch();
  const removeUid = await new Promise<string | null>((resolve) => {
    useSceneSwitchPickerStore.getState()._open({
      player: opts.player,
      cardId: opts.cardId,
      newCardName,
      candidates: sceneChars,
      resolve,
    });
  });
  if (!isCurrentLiveInteraction(interactionEpoch)) return { ok: false, reason: 'not-allowed' };
  if (removeUid === null) return { ok: false, reason: 'cancelled' };
  if (selectInteractionLocked(useGameStateStore.getState())) {
    return { ok: false, reason: 'not-allowed' };
  }
  return dispatchEngineAction({
    type: 'handUseCardSwitch',
    player: opts.player,
    cardId: opts.cardId,
    removeUid,
  });
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
 * 注: assist 後の printed FILE threshold 到達 → 解決編 自動移行は engine 側 (mutate.partner.assist →
 * mutate.file.insertAssistedPartner) で処理されるため UI は気にしない。
 */
export async function runAssistFlow(opts: { player: Player }): Promise<FlowResult> {
  const state = useGameStateStore.getState().gameState;
  if (state === null) return { ok: false, reason: 'no-state' };
  if (!canAssistForUi(state, opts.player)) {
    return { ok: false, reason: 'not-allowed' };
  }
  // Round 2: spec ui-action-flows.md §③アシスト に従い、printed FILE threshold で解決編移行する
  // ことも明示。旧実装は移行情報を欠落していたため、初心者に手順が伝わりにくかった。
  const fileCount = state.players[opts.player].file.length;
  const nextFileCount = fileCount + 1;
  const threshold = engine.read.game.partnerAssistFileThreshold(state, opts.player);
  const willTransition = nextFileCount >= threshold;
  const accepted = await useConfirmation().ask({
    kind: 'warning',
    title: 'アシスト',
    body:
      `パートナーをスリープしてFILEへ移動します (現在 FILE ${fileCount} 枚 → ${nextFileCount} 枚)。` +
      'このターン中は事件解決できなくなります。' +
      (willTransition
        ? `\n※ FILE ${threshold} 枚以上になるため、事件カードは「解決編」に移行します。`
        : ''),
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
