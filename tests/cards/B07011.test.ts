import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { B07011 } from '@/cards/ct-p07/B07011';
import { registerAll } from '@/cards';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../helpers/fixtures';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve';
import { _clearPendingEffectPickQueue, _clearPendingRpsSide, _drainPendingEffectPickSide, _drainPendingRpsSide } from '@/engine/effect/pending-state';
import { applyRpsAndContinuation } from '@/engine/effect/apply-pick';

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _clearPendingRpsSide(); _clearPendingEffectPickQueue();
  resetDefRegistry(); registerAll(); registerTriggeredListener();
});
afterEach(() => vi.restoreAllMocks());

describe('B07011 rock-paper-scissors', () => {
  it('surfaces a dedicated human decision and applies the winning branch', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('B07011', 'yuki')];
    s.players.self.deck = ['X'];
    event.emit(s, 'enter', { uid: 'yuki' }, { player: 'self', uid: 'yuki', cardId: 'B07011' });
    runAllUntilEmpty(s);
    const pending = _drainPendingRpsSide();
    expect(pending).toMatchObject({ player: 'self', ownerPlayer: 'self', aiHand: 'rock' });
    applyRpsAndContinuation(s, pending!, 'paper');
    expect(s.players.self.hand).toEqual(['X']);
  });

  it('resolves AI-vs-AI without a pending decision', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.4);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('B07011', 'yuki')];
    s.players.self.deck = ['X'];
    s.players.self.hand = ['Y'];
    event.emit(s, 'enter', { uid: 'yuki' }, { player: 'self', uid: 'yuki', cardId: 'B07011' });
    runAllUntilEmpty(s);
    expect(_drainPendingRpsSide()).toBeNull();
    expect(s.players.self.hand).toContain('X');
    expect(s.players.self.hand.length + s.players.self.remove.length).toBe(2);
  });

  it('does not let a sibling overtake B07011 while the RPS decision is pending, then retains provenance through the losing discard pick', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // AI = rock; human scissors loses.
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('B07011', 'yuki')];
    s.players.self.deck = ['DRAW-RPS', 'DRAW-SIBLING'];
    s.players.self.hand = ['DISCARD-ME'];
    event.emit(s, 'enter', { uid: 'yuki' }, { player: 'self', uid: 'yuki', cardId: 'B07011' });
    const rpsEntry = s.pendingEffects[0]!;
    event.queue(s, { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, { player: 'self', cardId: 'SIBLING', abilityId: 'a1' });
    for (const [index, entry] of s.pendingEffects.entries()) {
      entry.ownerChosenOrder = index;
      entry.ownerOrderConfirmed = true;
    }

    runAllUntilEmpty(s);
    const pending = _drainPendingRpsSide();
    expect(pending, JSON.stringify(s.pendingEffects.map(entry => ({ card: entry.source.cardId, state: entry.state, hook: entry.triggeredBy.hook })))).not.toBeNull();
    expect(s.players.self.hand).toEqual(['DISCARD-ME']);
    expect(s.pendingEffects.find(entry => entry.source.cardId === 'SIBLING')?.state).toBe('pending');

    applyRpsAndContinuation(s, pending!, 'scissors');
    const discard = _drainPendingEffectPickSide();
    expect(discard?.source.triggerBatch).toBe(rpsEntry.triggerBatch);
    expect(discard?.source.ownerOrderConfirmed).toBe(rpsEntry.ownerOrderConfirmed);
  });
});
