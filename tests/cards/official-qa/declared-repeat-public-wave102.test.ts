// qa: card:B05046:5f60f8b4db37b8f92d03a16be385db13124478a72d7648dca0c733585d01bc54
// qa: card:B07074:5f60f8b4db37b8f92d03a16be385db13124478a72d7648dca0c733585d01bc54
// qa: card:B09062:5f60f8b4db37b8f92d03a16be385db13124478a72d7648dca0c733585d01bc54
// Rules: 17-icons, 21-declared-ability-cost.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B05046 } from '@/cards/ct-p05/B05046';
import { B05046P } from '@/cards/ct-p05/B05046P';
import { B05046P2 } from '@/cards/ct-p05/B05046P2';
import { B07074 } from '@/cards/ct-p07/B07074';
import { B09062 } from '@/cards/ct-p09/B09062';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type Row = {
  card: CardDef;
  abilityId: 'a2' | 'a3';
  abilityIndex: 1 | 2;
  pickVerb?: 'charModifyAP' | 'sceneSetState';
  choiceIndex?: 0;
};

const ROWS: Row[] = [
  { card: B05046, abilityId: 'a3', abilityIndex: 2, pickVerb: 'sceneSetState' },
  { card: B05046P, abilityId: 'a3', abilityIndex: 2, pickVerb: 'sceneSetState' },
  { card: B05046P2, abilityId: 'a3', abilityIndex: 2, pickVerb: 'sceneSetState' },
  { card: B07074, abilityId: 'a2', abilityIndex: 1, pickVerb: 'charModifyAP', choiceIndex: 0 },
  { card: B09062, abilityId: 'a2', abilityIndex: 1 },
];

const COST_A = 'W102-COST-A';
const COST_B = 'W102-COST-B';
const OTHER_KEEP = 'W102-OTHER-KEEP';
const DECK_FILLER = 'W102-DECK-FILLER';

function fixture(id: string, traits: string[] = []): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['白'], level: 1, ap: 1000, lp: 1,
    traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function sourceUid(row: Row, owner: Player): string {
  return `wave102-${owner}-${row.card.id}`;
}

function stateFor(row: Row, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 15, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(row.card.id, sourceUid(row, owner))];
  state.players[owner].hand = [COST_A, COST_B];
  state.players[other(owner)].hand = [OTHER_KEEP];
  state.players.self.deck = [DECK_FILLER, DECK_FILLER];
  state.players.opp.deck = [DECK_FILLER, DECK_FILLER];
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  resetPresentationQueue(`qa-wave102-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave102 state');
  return state;
}

function useOnce(row: Row, owner: Player): void {
  expect(dispatchEngineAction({
    type: 'declaredAbility', uid: sourceUid(row, owner), abilId: row.abilityId,
    abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
    costParams: {
      removeFromHand: { indices: [0] },
      ...(row.choiceIndex === undefined ? {} : { choiceIndex: row.choiceIndex }),
    },
  })).toEqual({ ok: true });
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  if (row.pickVerb === undefined) {
    expect(pending).toBeNull();
    return;
  }
  expect(pending?.atomVerb).toBe(row.pickVerb);
  expect(pending?.nMin).toBe(0);
  expect(pending?.source).toMatchObject({
    cardId: row.card.id, abilityId: row.abilityId,
    abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
  });
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: null,
  }))).toEqual({ ok: true });
  surfacePendingSideChannels();
  expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  register(fixture(COST_A, ['鈴木財閥']));
  register(fixture(COST_B, ['鈴木財閥']));
  register(fixture(OTHER_KEEP));
  register(fixture(DECK_FILLER));
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave102: declarations without turn limits remain repeatable while costs remain payable', () => {
  // Card-bound physical rows: B05046/B05046P/B05046P2, B07074, B09062.
  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ row, owner }))))(
    '$row.card.id owner $owner publicly uses the declaration twice and a third unpaid attempt is atomic',
    ({ row, owner }) => {
      install(stateFor(row, owner), owner, `${row.card.id}-${owner}`);
      const opponentHand = [...current().players[other(owner)].hand];

      // Card-bound repeat proof: B05046/B05046P/B05046P2, B07074, B09062.
      useOnce(row, owner);
      expect(current().players[owner].remove).toEqual([COST_A]);
      expect(readChar.declaredUseCount(current(), sourceUid(row, owner), row.abilityId, {
        abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
      })).toBe(1);

      useOnce(row, owner);
      expect(current().players[owner].remove).toEqual([COST_A, COST_B]);
      expect(current().players[owner].hand).toEqual([]);
      expect(current().players[other(owner)].hand).toEqual(opponentHand);
      expect(readChar.declaredUseCount(current(), sourceUid(row, owner), row.abilityId, {
        abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
      })).toBe(2);
      if (row.card.id === 'B09062') {
        expect(readChar.hasKeyword(current(), sourceUid(row, owner), '突撃')).toBe(true);
      }

      const before = current();
      const beforeJson = JSON.stringify(before);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: sourceUid(row, owner), abilId: row.abilityId,
        abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
        costParams: { removeFromHand: { indices: [0] } },
      })).toEqual({ ok: false, reason: 'not-allowed' });
      expect(current()).toBe(before);
      expect(JSON.stringify(current())).toBe(beforeJson);
    },
  );
});
