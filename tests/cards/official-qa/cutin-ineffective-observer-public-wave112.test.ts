// qa: card:B03112:ee9ce331a55bc2711aef71d24e94f8cd4cad8c33b1ec5e49f98bad15b291ad43
// qa: card:B03118:ee9ce331a55bc2711aef71d24e94f8cd4cad8c33b1ec5e49f98bad15b291ad43
// qa: card:B09086:ee9ce331a55bc2711aef71d24e94f8cd4cad8c33b1ec5e49f98bad15b291ad43

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B03112 } from '@/cards/ct-p03/B03112';
import { B03112P } from '@/cards/ct-p03/B03112P';
import { B03118 } from '@/cards/ct-p03/B03118';
import { B09086 } from '@/cards/ct-p09/B09086';
import { B09086P } from '@/cards/ct-p09/B09086P';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const SOURCES = [
  { card: B03112, delta: 2000 },
  { card: B03112P, delta: 2000 },
  { card: B03118, delta: 1000 },
  { card: B09086, delta: 2000 },
  { card: B09086P, delta: 2000 },
] as const;

const ineffectiveCutIn: AbilityDef = {
  id: 'cut',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'turn', player: 'self' },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 4000, scope: 'contact' } },
  description: '【自分ターン中】【カットイン】AP＋4000',
  ruleRefs: [],
};

const CUT_NAME = cutInCard('W112_CUT_NAME', ['諸伏景光'], []);
const CUT_TRAIT = cutInCard('W112_CUT_TRAIT', ['長野の刑事'], ['長野県警']);
const CUT_WRONG = cutInCard('W112_CUT_WRONG', ['別人'], ['探偵']);
const CUT_EVENT: CardDef = {
  ...cutInCard('W112_CUT_EVENT', ['諸伏景光'], ['長野県警']),
  kind: 'event',
  ap: undefined,
  lp: undefined,
};
const ATTACKER = fixture('W112_ATTACKER', { ap: 2000 });
const ALLY = fixture('W112_ALLY', { ap: 3000 });
const CONTACT_CASES = SOURCES.flatMap(row => (['self', 'opp'] as const)
  .flatMap(owner => (['target', 'guard'] as const).map(role => ({ row, owner, role }))));
const FILTER_CASES = [B09086, B09086P].flatMap(source => ([
  { cutIn: CUT_NAME, expected: 2000 },
  { cutIn: CUT_TRAIT, expected: 2000 },
  { cutIn: CUT_WRONG, expected: 0 },
  { cutIn: CUT_EVENT, expected: 0 },
] as const).map(testCase => ({ source, ...testCase })));

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function cutInCard(id: string, names: string[], traits: string[]): CardDef {
  return { ...fixture(id), names, traits, abilities: [ineffectiveCutIn] };
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave112 state');
  return state;
}

function install(
  source: CardDef,
  owner: Player,
  role: 'target' | 'guard' | 'bystander',
  cutIn: CardDef,
  handOwner: Player = owner,
): void {
  const attackerOwner = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 4, player: attackerOwner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [
    sceneChar(source.id, 'source', { state: role === 'target' ? 'sleep' : 'active' }),
    sceneChar(ALLY.id, 'ally', { state: 'sleep' }),
  ];
  state.players[handOwner].hand = [cutIn.id];
  state.players[attackerOwner].scene = [sceneChar(ATTACKER.id, 'attacker')];
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function startContact(owner: Player, role: 'target' | 'guard' | 'bystander'): string {
  const targetUid = role === 'target' ? 'source' : 'ally';
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({
    type: 'actionGuard', actionId, guarderUid: role === 'guard' ? 'source' : null,
  })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  const participantUid = role === 'bystander' ? 'ally' : 'source';
  expect(current().actionContexts?.[actionId]).toMatchObject({
    phase: 'action-1', firstUid: 'attacker', secondUid: participantUid,
  });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: other(owner), choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  return actionId;
}

function useCutIn(actionId: string, owner: Player, cardId: string): void {
  expect(dispatchEngineAction({
    type: 'actionContact', actionId, player: owner, choice: { kind: 'cutin', cardId },
  })).toEqual({ ok: true });
}

function finishContact(actionId: string, owner: Player): void {
  const attackerOwner = other(owner);
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: attackerOwner, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
}

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  registerAll();
  for (const card of [CUT_NAME, CUT_TRAIT, CUT_WRONG, CUT_EVENT, ATTACKER, ALLY]) register(card);
  registerTriggeredListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave112: observer fires even when used Cut-In text is ineffective', () => {
  // Card-bound physical rows: B03112 B03112P B03118 B09086 B09086P.
  it.each(CONTACT_CASES)(
    '$row.card.id owner $owner role $role applies only the observer modifier',
    ({ row, owner, role }) => {
      install(row.card, owner, role, CUT_NAME);
      const baseAp = row.card.ap ?? 0;
      const actionId = startContact(owner, role);
      useCutIn(actionId, owner, CUT_NAME.id);
      expect(current().players[owner].hand).toEqual([]);
      expect(current().players[owner].remove).toContain(CUT_NAME.id);
      expect(readChar.ap(current(), 'source')).toBe(baseAp + row.delta);
      expect(current().pendingEffects.filter(entry => (
        entry.source.cardId === row.card.id && entry.triggeredBy.hook === 'cutin:used'
      ))).toHaveLength(1);
      finishContact(actionId, owner);
      expect(readChar.ap(current(), 'source')).toBe(baseAp);
    },
  );

  it.each(SOURCES)('$row.card.id stays unchanged when it is not a contact participant', row => {
    install(row.card, 'self', 'bystander', CUT_NAME);
    const actionId = startContact('self', 'bystander');
    useCutIn(actionId, 'self', CUT_NAME.id);
    expect(readChar.ap(current(), 'source')).toBe(row.card.ap);
  });

  it.each(FILTER_CASES)(
    '$source.id cut-in $cutIn.id adds $expected through the printed filter',
    ({ source, cutIn, expected }) => {
      install(source, 'self', 'target', cutIn);
      const actionId = startContact('self', 'target');
      useCutIn(actionId, 'self', cutIn.id);
      expect(readChar.ap(current(), 'source')).toBe((source.ap ?? 0) + expected);
    },
  );

  it.each(SOURCES)('$row.card.id ignores an opponent Cut-In', row => {
    install(row.card, 'self', 'target', CUT_NAME, 'opp');
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'source' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: 'opp', choice: { kind: 'cutin', cardId: CUT_NAME.id },
    })).toEqual({ ok: true });
    expect(readChar.ap(current(), 'source')).toBe(row.card.ap);
  });
});
