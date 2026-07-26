import { beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards/index';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve';
import { declare, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../helpers/fixtures';

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  registerAll();
  registerTriggeredListener();
  _resetActionContexts();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

describe('BUG-249 B03006 simultaneous action triggers', () => {
  it('keeps a3/a4 pending in one real emission batch with distinct labels until confirmed', () => {
    const state = createEmptyGameState();
    state.turn.player = 'self';
    state.players.self.scene = [sceneChar('B03006', 'team', { stackedCards: 5, isNamed: false })];
    state.players.opp.scene = [sceneChar('B03006', 'target', { state: 'sleep' })];

    declare(state, 'team', { kind: 'char', uid: 'target' });
    runAllUntilEmpty(state);

    expect(state.pendingEffects).toHaveLength(2);
    expect(state.pendingEffects.map((entry) => entry.state)).toEqual(['pending', 'pending']);
    expect(state.pendingEffects.map((entry) => entry.source.abilityId)).toEqual(['a3', 'a4']);
    expect(state.pendingEffects.map((entry) => entry.source.cardId)).toEqual(['B03006', 'B03006']);
    expect(new Set(state.pendingEffects.map((entry) => entry.triggerBatch)).size).toBe(1);
    expect(state.pendingEffects[0]!.source.description).not.toEqual(state.pendingEffects[1]!.source.description);
  });

  it('resolves both real B03006 effects in the chosen order after confirmation', () => {
    const state = createEmptyGameState();
    state.turn.player = 'self';
    state.players.self.scene = [sceneChar('B03006', 'team', { stackedCards: 5, isNamed: false })];
    state.players.opp.scene = [sceneChar('B03006', 'target', { state: 'sleep' })];
    state.players.self.deck = ['DRAW-CARD', 'EVIDENCE-CARD'];

    declare(state, 'team', { kind: 'char', uid: 'target' });
    const a3 = state.pendingEffects.find((entry) => entry.source.abilityId === 'a3')!;
    const a4 = state.pendingEffects.find((entry) => entry.source.abilityId === 'a4')!;
    useGameStateStore.setState({ gameState: state });
    expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: a4.id, order: 0, player: 'self' })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'resolveEffectOrder', entryIds: [a4.id, a3.id], player: 'self' })).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;

    expect(after.pendingEffects.map((entry) => entry.state)).toEqual(['resolved', 'resolved']);
    expect(after.players.self.evidence.map(card => card.cardId)).toEqual(['DRAW-CARD']);
    expect(after.players.self.hand).toEqual(['EVIDENCE-CARD']);
    expect(after.players.self.deck).toHaveLength(0);
  });
});
