import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards/index';
import { resolveActionAgainstChar } from '@/ai/action-resolution';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { engine } from '@/engine';
import { _clearPendingEffectPickQueue, _peekPendingEffectPickQueueLength } from '@/engine/effect/resolve-picks';
import { event } from '@/engine/event/index';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import type { SceneCharacter } from '@/engine/types/game-state';
import { useGameStateStore } from '@/ui/state/store';

function sceneCard(cardId: string, uid: string, state: SceneCharacter['state']): SceneCharacter {
  return {
    cardId,
    uid,
    state,
    isNamed: false,
    enterOrder: 1,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}

describe('BUG-212 production contact provenance', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    event._resetRegistry();
    _resetActionContexts();
    _clearPendingEffectPickQueue();
    _setHumanPlayerSide('self');
    useGameStateStore.setState({ pendingEffectPick: null });
    registerAll();
  });

  afterEach(() => {
    _clearPendingEffectPickQueue();
    _setHumanPlayerSide(null);
  });

  it('D02007 が D08017 を通常コンタクトで除去しても手札discard/pendingを生成しない', () => {
    const initial = createEmptyGameState();
    initial.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    initial.players.self.hand = ['D02007', 'D02007', 'D02007'];
    initial.players.opp.hand = ['D02007', 'D02007'];
    initial.players.self.scene = [sceneCard('D08017', 'def-mitsuhiko', 'sleep')];
    initial.players.opp.scene = [sceneCard('D02007', 'atk-okita', 'active')];

    const after = produce(initial, (draft) => {
      resolveActionAgainstChar(draft, 'atk-okita', 'def-mitsuhiko', new HeuristicPolicy());
      engine.resolve.runAllUntilEmpty(draft);
    });

    expect(after.players.self.scene).toHaveLength(0);
    expect(after.players.self.remove).toContain('D08017');
    expect(after.players.self.hand).toEqual(['D02007', 'D02007', 'D02007']);
    expect(after.players.opp.hand).toEqual(['D02007', 'D02007']);
    expect(_peekPendingEffectPickQueueLength()).toBe(0);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(after.pendingEffects.some((entry) => entry.state === 'pending' || entry.state === 'resolving')).toBe(false);
  });
});
