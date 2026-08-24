// qa: card:B04023:d0c74bb56871ed8c7a652acc4f63e492bee4dac3c03ede1fcc8e65fc8b8b4b2e
// qa: card:D09014:d0c74bb56871ed8c7a652acc4f63e492bee4dac3c03ede1fcc8e65fc8b8b4b2e
// qa: card:D09015:d0c74bb56871ed8c7a652acc4f63e492bee4dac3c03ede1fcc8e65fc8b8b4b2e

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B04023 } from '@/cards/ct-p04/B04023';
import { D09014 } from '@/cards/ct-d09/D09014';
import { D09015 } from '@/cards/ct-d09/D09015';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';

const PARTNER = 'D08001';
const ROWS = [B04023, D09014, D09015] as const;

function ordinaryFile(prefix: string, count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    type: 'card-back' as const,
    cardId: `${prefix}-${index}`,
  }));
}

function stateFor(card: CardDef, owner: Player, ordinary: number): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner = { cardId: PARTNER, state: 'active', location: 'partner-area' };
  state.players[owner].file = ordinaryFile(`${card.id}-${owner}`, ordinary);
  state.players[owner].case.colors = [...card.colors];
  state.players[owner].hand = [card.id];
  state.players.self.deck = ['B01001', 'B01002'];
  state.players.opp.deck = ['B01001', 'B01002'];
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave98-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave98 state');
  return state;
}

function run(card: CardDef, owner: Player, ordinary: number) {
  install(stateFor(card, owner, ordinary), owner, `${card.id}-${owner}-${ordinary}`);
  expect(dispatchEngineAction({ type: 'assist', player: owner })).toEqual({ ok: true });
  expect(current().players[owner].file).toHaveLength(ordinary + 1);
  expect(current().players[owner].file.at(-1)).toEqual({
    type: 'assisted-partner',
    cardId: PARTNER,
  });
  const result = dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id });
  const store = useGameStateStore.getState();
  return {
    result,
    optional: store.pendingEffectOptional,
    pick: store.pendingEffectPick,
    state: current(),
  };
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetRegistry();
  _resetUidCounter();
  _resetTriggeredRegistered();
  registerAll();
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave98: B04023 D09014 D09015 FILE7 counts an assisted partner', () => {
  it.each(ROWS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner $owner triggers at six ordinary FILE cards plus its assisted partner',
    ({ card, owner }) => {
      const atSeven = run(card, owner, 6);
      expect(atSeven.result).toEqual({ ok: true });
      const pending = card.id === B04023.id ? atSeven.optional : atSeven.pick;
      expect(pending?.source).toMatchObject({ cardId: card.id, uid: expect.any(String) });

      const atSix = run(card, owner, 5);
      expect(atSix.result).toEqual({ ok: true });
      expect(atSix.optional).toBeNull();
      expect(atSix.pick).toBeNull();
      expect(atSix.state.players[owner].file).toHaveLength(6);
    },
  );
});
