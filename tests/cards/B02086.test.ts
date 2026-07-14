import { beforeEach, describe, expect, it } from 'vitest';
import { B02086 } from '@/cards/ct-p02/B02086';
import { B02086P } from '@/cards/ct-p02/B02086P';
import { registerAll } from '@/cards/index';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../helpers/fixtures';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve';
import { _clearPendingEffectOptionalSide, _drainPendingEffectOptionalSide, _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { applyOptionalAndContinuation, applyPickAndContinuation } from '@/engine/effect/apply-pick';

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _clearPendingEffectOptionalSide(); _clearPendingEffectPickQueue();
  resetDefRegistry(); registerAll(); registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

describe('B02086 Vermouth opponent optional', () => {
  it('base/P match and human opponent can discard a chosen card', () => {
    expect({ ...B02086P, id: B02086.id, no: B02086.no, rarity: B02086.rarity, imageUrl: B02086.imageUrl }).toEqual(B02086);
    const s = createEmptyGameState();
    s.players.opp.scene = [sceneChar('B02086', 'verm')];
    s.players.self.hand = ['A', 'B'];
    event.emit(s, 'disguise:into', { uid: 'verm', player: 'opp' }, { player: 'opp', uid: 'verm', cardId: 'B02086' });
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectOptionalSide();
    expect(pending?.player).toBe('self');
    expect(pending?.ownerPlayer).toBe('opp');
    applyOptionalAndContinuation(s, pending!, true);
    const pick = _drainPendingEffectPickSide();
    expect(pick?.player).toBe('self');
    applyPickAndContinuation(s, pick!, pick!.candidates.find(c => c.cardId === 'B')!.uid);
    expect(s.players.self.remove).toEqual(['B']);
  });

  it('decline and zero hand grant only this action contact immunity', () => {
    const decline = createEmptyGameState();
    decline.players.opp.scene = [sceneChar('B02086', 'verm')];
    decline.players.self.hand = ['A'];
    event.emit(decline, 'disguise:into', { uid: 'verm', player: 'opp' }, { player: 'opp', uid: 'verm', cardId: 'B02086' });
    runAllUntilEmpty(decline);
    applyOptionalAndContinuation(decline, _drainPendingEffectOptionalSide()!, false);
    expect(decline.players.opp.scene[0]!.turnEffects.contactImmune_action).toBe(true);
    expect(decline.players.self.hand).toEqual(['A']);

    const zero = createEmptyGameState();
    zero.players.opp.scene = [sceneChar('B02086', 'verm')];
    event.emit(zero, 'disguise:into', { uid: 'verm', player: 'opp' }, { player: 'opp', uid: 'verm', cardId: 'B02086' });
    runAllUntilEmpty(zero);
    applyOptionalAndContinuation(zero, _drainPendingEffectOptionalSide()!, false);
    expect(zero.players.opp.scene[0]!.turnEffects.contactImmune_action).toBe(true);
  });

  it('AI accepts when it can discard and declines at zero hand', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    const paid = createEmptyGameState();
    paid.players.opp.scene = [sceneChar('B02086', 'verm')];
    paid.players.self.hand = ['A'];
    event.emit(paid, 'disguise:into', { uid: 'verm', player: 'opp' }, { player: 'opp', uid: 'verm', cardId: 'B02086' });
    runAllUntilEmpty(paid);
    expect(paid.players.self.remove).toEqual(['A']);
    expect(paid.players.opp.scene[0]!.turnEffects.contactImmune_action).not.toBe(true);
  });
});
