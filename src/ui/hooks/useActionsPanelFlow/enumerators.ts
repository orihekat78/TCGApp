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
  // 1. scene chars (W6 step11 row999 item4: faceUp set-card rider の on-set-host declared も列挙 —
  //    B07014「セットされているキャラは『【宣言】〜』を持つ」)
  for (const c of state.players[player].scene) {
    const def = engine.cards.get(c.cardId);
    if (!def) continue;
    // gap② (2026-07-11, B06042): charGrantAbility 付与の declared も列挙 (findDeclaredAbility と対称)。
    const abilities = [...def.abilities, ...riderDeclaredAbilities(state, c), ...flow.grantedDeclaredAbilitiesOf(c)];
    const hasUsable = abilities.some((a) => {
      if (a.type !== 'declared') return false;
      if (!flow.canActivateDeclaredAbility(state, c.uid, a.id, undefined, { allowImplicitRemoveSetCard: true })) return false;
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
        if (!flow.canActivateDeclaredAbility(state, caseUid, a.id, undefined, { allowImplicitRemoveSetCard: true })) return false;
        return true;
      });
      if (hasUsable) sources.push(caseUid);
    }
  }
  // 3. hand cards (W6 step11 row999 item3: scope:'on-hand' declared — B06103「この能力はこのカードが
  //    手札にある場合に宣言できる」)。同 cardId 複数コピーは Set で 1 uid に重複排除。
  for (const [index, cardId] of state.players[player].hand.entries()) {
    const def = engine.cards.get(cardId);
    if (!def) continue;
    const uid = `hand:${player}:${index}`;
    const hasUsable = def.abilities.some((a) => {
      if (a.type !== 'declared') return false;
      return flow.canActivateDeclaredAbility(state, uid, a.id, undefined, { allowImplicitRemoveSetCard: true });
    });
    if (hasUsable) sources.push(uid);
  }
  for (const [index, entry] of state.players[player].evidence.entries()) {
    if (!entry.faceUp) continue;
    const def = engine.cards.get(entry.cardId);
    const uid = `evidence:${player}:${index}`;
    if (def?.abilities.some(a => a.type === 'declared'
      && flow.canActivateDeclaredAbility(state, uid, a.id, undefined, { allowImplicitRemoveSetCard: true }))) sources.push(uid);
  }
  for (const [index, entry] of state.players[player].file.entries()) {
    if (entry.type !== 'card-back' || entry.faceUp !== true) continue;
    const def = engine.cards.get(entry.cardId);
    const uid = `file:${player}:${index}`;
    if (def?.abilities.some(a => a.type === 'declared'
      && flow.canActivateDeclaredAbility(state, uid, a.id, undefined, { allowImplicitRemoveSetCard: true }))) sources.push(uid);
  }
  // 4. partnerAreaMR (M3 PA batch, rules/18 §パートナーエリアにいるMRキャラ):
  //    scope on-partner-area / always の宣言能力のみ engine gate (declared-ability.ts:147) を通る。
  //    uid は slot に保持された実 uid。
  {
    const mr = state.players[player].partnerAreaMR;
    if (mr) {
      const def = engine.cards.get(mr.cardId);
      if (def) {
        const uid = mr.uid;
        const hasUsable = def.abilities.some((a) => {
          if (a.type !== 'declared') return false;
          return flow.canActivateDeclaredAbility(state, uid, a.id, undefined, { allowImplicitRemoveSetCard: true });
        });
        if (hasUsable) sources.push(uid);
      }
    }
  }
  return sources;
}

/**
 * W6 step11 (row999 item4): host キャラの faceUp setCards から type:'declared' + scope:'on-set-host'
 * の rider abilities を列挙 (engine 側 findDeclaredAbility と同じ walk の enumerator 版)。
 */
function riderDeclaredAbilities(
  state: import('@/engine/types/game-state.js').GameState,
  c: { setCards: { cardId: string; faceUp: boolean }[] },
): import('@/engine/types/card-def.js').AbilityDef[] {
  void state;
  const out: import('@/engine/types/card-def.js').AbilityDef[] = [];
  for (const entry of c.setCards) {
    if (!entry.faceUp) continue;
    const rdef = engine.cards.get(entry.cardId);
    if (!rdef) continue;
    for (const a of rdef.abilities) {
      if (a.type === 'declared' && a.scope === 'on-set-host') out.push(a);
    }
  }
  return out;
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
  let area: 'scene' | 'case' | 'hand' | 'partner-area' | 'evidence' | 'file' = 'scene';
  let riderAbilities: import('@/engine/types/card-def.js').AbilityDef[] = [];
  if (uid === 'case:self' || uid === 'case:opp') {
    owner = uid === 'case:self' ? 'self' : 'opp';
    cardId = state.players[owner].case.cardId ?? null;
    area = 'case';
  } else if (['self', 'opp'].some((p) => {
    const mr = state.players[p as Player].partnerAreaMR;
    if (!mr || (mr.uid !== uid && uid !== `partnerMR:${p}`)) return false;
    owner = p as Player;
    cardId = mr.cardId;
    area = 'partner-area';
    return true;
  })) {
    // PA source resolved above.
  } else if (uid.startsWith('hand:')) {
    // W6 step11 (row999 item3): hand sentinel uid — findCardOnBoard と同じ split 規約
    const [, hp, ...rest] = uid.split(':');
    const token = rest.join(':');
    const hCardId = (hp === 'self' || hp === 'opp') && /^\d+$/.test(token)
      ? state.players[hp].hand[Number(token)]
      : token;
    if ((hp === 'self' || hp === 'opp') && hCardId && state.players[hp].hand.includes(hCardId)) {
      owner = hp;
      cardId = hCardId;
      area = 'hand';
    }
  } else if (/^(evidence|file):(self|opp):(\d+)$/.test(uid)) {
    const [, rawArea, rawPlayer, rawIndex] = /^(evidence|file):(self|opp):(\d+)$/.exec(uid)!;
    const p = rawPlayer as Player;
    const index = Number(rawIndex);
    if (rawArea === 'evidence') {
      const entry = state.players[p].evidence[index];
      if (entry?.faceUp) { owner = p; cardId = entry.cardId; area = 'evidence'; }
    } else {
      const entry = state.players[p].file[index];
      if (entry?.type === 'card-back' && entry.faceUp === true) { owner = p; cardId = entry.cardId; area = 'file'; }
    }
  } else {
    for (const p of ['self', 'opp'] as const) {
      const c = state.players[p].scene.find((x) => x.uid === uid);
      if (c) {
        cardId = c.cardId;
        owner = p;
        // W6 step11 item4: on-set-host rider 込み + gap② (2026-07-11, B06042): charGrantAbility 付与 declared 込み。
        riderAbilities = [...riderDeclaredAbilities(state, c), ...flow.grantedDeclaredAbilitiesOf(c)];
        break;
      }
    }
  }
  if (!cardId || !owner) return [];
  void area;
  const def = engine.cards.get(cardId);
  if (!def) return [];
  return [...def.abilities, ...riderAbilities]
    .filter((a) => a.type === 'declared')
    .filter((a) => flow.canActivateDeclaredAbility(state, uid, a.id, undefined, { allowImplicitRemoveSetCard: true }))
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
  return engine.read.game.canPartnerAssist(state, player);
}

/**
 * UI 側 can-check: src/ai/move-enumerator.ts canSolveCase と同条件。
 */
export function canSolveCaseForUi(
  state: import('@/engine/types/game-state.js').GameState,
  player: Player,
): boolean {
  return engine.read.game.canPartnerSolveCase(state, player);
}

