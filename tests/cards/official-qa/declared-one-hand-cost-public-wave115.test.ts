// qa: card:B01007:01bb734094827c257df91fd003da99ea0d4b837ed48b4cd5abecc6a860322d09
// qa: card:B01088:01bb734094827c257df91fd003da99ea0d4b837ed48b4cd5abecc6a860322d09
// qa: card:D02013:01bb734094827c257df91fd003da99ea0d4b837ed48b4cd5abecc6a860322d09

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B01007 } from '@/cards/ct-p01/B01007';
import { B01088 } from '@/cards/ct-p01/B01088';
import { D02013 } from '@/cards/ct-d02/D02013';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type Row = { card: CardDef; abilityId: 'a1' | 'a2'; abilityIndex: 0 | 1; sleeps: boolean };
const ROWS: readonly Row[] = [
  { card: B01007, abilityId: 'a2', abilityIndex: 1, sleeps: false },
  { card: B01088, abilityId: 'a1', abilityIndex: 0, sleeps: true },
  { card: D02013, abilityId: 'a1', abilityIndex: 0, sleeps: false },
];
const PARTNER_BLUE = fixture('W115_PARTNER_BLUE', { kind: 'partner', colors: ['青'], ap: undefined, lp: 5 });
const COST_A = fixture('W115_COST_A');
const COST_B = fixture('W115_COST_B');
const OPP_HAND = fixture('W115_OPP_HAND');
const OPP_SLEEP = fixture('W115_OPP_SLEEP');
const OPP_STUN = fixture('W115_OPP_STUN');

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave115 state');
  return state;
}

function install(row: Row, owner: Player, hand: readonly string[], opponentHand: readonly string[] = []): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(row.card.id, 'source')];
  state.players[owner].hand = [...hand];
  state.players[other(owner)].hand = [...opponentHand];
  if (row.card.id === B01007.id) {
    state.players[owner].partner = { cardId: PARTNER_BLUE.id, state: 'active', colors: ['青'] } as never;
  }
  if (row.card.id === D02013.id) {
    state.players[other(owner)].scene = [
      sceneChar(OPP_SLEEP.id, 'opp-sleep', { state: 'sleep' }),
      sceneChar(OPP_STUN.id, 'opp-stun', { state: 'stun' }),
    ];
  }
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  return state;
}

function dispatch(row: Row, indices: number[]) {
  return dispatchEngineAction({
    type: 'declaredAbility', uid: 'source', abilId: row.abilityId,
    abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
    costParams: { removeFromHand: { indices }, choiceIndex: 0 },
  });
}

function useCount(row: Row): number {
  return readChar.declaredUseCount(current(), 'source', row.abilityId, {
    abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
  });
}

function expectSettled(): void {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  expect(store.pendingEffectPick).toBeNull();
  expect(store.pendingEffectChoice).toBeNull();
  expect(store.pendingEffectOptional).toBeNull();
  expect(current().pendingRuntimeState).toBeUndefined();
}

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [PARTNER_BLUE, COST_A, COST_B, OPP_HAND, OPP_SLEEP, OPP_STUN]) register(card);
  registerTriggeredListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave115: exact one-card owner-hand cost', () => {
  // Card-bound physical rows: B01007 B01088 D02013.
  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ row, owner }))))(
    '$row.card.id owner $owner pays its sole hand card and may choose zero target',
    ({ row, owner }) => {
      install(row, owner, [COST_A.id]);
      const baseAp = row.card.ap ?? 0;
      expect(dispatch(row, [0])).toEqual({ ok: true });
      expect(current().players[owner].hand).toEqual([]);
      expect(current().players[owner].remove).toEqual([COST_A.id]);
      expect(current().players[owner].scene[0]?.state).toBe(row.sleeps ? 'sleep' : 'active');
      expect(useCount(row)).toBe(1);
      if (row.card.id === B01007.id) {
        expect(readChar.ap(current(), 'source')).toBe(baseAp + 1000);
        expect(readChar.hasKeyword(current(), 'source', '突撃')).toBe(true);
      }
      expectSettled();

      const retry = structuredClone(current());
      retry.players[owner].hand = [COST_B.id];
      retry.players[owner].scene[0]!.state = 'active';
      expect(useGameStateStore.getState().setGameState(retry)).toBe(true);
      const beforeRetry = JSON.stringify(current());
      expect(dispatch(row, [0])).toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(current())).toBe(beforeRetry);
    },
  );

  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ row, owner }))))(
    '$row.card.id owner $owner rejects an empty owner hand despite opponent cards',
    ({ row, owner }) => {
      const before = install(row, owner, [], [OPP_HAND.id]);
      const beforeJson = JSON.stringify(before);
      expect(dispatch(row, [0])).toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(current())).toBe(beforeJson);
      expect(useCount(row)).toBe(0);
      expectSettled();
    },
  );

  it.each(ROWS.flatMap(row => [
    { row, label: 'empty indices', indices: [] },
    { row, label: 'invalid index', indices: [9] },
    { row, label: 'duplicate index', indices: [0, 0] },
  ]))('$row.card.id rejects $label atomically', ({ row, indices }) => {
    const before = install(row, 'self', [COST_A.id, COST_B.id]);
    const beforeJson = JSON.stringify(before);
    expect(dispatch(row, indices)).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(beforeJson);
    expect(useCount(row)).toBe(0);
    expectSettled();
  });

  it.each(ROWS)('$card.id removes exactly the selected one of two owner hand cards', row => {
    install(row, 'self', [COST_A.id, COST_B.id]);
    expect(dispatch(row, [1])).toEqual({ ok: true });
    expect(current().players.self.hand).toEqual([COST_A.id]);
    expect(current().players.self.remove).toContain(COST_B.id);
    expect(current().players.opp.hand).toEqual([]);
  });
});
