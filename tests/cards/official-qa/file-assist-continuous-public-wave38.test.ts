// qa: card:B02063:cbce41c9b0c72cca046ffb06c2b4ff9c3af679af4bcfb692fac12dc0b5998a23
// qa: card:B08065:fe489ff3199dbdf91d8a4404721956da51ba17ccb819450ceed5b301f31fe7be
// qa: card:D09008:7b6adc85165927a9ffcabeeb29496cd3029d2be83a247dd80556d7f351a8a2d3
// qa: card:D09009:7b6adc85165927a9ffcabeeb29496cd3029d2be83a247dd80556d7f351a8a2d3
// qa: card:PR283:7b6adc85165927a9ffcabeeb29496cd3029d2be83a247dd80556d7f351a8a2d3
// Rules: 01-victory-conditions.md, 13-keywords.md, 17-icons.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const PARTNER = 'D09001';

type Row = {
  cardId: 'B02063' | 'B08065' | 'D09008' | 'D09009' | 'PR283';
  uid: string;
  threshold: number;
  stat: 'ap' | 'lp';
  base: number;
  boosted: number;
};

const ROWS: Row[] = [
  { cardId: 'B02063', uid: 'shukichi', threshold: 8, stat: 'lp', base: 1, boosted: 2 },
  { cardId: 'B08065', uid: 'kansuke', threshold: 6, stat: 'ap', base: 3000, boosted: 5000 },
  { cardId: 'D09008', uid: 'yui-d08', threshold: 7, stat: 'ap', base: 4000, boosted: 6000 },
  { cardId: 'D09009', uid: 'yui-d09', threshold: 7, stat: 'ap', base: 4000, boosted: 6000 },
  { cardId: 'PR283', uid: 'yui-pr', threshold: 7, stat: 'ap', base: 4000, boosted: 6000 },
];

function cardBacks(prefix: string, count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    type: 'card-back' as const,
    cardId: `${prefix}-${index}`,
  }));
}

function stateFor(row: Row, selfCardBacks: number): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner = { cardId: PARTNER, state: 'active', location: 'partner-area' };
  state.players.self.file = cardBacks(`${row.cardId}-SELF-FILE`, selfCardBacks);
  state.players.self.scene = [sceneChar(row.cardId, row.uid)];

  // Deliberately sufficient opponent FILE. A wrong-side read would false-activate the self card.
  state.players.opp.partner = { cardId: PARTNER, state: 'sleep', location: 'file-area' };
  state.players.opp.file = [
    ...cardBacks(`${row.cardId}-OPP-FILE`, row.threshold - 1),
    { type: 'assisted-partner', cardId: PARTNER },
  ];

  if (row.cardId === 'B08065') {
    state.players.self.scene.push(
      sceneChar('D09008', 'nagano-yui'),
      sceneChar('D09014', 'nagano-kansuke'),
    );
  }
  return state;
}

function install(state: GameState): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave38 state');
  return state;
}

function value(state: GameState, row: Row): number {
  return row.stat === 'ap' ? readChar.ap(state, row.uid) : readChar.lp(state, row.uid);
}

function runAssist(row: Row, beforeCount: number) {
  install(stateFor(row, beforeCount));
  const before = value(current(), row);
  const dispatched = dispatchEngineAction({ type: 'assist', player: 'self' }).ok;
  const after = current();
  return {
    before,
    dispatched,
    after: value(after, row),
    selfFileCount: after.players.self.file.length,
    opponentFileCount: after.players.opp.file.length,
    selfAssistedEntries: after.players.self.file.filter(entry => entry.type === 'assisted-partner').length,
    partnerState: after.players.self.partner.state,
    partnerLocation: after.players.self.partner.location,
    assistedThisTurn: after.turnState.self.assistedThisTurn,
  };
}

function prove(row: Row) {
  return {
    cardId: row.cardId,
    below: runAssist(row, row.threshold - 2),
    exact: runAssist(row, row.threshold - 1),
  };
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  resetPendingRuntimeState();
  registerAll();
  registerTriggeredListener();
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.getState().setGameState(null);
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('official QA Wave38: an assisting partner counts for continuous FILE conditions', () => {
  it('B02063 counts its partner as FILE8 for LP+1', () => {
    expect(prove(ROWS[0]!)).toEqual({
      cardId: 'B02063',
      below: { before: 1, dispatched: true, after: 1, selfFileCount: 7, opponentFileCount: 8, selfAssistedEntries: 1, partnerState: 'sleep', partnerLocation: 'file-area', assistedThisTurn: true },
      exact: { before: 1, dispatched: true, after: 2, selfFileCount: 8, opponentFileCount: 8, selfAssistedEntries: 1, partnerState: 'sleep', partnerLocation: 'file-area', assistedThisTurn: true },
    });
  });

  it('B08065 counts its partner as FILE6 while retaining its other continuous gates', () => {
    expect(prove(ROWS[1]!)).toEqual({
      cardId: 'B08065',
      below: { before: 3000, dispatched: true, after: 3000, selfFileCount: 5, opponentFileCount: 6, selfAssistedEntries: 1, partnerState: 'sleep', partnerLocation: 'file-area', assistedThisTurn: true },
      exact: { before: 3000, dispatched: true, after: 5000, selfFileCount: 6, opponentFileCount: 6, selfAssistedEntries: 1, partnerState: 'sleep', partnerLocation: 'file-area', assistedThisTurn: true },
    });
  });

  it('D09008 counts its partner as FILE7 for AP+2000', () => {
    expect(prove(ROWS[2]!)).toEqual({
      cardId: 'D09008',
      below: { before: 4000, dispatched: true, after: 4000, selfFileCount: 6, opponentFileCount: 7, selfAssistedEntries: 1, partnerState: 'sleep', partnerLocation: 'file-area', assistedThisTurn: true },
      exact: { before: 4000, dispatched: true, after: 6000, selfFileCount: 7, opponentFileCount: 7, selfAssistedEntries: 1, partnerState: 'sleep', partnerLocation: 'file-area', assistedThisTurn: true },
    });
  });

  it('D09009 counts its partner as FILE7 for AP+2000', () => {
    expect(prove(ROWS[3]!)).toEqual({
      cardId: 'D09009',
      below: { before: 4000, dispatched: true, after: 4000, selfFileCount: 6, opponentFileCount: 7, selfAssistedEntries: 1, partnerState: 'sleep', partnerLocation: 'file-area', assistedThisTurn: true },
      exact: { before: 4000, dispatched: true, after: 6000, selfFileCount: 7, opponentFileCount: 7, selfAssistedEntries: 1, partnerState: 'sleep', partnerLocation: 'file-area', assistedThisTurn: true },
    });
  });

  it('PR283 counts its partner as FILE7 for AP+2000', () => {
    expect(prove(ROWS[4]!)).toEqual({
      cardId: 'PR283',
      below: { before: 4000, dispatched: true, after: 4000, selfFileCount: 6, opponentFileCount: 7, selfAssistedEntries: 1, partnerState: 'sleep', partnerLocation: 'file-area', assistedThisTurn: true },
      exact: { before: 4000, dispatched: true, after: 6000, selfFileCount: 7, opponentFileCount: 7, selfAssistedEntries: 1, partnerState: 'sleep', partnerLocation: 'file-area', assistedThisTurn: true },
    });
  });
});
