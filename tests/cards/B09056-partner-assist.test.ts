// B09056/P: 【パートナー赤】はパートナーがFILEにアシスト中でも色を参照する。
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09056P } from '@/cards/ct-p09/B09056P';
import { event } from '@/engine/event';
import {
  _clearPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
  _drainPendingEffectOptionalSide,
  _drainPendingEffectPickSide,
} from '@/engine/effect/pending-state';
import { applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';

const FILE_BACK = { type: 'card-back' as const, cardId: 'D04014' };

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  registerAll();
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('B09056P 赤井秀一 — パートナーアシスト中の登場時効果', () => {
  it('赤partnerがFILEアシスト中でも通常登場がoptional決定とLv8以下選択をsurfaceする', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partner.cardId = 'D04001'; // 赤パートナー
    state.players.self.case.cardId = 'B09113P';
    state.players.self.case.colors = ['赤', '黒'];
    state.players.self.file = Array.from({ length: 7 }, () => ({ ...FILE_BACK }));
    state.players.self.hand = [B09056P.id];

    mutate.partner.assist(state, 'self');
    expect(state.players.self.partner.location).toBe('file-area');

    handUseCard(state, 'self', B09056P.id);
    runAllUntilEmpty(state);
    const group = pendingOwnerOrderGroup(state, 'self');
    expect(group, 'same-timing effects pause before the optional prompt').toHaveLength(2);
    group.forEach((entry, order) => {
      entry.ownerChosenOrder = order;
      entry.ownerOrderConfirmed = true;
    });
    runAllUntilEmpty(state);

    const optional = _drainPendingEffectOptionalSide();
    expect(optional).toMatchObject({
      player: 'self',
      source: { cardId: B09056P.id, abilityId: 'a1' },
    });

    applyOptionalAndContinuation(state, optional!, true);
    const removePick = _drainPendingEffectPickSide();
    expect(removePick).toMatchObject({
      player: 'self',
      atomVerb: 'sceneRemove',
      nMin: 0,
      nMax: 1,
      source: { cardId: B09056P.id },
    });
    expect(removePick?.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ cardId: B09056P.id, player: 'self' }),
    ]));
    expect(state.players.self.scene.find(card => card.cardId === B09056P.id)?.state).toBe('sleep');
  });
});
