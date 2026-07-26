import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { B09033 } from '@/cards/ct-p09/B09033';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event';
import { register, _resetRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue, _clearPendingEffectRepeatOptionalSide, _drainPendingEffectRepeatOptionalSide, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { applyRepeatOptionalAndContinuation, applyPickAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve';
import type { CardDef } from '@/engine/types';

const highSchooler = (id: string): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['緑'], level: 6, ap: 3000, lp: 1,
  traits: ['高校生'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
});

const H1 = highSchooler('B09033_H1');
const H2 = highSchooler('B09033_H2');
const H3 = highSchooler('B09033_H3');
const H4 = highSchooler('B09033_H4');
const DUP = highSchooler('B09033_DUP');

beforeEach(() => {
  (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
  (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
});

function resetB09033(...defs: CardDef[]): void {
  event._resetRegistry(); _resetRegistry(); _resetTriggeredRegistered(); _clearPendingEffectPickQueue(); _clearPendingEffectOptionalSide(); _clearPendingEffectRepeatOptionalSide();
  (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
  (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
  [B09033, ...defs].forEach(register);
  registerTriggeredListener();
}

function b09033Context(player: 'self' | 'opp' = 'self') {
  return { source: { player, cardId: B09033.id, abilityId: 'a1', area: 'hand' }, bindings: {} };
}

describe('B09033 「ひょっとしたら…」', () => {
  it('4枚公開windowから最初と3回の任意反復で各1枚ずつ登場させる', () => {
    _resetRegistry(); _resetTriggeredRegistered(); _clearPendingEffectPickQueue(); _clearPendingEffectOptionalSide(); _clearPendingEffectRepeatOptionalSide();
    [B09033, H1, H2, H3, H4].forEach(register);
    registerTriggeredListener();
    let state = createEmptyGameState();
    state.players.self.case.status = '解決編';
    state.players.self.case.colors = ['緑'];
    state.players.self.deck = [H1.id, H2.id, H3.id, H4.id];
    state.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: H1.id }));
    (globalThis as { __humanPlayerSide?: 'self' }).__humanPlayerSide = 'self';
    const ctx = { source: { player: 'self' as const, cardId: B09033.id, abilityId: 'a1', area: 'hand' }, bindings: {} };
    const effect = resolveEffectPicks(state, B09033.abilities[0]!.effect!, ctx, { humanChooser: true, byPlayer: 'self', source: { cardId: B09033.id, abilityId: 'a1' } });
    state = produce(state, d => runEffect(d, effect, ctx));

    for (let i = 0; i < 4; i++) {
      const pick = _drainPendingEffectPickSide();
      expect(pick).toBeTruthy();
      const chosen = pick!.candidates[0]!;
      state = produce(state, d => applyPickAndContinuation(d, pick!, chosen.uid ?? chosen.cardId, [chosen.uid ?? chosen.cardId]));
      if (i < 3) {
        const optional = _drainPendingEffectRepeatOptionalSide();
        expect(optional).toBeTruthy();
        state = produce(state, d => applyRepeatOptionalAndContinuation(d, optional!, true));
      }
    }

    expect(state.players.self.scene).toHaveLength(4);
    expect(state.players.self.file).toHaveLength(3);
    // 4枚目の登場で exact exhaustion。反復コストで remove へ移した FILE 3枚を即 refresh。
    expect(state.players.self.deck).toEqual([H1.id, H1.id, H1.id]);
    expect(state.players.self.remove).toHaveLength(0);
    expect(state.refreshCount.self).toBe(1);
    expect(state.players.opp.evidence).toHaveLength(1);
  });

  it('同一カードIDでも、選択した公開window上の実体だけを登場させ、残った同IDを次の反復で選べる', () => {
    _resetRegistry(); _resetTriggeredRegistered(); _clearPendingEffectPickQueue(); _clearPendingEffectOptionalSide(); _clearPendingEffectRepeatOptionalSide();
    [B09033, DUP, H2].forEach(register);
    registerTriggeredListener();
    let state = createEmptyGameState();
    state.players.self.case.status = '解決編';
    state.players.self.case.colors = ['緑'];
    state.players.self.deck = [DUP.id, H2.id, DUP.id];
    state.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: H1.id }));
    (globalThis as { __humanPlayerSide?: 'self' }).__humanPlayerSide = 'self';
    const ctx = { source: { player: 'self' as const, cardId: B09033.id, abilityId: 'a1', area: 'hand' }, bindings: {} };
    const effect = resolveEffectPicks(state, B09033.abilities[0]!.effect!, ctx, { humanChooser: true, byPlayer: 'self', source: { cardId: B09033.id, abilityId: 'a1' } });
    state = produce(state, d => runEffect(d, effect, ctx));

    const first = _drainPendingEffectPickSide()!;
    const lastDuplicate = first.candidates.find(c => c.cardId === DUP.id && c.uid?.endsWith('#2'));
    expect(lastDuplicate).toBeTruthy();
    state = produce(state, d => applyPickAndContinuation(d, first, lastDuplicate!.uid!, [lastDuplicate!.uid!]));

    const optional = _drainPendingEffectRepeatOptionalSide();
    expect(optional).toBeTruthy();
    state = produce(state, d => applyRepeatOptionalAndContinuation(d, optional!, true));
    const second = _drainPendingEffectPickSide()!;
    expect(second.candidates.some(c => c.cardId === DUP.id && c.uid?.endsWith('#0'))).toBe(true);
  });

  it('0枚選択: 初回と反復roundのpickをskipしても次の任意roundへ進み、残りをデッキ下へ置く', () => {
    resetB09033(H1, H2, H3);
    let state = createEmptyGameState();
    state.players.self.deck = [H1.id, H2.id, H3.id];
    state.players.self.file = Array.from({ length: 2 }, () => ({ type: 'card-back' as const, cardId: H1.id }));
    (globalThis as { __humanPlayerSide?: 'self' }).__humanPlayerSide = 'self';
    const ctx = b09033Context();
    const effect = resolveEffectPicks(state, B09033.abilities[0]!.effect!, ctx, { humanChooser: true, byPlayer: 'self', source: { cardId: B09033.id, abilityId: 'a1' } });
    state = produce(state, d => runEffect(d, effect, ctx));

    const initial = _drainPendingEffectPickSide()!;
    state = produce(state, d => applyPickSkipAndContinuation(d, initial, false));
    const firstRepeat = _drainPendingEffectRepeatOptionalSide();
    expect(firstRepeat).toMatchObject({ player: 'self', remaining: 3 });
    state = produce(state, d => applyRepeatOptionalAndContinuation(d, firstRepeat!, true));
    const roundPick = _drainPendingEffectPickSide()!;
    state = produce(state, d => applyPickSkipAndContinuation(d, roundPick, false));
    const secondRepeat = _drainPendingEffectRepeatOptionalSide();
    expect(secondRepeat).toMatchObject({ player: 'self', remaining: 2 });
    state = produce(state, d => applyRepeatOptionalAndContinuation(d, secondRepeat!, false));

    expect(state.players.self.scene).toHaveLength(0);
    expect(state.players.self.file).toHaveLength(1);
    expect(state.players.self.deck).toEqual([H1.id, H2.id, H3.id]);
    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(_drainPendingEffectRepeatOptionalSide()).toBeNull();
  });

  it('Q&A: FILEが0枚でも、反復roundはカードを登場させられる', () => {
    resetB09033(H1, H2);
    let state = createEmptyGameState();
    state.players.self.deck = [H1.id, H2.id];
    (globalThis as { __humanPlayerSide?: 'self' }).__humanPlayerSide = 'self';
    const ctx = b09033Context();
    const effect = resolveEffectPicks(state, B09033.abilities[0]!.effect!, ctx, { humanChooser: true, byPlayer: 'self', source: { cardId: B09033.id, abilityId: 'a1' } });
    state = produce(state, d => runEffect(d, effect, ctx));
    const initial = _drainPendingEffectPickSide()!;
    state = produce(state, d => applyPickAndContinuation(d, initial, initial.candidates[0]!.uid!));
    const repeat = _drainPendingEffectRepeatOptionalSide()!;
    state = produce(state, d => applyRepeatOptionalAndContinuation(d, repeat, true));
    const round = _drainPendingEffectPickSide()!;
    state = produce(state, d => applyPickAndContinuation(d, round, round.candidates[0]!.uid!));

    expect(state.players.self.file).toHaveLength(0);
    expect(state.players.self.scene.map(c => c.cardId)).toEqual([H1.id, H2.id]);
  });

  it('owner=opp / human=self: 初回windowはAIが選び、反復任意だけauto-declineして残りをbottomへ置く', () => {
    resetB09033(H1, H2);
    const state = createEmptyGameState();
    state.players.opp.deck = [H1.id, H2.id];
    state.players.opp.hand = [B09033.id];
    state.players.opp.case.colors = ['緑'];
    state.players.opp.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: H1.id }));
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' }).__humanPlayerSide = 'self';

    handUseCard(state, 'opp', B09033.id);
    runAllUntilEmpty(state);
    drainAiEffectPicks(state);

    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(_drainPendingEffectRepeatOptionalSide()).toBeNull();
    expect(state.players.opp.scene.map(c => c.cardId)).toEqual([H1.id]);
    expect(state.players.opp.deck).toEqual([H2.id]);
  });

  it('production event-use dispatch: human selfで初回pick→反復decline→公開残りをデッキ下へ置く', () => {
    resetB09033(H1, H2, H3);
    let state = createEmptyGameState();
    state.players.self.hand = [B09033.id];
    state.players.self.deck = [H1.id, H2.id, H3.id];
    state.players.self.case.colors = ['緑'];
    state.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: H1.id }));
    (globalThis as { __humanPlayerSide?: 'self' }).__humanPlayerSide = 'self';

    handUseCard(state, 'self', B09033.id);
    runAllUntilEmpty(state);
    const initial = _drainPendingEffectPickSide();
    expect(initial).toMatchObject({ player: 'self', atomVerb: 'sceneEnter' });
    state = produce(state, d => applyPickAndContinuation(d, initial!, initial!.candidates[0]!.uid!));
    const repeat = _drainPendingEffectRepeatOptionalSide();
    expect(repeat).toMatchObject({ player: 'self', remaining: 3 });
    state = produce(state, d => applyRepeatOptionalAndContinuation(d, repeat!, false));

    expect(state.players.self.scene.map(c => c.cardId)).toEqual([H1.id]);
    expect(state.players.self.deck).toEqual([H2.id, H3.id]);
    expect(state.players.self.remove).toContain(B09033.id);
  });

  it('AI/spectator: 初回windowはAIが選び、反復任意はskipしてpromptを残さない', () => {
    resetB09033(H1, H2);
    const state = createEmptyGameState();
    state.players.self.hand = [B09033.id];
    state.players.self.deck = [H1.id, H2.id];
    state.players.self.case.colors = ['緑'];
    state.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: H1.id }));
    (globalThis as { __humanPlayerSide?: 'self' | null }).__humanPlayerSide = null;

    handUseCard(state, 'self', B09033.id);
    runAllUntilEmpty(state);
    drainAiEffectPicks(state);

    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(_drainPendingEffectRepeatOptionalSide()).toBeNull();
    expect(state.players.self.scene.map(c => c.cardId)).toEqual([H1.id]);
    expect(state.players.self.deck).toEqual([H2.id]);
  });
});
