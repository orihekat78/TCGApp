// ai.ability-ctx — Phase 8.8d: EffectCtx 構築ヘルパ
//
// rules: 21-declared-ability-cost.md (cost の責務)
//
// パートナー能力 / 宣言能力の cost.canPay / cost.pay 呼出に必要な EffectCtx を構築する。
// UI 側 (useActionsPanelFlow) と AI 側 (policy.applyMove + move-enumerator) で共通利用。

import type { EffectCtx, GameState } from '@/engine/types';

type Player = 'self' | 'opp';

/**
 * パートナー能力の EffectCtx を構築。
 * - source.uid = 'partner:self' / 'partner:opp' (固定命名)
 * - source.area = 'partner-area'
 */
export function makePartnerAbilCtx(
  player: Player,
  cardId: string,
  abilityId: string,
): EffectCtx {
  return {
    source: {
      cardId,
      uid: `partner:${player}`,
      abilityId,
      player,
      area: 'partner-area',
    },
    bindings: {},
  };
}

/**
 * 宣言能力 (scene キャラ) の EffectCtx を構築。
 * uid から所有プレイヤー + cardId を逆引きする。見つからなければ null。
 *
 * 2026-05-30 BUG-084: 事件カードの宣言能力 (uid 'case:self'/'case:opp') に対応。
 * UI 側 (useActionsPanelFlow.makeAbilityCtx, area:'case') と挙動を揃える。
 */
export function makeDeclaredAbilCtx(
  state: GameState,
  uid: string,
  abilityId: string,
): EffectCtx | null {
  // On-hand declared abilities use the same canonical sentinel as the
  // enumerator and flow boundary: `hand:<owner>:<cardId>`.
  if (uid.startsWith('hand:')) {
    const [, rawPlayer, ...parts] = uid.split(':');
    const token = parts.join(':');
    if (rawPlayer !== 'self' && rawPlayer !== 'opp') return null;
    const cardId = /^\d+$/.test(token) ? state.players[rawPlayer].hand[Number(token)] : token;
    if (!cardId || !state.players[rawPlayer].hand.includes(cardId)) return null;
    return {
      source: { cardId, uid, abilityId, player: rawPlayer, area: 'hand' },
      bindings: {},
    };
  }
  // 事件カード (rules/21: 自分の事件の宣言能力)
  if (uid === 'case:self' || uid === 'case:opp') {
    const p: Player = uid === 'case:self' ? 'self' : 'opp';
    const cardId = state.players[p].case.cardId;
    if (!cardId) return null;
    return {
      source: { cardId, uid, abilityId, player: p, area: 'case' },
      bindings: {},
    };
  }
  for (const p of ['self', 'opp'] as const) {
    const mr = state.players[p].partnerAreaMR;
    if (mr && (mr.uid === uid || uid === `partnerMR:${p}`)) {
      return { source: { cardId: mr.cardId, uid, abilityId, player: p, area: 'partner-area' }, bindings: {} };
    }
  }
  // scene キャラ
  for (const p of ['self', 'opp'] as const) {
    const c = state.players[p].scene.find((x) => x.uid === uid);
    if (c) {
      return {
        source: {
          cardId: c.cardId,
          uid,
          abilityId,
          player: p,
          area: 'scene',
        },
        bindings: {},
      };
    }
  }
  return null;
}
