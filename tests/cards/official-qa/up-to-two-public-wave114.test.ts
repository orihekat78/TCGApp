// qa: card:B01022:9f6ab1b52677a41085f0ff92eeb2b7d34234ca1be8b9cb52cfd66f62b4062d2d
// qa: card:PR042:9f6ab1b52677a41085f0ff92eeb2b7d34234ca1be8b9cb52cfd66f62b4062d2d
// qa: card:PR046:9f6ab1b52677a41085f0ff92eeb2b7d34234ca1be8b9cb52cfd66f62b4062d2d

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B01022 } from '@/cards/ct-p01/B01022';
import { PR042 } from '@/cards/pr-01/PR042';
import { PR046 } from '@/cards/pr-01/PR046';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';

const PARTNER_BLUE = fixture('W114_PARTNER_BLUE', { kind: 'partner', colors: ['青'], ap: undefined, lp: 5 });
const COST = fixture('W114_COST');
const A = fixture('W114_A', { level: 2, traits: ['少年探偵団'] });
const B = fixture('W114_B', { level: 3, traits: ['少年探偵団'] });
const C = fixture('W114_C', { level: 4, traits: ['少年探偵団'] });
const OUTSIDE = fixture('W114_OUTSIDE', { level: 2, traits: ['少年探偵団'] });
const WRONG_TRAIT = fixture('W114_WRONG_TRAIT', { level: 2, traits: ['探偵'] });
const WRONG_LEVEL = fixture('W114_WRONG_LEVEL', { level: 5, traits: ['少年探偵団'] });
const TAIL = fixture('W114_TAIL');
const REMOVE_SOURCES = [PR042, PR046] as const;

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
  if (!state) throw new Error('missing Wave114 state');
  return state;
}

function installB01022(owner: Player, eligible = true): void {
  const state = createEmptyGameState();
  state.turn = { number: 3, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['青'];
  state.players[owner].partner = { cardId: PARTNER_BLUE.id, state: 'active', colors: ['青'] } as never;
  state.players[owner].file = Array.from(
    { length: B01022.level ?? 0 },
    () => ({ type: 'card-back' as const, cardId: TAIL.id }),
  );
  state.players[owner].hand = [B01022.id];
  state.players[owner].deck = eligible
    ? [A.id, WRONG_TRAIT.id, B.id, WRONG_LEVEL.id, C.id, TAIL.id, OUTSIDE.id, TAIL.id]
    : [WRONG_TRAIT.id, WRONG_LEVEL.id, TAIL.id, WRONG_TRAIT.id, WRONG_LEVEL.id, TAIL.id, OUTSIDE.id];
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B01022.id }))
    .toEqual({ ok: true });
}

function installRemoveSource(source: CardDef, owner: Player, eligible = true): void {
  const state = createEmptyGameState();
  state.turn = { number: 3, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['白'];
  state.players[owner].partner = { cardId: PARTNER_BLUE.id, state: 'active', colors: ['青'] } as never;
  state.players[owner].file = Array.from(
    { length: source.level ?? 0 },
    () => ({ type: 'card-back' as const, cardId: TAIL.id }),
  );
  state.players[owner].hand = [source.id, COST.id];
  state.players[owner].remove = eligible
    ? [A.id, B.id, C.id, WRONG_TRAIT.id, WRONG_LEVEL.id]
    : [WRONG_TRAIT.id, WRONG_LEVEL.id];
  state.players[other(owner)].remove = [OUTSIDE.id];
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: source.id }))
    .toEqual({ ok: true });
}

function pending(verb: string, sourceId: string) {
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toMatchObject({ atomVerb: verb, nMin: 0, source: { cardId: sourceId, abilityId: 'a1' } });
  return pick!;
}

function resolve(pick: NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>, count: number) {
  const selected = pick.candidates.slice(0, count).map(candidate => candidate.uid);
  return dispatchEngineAction(bindPendingDecision(pick, {
    type: 'effectPickResolve',
    pickedUid: selected[0] ?? null,
    ...(selected.length > 0 ? { pickedUids: selected } : {}),
  }));
}

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [PARTNER_BLUE, COST, A, B, C, OUTSIDE, WRONG_TRAIT, WRONG_LEVEL, TAIL]) register(card);
  registerTriggeredListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave114: B01022 may select zero, one, or two from three eligible cards', () => {
  // Card-bound physical row: B01022.
  it.each((['self', 'opp'] as const).flatMap(owner => [0, 1, 2].map(count => ({ owner, count }))))(
    'owner $owner selects $count',
    ({ owner, count }) => {
      installB01022(owner);
      const pick = pending('sceneEnter', B01022.id);
      expect(pick.nMax).toBe(2);
      expect(pick.candidates.map(candidate => candidate.cardId)).toEqual([A.id, B.id, C.id]);
      expect(resolve(pick, count)).toEqual({ ok: true });
      expect(current().players[owner].scene.map(card => card.cardId)).toEqual([A.id, B.id, C.id].slice(0, count));
      expect(current().players[owner].deck).toHaveLength(8 - count);
      expect(current().players[owner].deck).toContain(OUTSIDE.id);
      for (const unselected of [A.id, B.id, C.id].slice(count)) {
        expect(current().players[owner].deck).toContain(unselected);
      }
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    },
  );

  it('rejects three selected candidates atomically', () => {
    installB01022('self');
    const pick = pending('sceneEnter', B01022.id);
    const before = JSON.stringify(current());
    expect(resolve(pick, 3)).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);
    expect(useGameStateStore.getState().pendingEffectPick?.decisionId).toBe(pick.decisionId);
  });

  it('resolves cleanly with zero eligible cards and preserves the outside-window card', () => {
    installB01022('self', false);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.scene).toEqual([]);
    expect(current().players.self.deck).toContain(OUTSIDE.id);
  });
});

describe('official QA Wave114: PR042/PR046 may deploy zero, one, or two after paying', () => {
  // Card-bound physical rows: PR042 PR046.
  it.each(REMOVE_SOURCES.flatMap(source => (['self', 'opp'] as const).flatMap(owner => (
    [0, 1, 2].map(count => ({ source, owner, count }))
  ))))(
    '$source.id owner $owner selects $count',
    ({ source, owner, count }) => {
      installRemoveSource(source, owner);
      const cost = pending('discard', source.id);
      expect(cost.candidates.map(candidate => candidate.cardId)).toEqual([COST.id]);
      expect(resolve(cost, 1)).toEqual({ ok: true });
      const deploy = pending('sceneEnter', source.id);
      expect(deploy.nMax).toBe(2);
      expect(deploy.candidates.map(candidate => candidate.cardId)).toEqual([A.id, B.id, C.id]);
      expect(resolve(deploy, count)).toEqual({ ok: true });
      const entered = current().players[owner].scene.filter(card => card.cardId !== source.id);
      expect(entered.map(card => card.cardId)).toEqual([A.id, B.id, C.id].slice(0, count));
      expect(entered.every(card => card.state === 'sleep')).toBe(true);
      expect(current().players[other(owner)].remove).toEqual([OUTSIDE.id]);
    },
  );

  it.each(REMOVE_SOURCES)('$id decline at the optional hand removal prevents deployment', source => {
    installRemoveSource(source, 'self');
    const cost = pending('discard', source.id);
    expect(resolve(cost, 0)).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.hand).toEqual([COST.id]);
    expect(current().players.self.scene.map(card => card.cardId)).toEqual([source.id]);
  });

  it.each(REMOVE_SOURCES)('$id resolves after payment with zero eligible remove cards', source => {
    installRemoveSource(source, 'self', false);
    expect(resolve(pending('discard', source.id), 1)).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.scene.map(card => card.cardId)).toEqual([source.id]);
  });
});
