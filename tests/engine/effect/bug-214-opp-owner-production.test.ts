import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards/index';
import { engine } from '@/engine';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { _clearPendingEffectPickQueue, _peekPendingEffectPickQueueLength } from '@/engine/effect/resolve-picks';
import { event } from '@/engine/event/index';
import { _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState, SceneCharacter } from '@/engine/types/game-state';
import { useGameStateStore } from '@/ui/state/store';

function sceneCard(cardId: string, uid: string): SceneCharacter {
  return {
    cardId,
    uid,
    state: 'active',
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

function board(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.hand = ['D08015'];
  state.players.opp.hand = ['D08017'];
  return state;
}

describe('BUG-214 owner=opp production hand removal', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    event._resetRegistry();
    _clearPendingEffectPickQueue();
    _setHumanPlayerSide('self');
    useGameStateStore.setState({ pendingEffectPick: null });
    registerAll();
  });

  afterEach(() => {
    _clearPendingEffectPickQueue();
    _setHumanPlayerSide(null);
  });

  it('B05007.a2 の removeFromHand コストはAI所有のopp手札だけを消費する', () => {
    const state = board();
    state.players.opp.scene = [
      sceneCard('B05007', 'eri-opp'),
      sceneCard('D01005', 'kogoro-opp'),
    ];

    activateDeclaredAbility(state, 'eri-opp', 'a2');
    engine.resolve.runAllUntilEmpty(state);

    expect(state.players.self.hand).toEqual(['D08015']);
    expect(state.players.self.remove).toEqual([]);
    expect(state.players.opp.hand).toEqual([]);
    expect(state.players.opp.remove).toContain('D08017');
    expect(_peekPendingEffectPickQueueLength()).toBe(0);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it('D11014.a2 のdiscard効果はAIとしてopp手札を解決しself選択へ漏らさない', () => {
    const state = board();
    state.players.opp.scene = [sceneCard('D11014', 'shigo-opp')];

    activateDeclaredAbility(state, 'shigo-opp', 'a2');
    engine.resolve.runAllUntilEmpty(state);

    expect(state.players.self.hand).toEqual(['D08015']);
    expect(state.players.self.remove).toEqual([]);
    expect(state.players.opp.hand).toEqual([]);
    expect(state.players.opp.remove).toContain('D08017');
    expect(_peekPendingEffectPickQueueLength()).toBe(0);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});
