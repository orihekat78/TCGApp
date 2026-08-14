import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B03006 } from '@/cards/ct-p03/B03006';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const FILLER = 'QA_SWITCH_FILLER';

const filler: CardDef = {
  id: FILLER,
  no: FILLER,
  kind: 'character',
  names: [FILLER],
  colors: ['青'],
  level: 1,
  ap: 1000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
};

function fullScene(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['青'];
  state.players.self.file = Array.from(
    { length: 8 },
    () => ({ type: 'card-back' as const, cardId: 'FILE' }),
  );
  state.players.self.hand = [B03006.id];
  state.players.self.scene = Array.from(
    { length: 5 },
    (_, index) => sceneChar(FILLER, `self-${index + 1}`),
  );
  state.players.opp.scene = [sceneChar(FILLER, 'opp-only')];
  return state;
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  [B03006, filler].forEach(register);
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('handUseCardSwitch removeUid public authority', () => {
  it.each([
    ['an opponent-scene UID', 'opp-only'],
    ['a stale UID', 'missing'],
  ])('rejects %s before engine mutation', (_label, removeUid) => {
    const state = fullScene();
    expect(useGameStateStore.getState().setGameState(state)).toBe(true);
    const before = JSON.stringify(state);

    expect(dispatchEngineAction({
      type: 'handUseCardSwitch',
      player: 'self',
      cardId: B03006.id,
      removeUid,
    })).toEqual({ ok: false, reason: 'not-allowed' });

    expect(JSON.stringify(useGameStateStore.getState().gameState)).toBe(before);
  });
});
