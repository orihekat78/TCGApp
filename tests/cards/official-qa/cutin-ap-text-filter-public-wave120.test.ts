// qa: card:D06003:4b3b3a6e577fa931249ccf431fb14ab9eeff47a1db16ec003d96edbf2af044dc
// qa: card:D06004:4b3b3a6e577fa931249ccf431fb14ab9eeff47a1db16ec003d96edbf2af044dc
// qa: card:D06021:4b3b3a6e577fa931249ccf431fb14ab9eeff47a1db16ec003d96edbf2af044dc

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B01097 } from '@/cards/ct-p01/B01097';
import { B06084 } from '@/cards/ct-p06/B06084';
import { D06003 } from '@/cards/ct-d06/D06003';
import { D06004 } from '@/cards/ct-d06/D06004';
import { D06021 } from '@/cards/ct-d06/D06021';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const SOURCES = [D06003, D06004, D06021] as const;
const PARTNER_GREEN = fixture('W120_PARTNER_GREEN', { kind: 'partner', colors: ['緑'], ap: undefined, lp: 5 });
const PARTNER_BAD = fixture('W120_PARTNER_BAD', { kind: 'partner', colors: ['赤'], ap: undefined, lp: 5 });
const TARGET = fixture('W120_TARGET', { ap: 7000 });
const NON_CUTIN = fixture('W120_NON_CUTIN');

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['緑'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave120 state');
  return state;
}

function install(source: CardDef, owner: Player, partner: CardDef = PARTNER_GREEN, eligible = true): void {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['緑', '白'];
  state.players[owner].partner = {
    cardId: partner.id, state: 'active', colors: [...partner.colors], location: 'partner-area',
  } as GameState['players']['self']['partner'];
  state.players[owner].scene = [sceneChar(source.id, 'source')];
  state.players[other(owner)].scene = [sceneChar(TARGET.id, 'target', { state: 'sleep' })];
  state.players[owner].remove = eligible ? [B06084.id, B01097.id, NON_CUTIN.id] : [B01097.id, NON_CUTIN.id];
  state.players[other(owner)].remove = [B06084.id];
  endMatchSession();
  beginMatchSession(owner);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'target' }))
    .toEqual({ ok: true });
}

function pending(source: CardDef) {
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toMatchObject({
    player: pick?.player, ownerPlayer: pick?.ownerPlayer, atomVerb: 'handAddFromRemove', nMin: 0, nMax: 1,
    source: { uid: 'source', cardId: source.id, abilityId: 'a2', abilityOrigin: 'printed', abilityIndex: 1 },
  });
  return pick!;
}

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [PARTNER_GREEN, PARTNER_BAD, TARGET, NON_CUTIN]) register(card);
  registerTriggeredListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave120: AP-plus Cut-In text controls remove-area retrieval', () => {
  // Card-bound physical rows: D06003 D06004 D06021.
  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).flatMap(owner => (
    [true, false].map(take => ({ source, owner, take }))
  ))))('$source.id owner $owner take $take', ({ source, owner, take }) => {
    install(source, owner);
    const pick = pending(source);
    expect(pick.player).toBe(owner);
    expect(pick.ownerPlayer).toBe(owner);
    expect(pick.candidates).toHaveLength(1);
    expect(pick.candidates[0]).toMatchObject({ cardId: B06084.id, player: owner });
    expect(pick.candidates.map(candidate => candidate.cardId)).not.toContain(B01097.id);
    expect(pick.candidates.map(candidate => candidate.cardId)).not.toContain(NON_CUTIN.id);
    expect(dispatchEngineAction(bindPendingDecision(pick, {
      type: 'effectPickResolve', pickedUid: take ? pick.candidates[0]!.uid : null,
    }))).toEqual({ ok: true });
    expect(current().players[owner].hand.includes(B06084.id)).toBe(take);
    expect(current().players[owner].remove).toContain(B01097.id);
    expect(current().players[owner].remove).toContain(NON_CUTIN.id);
    expect(current().players[other(owner)].remove).toEqual([B06084.id]);
    expect(current().players[owner].scene.find(card => card.uid === 'source')?.state).toBe('sleep');
    expect(readChar.declaredUseCount(current(), 'source', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 1,
    })).toBe(1);
  });

  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner settles with zero eligible owner cards',
    ({ source, owner }) => {
      install(source, owner, PARTNER_GREEN, false);
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(current().players[owner].hand).toEqual([]);
      expect(current().players[other(owner)].remove).toEqual([B06084.id]);
    },
  );

  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner rejects a non-green partner before retrieval',
    ({ source, owner }) => {
      install(source, owner, PARTNER_BAD);
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(current().players[owner].hand).toEqual([]);
      expect(current().players[owner].remove).toEqual([B06084.id, B01097.id, NON_CUTIN.id]);
    },
  );
});
