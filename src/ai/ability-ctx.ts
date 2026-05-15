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
 */
export function makeDeclaredAbilCtx(
  state: GameState,
  uid: string,
  abilityId: string,
): EffectCtx | null {
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
