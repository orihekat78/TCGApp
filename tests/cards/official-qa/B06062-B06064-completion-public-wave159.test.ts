// qa: card:B06062:0006b174016834d6e10769372f487ca740771f9f2b3e55d0e6b52a5c209b5c43
// qa: card:B06062:3dcf957ce25b0100aab930e1cebdfa5824f5183eeddce6011d5699be765a5abf
// qa: card:B06062:a7cc984fb0e3691d53ce48afdd3ec2c50043b1d60db08868a02838de17cad3d9
// qa: card:B06063:34f593b081269e7230603c6ba41bfb30204234c76224753da06ad06d4b837741
// qa: card:B06063:3dcf957ce25b0100aab930e1cebdfa5824f5183eeddce6011d5699be765a5abf
// qa: card:B06063:93d5ba8c720b073b1770d6a26e5c3009e28b78112854e92e612b7fd29ac9ec3d
// qa: card:B06064:3dcf957ce25b0100aab930e1cebdfa5824f5183eeddce6011d5699be765a5abf
// qa: card:B06064:9b6d433b1185b735c64098d872b9750e01d22ef63df05b842c3b6da49181e104

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B06062 } from '@/cards/ct-p06/B06062';
import { B06062P } from '@/cards/ct-p06/B06062P';
import { B06063 } from '@/cards/ct-p06/B06063';
import { B06063P } from '@/cards/ct-p06/B06063P';
import { B06064 } from '@/cards/ct-p06/B06064';
import { B06064P } from '@/cards/ct-p06/B06064P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const HOST = fixture('W159_HOST', { level: 8, ap: 9000, traits: ['YAIBA'] });
const LEADING_TARGET = fixture('W159_LEADING_TARGET', { level: 5, ap: 5000 });
const ENTRY = fixture('W159_ENTRY', { level: 5, traits: ['YAIBA'] });
const FILE_CARD = fixture('W159_FILE', { kind: 'event' });
const DECK_A = fixture('W159_DECK_A', { kind: 'event' });
const DECK_B = fixture('W159_DECK_B', { kind: 'event' });
const DECK_C = fixture('W159_DECK_C', { kind: 'event' });
const REFRESH_SEED = fixture('W159_REFRESH_SEED', { kind: 'event' });
const EVIDENCE = fixture('W159_EVIDENCE', { kind: 'event' });
const SET_INSTANCE = 'w159-set-instance';

const removerAbilities: AbilityDef[] = [
  {
    id: 'remove-set', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'atom', verb: 'charRemoveSetCard',
      args: { uid: 'host', setCardInstanceId: SET_INSTANCE },
    },
    description: 'Remove the exact face-up set event.', ruleRefs: ['rules/16-card-set.md'],
  },
  {
    id: 'remove-host', type: 'declared', scope: 'on-scene',
    effect: { kind: 'atom', verb: 'sceneRemove', args: { uid: 'host', cause: 'effect' } },
    description: 'Remove the set-card host.', ruleRefs: ['rules/15-abilities-effects.md'],
  },
];
const REMOVER = fixture('W159_REMOVER', { abilities: removerAbilities });

const EVENT_ROWS = [B06062, B06062P, B06063, B06063P, B06064, B06064P] as const;
const B06063_ROWS = [B06063, B06063P] as const;
const B06064_ROWS = [B06064, B06064P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave159 state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave159-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(cardId: string, abilityId: string, verb: string): PendingPick {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(pending: PendingPick, uid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: uid,
  }))).toEqual({ ok: true });
}

function useEvent(card: CardDef, owner: Player, route: 'hand' | 'hint' = 'hand'): void {
  const result = route === 'hand'
    ? dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id })
    : dispatchEngineAction({ type: 'nextHint', player: owner, optionalCardId: card.id });
  expect(result).toEqual({ ok: true });
}

function resolveLeadingZero(card: CardDef): void {
  if (card.id.startsWith('B06062')) {
    choose(pendingPick(card.id, 'a1', 'sceneRemove'), null);
  } else if (card.id.startsWith('B06063')) {
    choose(pendingPick(card.id, 'a1', 'sceneToHand'), null);
  }
}

function eventState(card: CardDef, owner: Player, withHost: boolean): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 159, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['白'];
  state.players[owner].file = Array.from({ length: Math.max(card.level ?? 0, 8) }, () => ({
    type: 'card-back' as const, cardId: FILE_CARD.id,
  }));
  state.players[owner].hand = [card.id];
  state.players[owner].scene = withHost ? [sceneChar(HOST.id, 'host')] : [];
  state.players[other(owner)].scene = [sceneChar(LEADING_TARGET.id, 'leading-target', { state: 'sleep' })];
  state.players[owner].deck = [DECK_A.id, DECK_B.id, DECK_C.id, FILE_CARD.id, FILE_CARD.id];
  state.players[other(owner)].deck = [FILE_CARD.id, FILE_CARD.id, FILE_CARD.id];
  return state;
}

function leaveState(card: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  const turnPlayer = other(owner);
  state.turn = { number: 159, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(HOST.id, 'host', {
    setCards: [{ cardId: card.id, faceUp: true, instanceId: SET_INSTANCE }],
  })];
  state.players[owner].remove = [ENTRY.id];
  state.players[turnPlayer].scene = [sceneChar(REMOVER.id, 'remover')];
  state.players.self.deck = [FILE_CARD.id, FILE_CARD.id];
  state.players.opp.deck = [FILE_CARD.id, FILE_CARD.id];
  return state;
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [HOST, LEADING_TARGET, ENTRY, FILE_CARD, DECK_A, DECK_B, DECK_C, REFRESH_SEED, EVIDENCE, REMOVER]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave159: YAIBA set-event common path', () => {
  it.each(EVENT_ROWS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner permits zero leading target but mandates a valid host set',
    ({ card, owner }) => {
      install(eventState(card, owner, true), owner, `${card.id}-${owner}-host`);
      useEvent(card, owner);
      resolveLeadingZero(card);
      const set = pendingPick(card.id, 'a1', 'charSetCard');
      expect(set).toMatchObject({ nMin: 1, nMax: 1 });
      expect(set.candidates.map(candidate => candidate.uid)).toEqual(['host']);
      choose(set, 'host');

      const host = current().players[owner].scene.find(character => character.uid === 'host')!;
      expect(host.setCards).toHaveLength(1);
      expect(host.setCards[0]).toMatchObject({ cardId: card.id, faceUp: true });
      expect(current().players[owner].remove).not.toContain(card.id);
      expect(current().players[other(owner)].scene.some(character => character.uid === 'leading-target')).toBe(true);
    },
  );

  it.each(EVENT_ROWS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner remains usable with no valid host and then goes to remove',
    ({ card, owner }) => {
      install(eventState(card, owner, false), owner, `${card.id}-${owner}-no-host`);
      useEvent(card, owner);
      resolveLeadingZero(card);
      surfacePendingSideChannels();

      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(current().players[owner].hand).toEqual([]);
      expect(current().players[owner].remove).toContain(card.id);
      expect(current().players[owner].scene).toEqual([]);
    },
  );
});

describe('official QA Wave159: B06062/P short-deck mill', () => {
  it.each([B06062, B06062P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner mills all two cards, refreshes once, and mills no remainder',
    ({ card, owner }) => {
      const state = eventState(card, owner, false);
      state.players[owner].deck = [DECK_A.id, DECK_B.id];
      state.players[owner].remove = [REFRESH_SEED.id];
      state.players[other(owner)].evidence = [];
      install(state, owner, `${card.id}-${owner}-short-deck`);

      useEvent(card, owner);
      resolveLeadingZero(card);

      const ownerState = current().players[owner];
      expect(ownerState.deck).toHaveLength(3);
      expect(ownerState.deck).toEqual(expect.arrayContaining([DECK_A.id, DECK_B.id, REFRESH_SEED.id]));
      expect(ownerState.remove).toEqual([card.id]);
      expect(current().players[other(owner)].evidence).toHaveLength(1);
      expect(current().log.filter(entry => entry.action === 'refresh')).toHaveLength(1);
    },
  );
});

describe('official QA Wave159: B06063/P stacked rider', () => {
  it.each(B06063_ROWS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner grants AP+4000 when two physical copies are set',
    ({ card, owner }) => {
      const state = eventState(card, owner, true);
      state.players[owner].hand = [card.id, card.id];
      install(state, owner, `${card.id}-${owner}-double-set`);

      useEvent(card, owner);
      resolveLeadingZero(card);
      choose(pendingPick(card.id, 'a1', 'charSetCard'), 'host');
      expect(read.char.ap(current(), 'host')).toBe(11000);

      useEvent(card, owner, 'hint');
      resolveLeadingZero(card);
      choose(pendingPick(card.id, 'a1', 'charSetCard'), 'host');

      expect(current().players[owner].scene.find(character => character.uid === 'host')?.setCards)
        .toHaveLength(2);
      expect(read.char.ap(current(), 'host')).toBe(13000);
    },
  );
});

describe('official QA Wave159: B06064/P face-up set leave timing', () => {
  it.each(B06064_ROWS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner triggers when the set event itself or its host leaves',
    ({ card, owner }) => {
      for (const abilityId of ['remove-set', 'remove-host'] as const) {
        install(leaveState(card, owner), owner, `${card.id}-${owner}-${abilityId}`);
        expect(dispatchEngineAction({
          type: 'declaredAbility', uid: 'remover', abilId: abilityId,
        })).toEqual({ ok: true });
        const enter = pendingPick(card.id, 'a3', 'sceneEnter');
        expect(enter.candidates.map(candidate => candidate.cardId)).toEqual([ENTRY.id]);
        choose(enter, enter.candidates[0]!.uid);

        expect(current().players[owner].scene.find(character => character.cardId === ENTRY.id)?.state)
          .toBe('sleep');
        expect(current().players[owner].remove).toContain(card.id);
        expect(current().players[owner].remove).not.toContain(ENTRY.id);
      }
    },
  );
});

describe('official QA Wave159: exact physical set-event rows', () => {
  it('binds every Base/P printing covered by the shared matrix', () => {
    expect(EVENT_ROWS.map(card => card.id)).toEqual([
      'B06062', 'B06062P', 'B06063', 'B06063P', 'B06064', 'B06064P',
    ]);
  });
});
