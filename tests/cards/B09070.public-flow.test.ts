import { beforeEach, describe, expect, it } from 'vitest';
import { B09070 } from '@/cards/ct-p09/B09070';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../helpers/fixtures';

const FILLER: CardDef = {
  id: 'B09070_FILLER',
  no: 'B09070_FILLER',
  kind: 'character',
  names: ['filler'],
  colors: ['白'],
  level: 1,
  ap: 1000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
};

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  [B09070, FILLER].forEach(registerCardDef);
  registerTriggeredListener();
});

describe('B09070 public end-turn flow', () => {
  it('fires from the MR partner area and readies every character that used Shippu before the next main phase', () => {
    const state = createEmptyGameState();
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partnerAreaMR = sceneChar(B09070.id, 'partnerMR:self');
    state.players.self.scene = [sceneChar(FILLER.id, 'shippu-user', {
      state: 'sleep',
      turnEffects: {
        contactImmune: false,
        removeOnTurnEnd: false,
        shippuFiredCharThisTurn: true,
      },
    })];
    state.players.opp.deck = [FILLER.id, FILLER.id, FILLER.id];
    useGameStateStore.setState({ gameState: state });

    const result = dispatchEngineAction({ type: 'endTurn', player: 'self' });

    expect(result).toEqual({ ok: true });
    const committed = useGameStateStore.getState().gameState!;
    expect(committed.players.self.scene.find(character => character.uid === 'shippu-user')?.state).toBe('active');
    expect(committed.turn).toMatchObject({ number: 4, player: 'opp', phase: 'main' });
  });
});
