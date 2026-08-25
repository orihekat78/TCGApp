// qa: card:B06046:3b1c6f4fbf55d8cf875921b50de0edf27064d4cef8ac4818301b6914eb9cdfe3
// qa: card:B06046:5534de89249911443b0012e8a8e1fe582fab0090c15412548606caea407dc692
// qa: card:B06046:92820adcff61c21677677248266bade95aa601ce524bdbc25f6ea32ffb62df6a
// qa: card:B06046:f9d1417c8f5a343e91bc8bba86546d3cc00fcdc381039252aacb01e96476d6f3

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B06046 } from '@/cards/ct-p06/B06046';
import { B06046P } from '@/cards/ct-p06/B06046P';
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

const setSelf: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: {
    hook: 'effect:declared', selfOnly: true,
    matcher: payload => (payload as { kind?: unknown })?.kind === 'event-use',
  },
  effect: {
    kind: 'atom', verb: 'charSetCard',
    args: {
      player: 'self', fromSelf: true, n: 1,
      filter: { cardId: [B06046.id, B06046P.id], kind: 'character' },
    },
  },
  description: 'This YAIBA event sets itself on the selected Iron Blade.',
  ruleRefs: ['rules/16-card-set.md'],
};

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const SETTER = fixture('W154_YAIBA_SETTER', { kind: 'event', traits: ['YAIBA'], abilities: [setSelf] });
const ENTRY = fixture('W154_YAIBA_ENTRY', {
  level: 5, traits: ['YAIBA'], abilities: [{
    id: 'enter-draw', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'enter', selfOnly: true },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: 'Entry sentinel.', ruleRefs: ['rules/17-icons.md'],
  }],
});
const DISCARD = fixture('W154_DISCARD', { kind: 'event' });
const FILLER = fixture('W154_FILLER');
const FILE_CARD = fixture('W154_FILE', { kind: 'event' });
const DRAW = fixture('W154_DRAW', { kind: 'event' });
const SOURCES = [B06046, B06046P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave154 state');
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  resetPresentationQueue(`qa-wave154-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(cardId: string, abilityId: string, verb: string): PendingPick {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(pending: PendingPick, uid: string | null, switchRemoveUid?: string): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: uid,
    ...(switchRemoveUid ? { switchRemoveUid } : {}),
  }))).toEqual({ ok: true });
}

function resolveOptional(sourceId: string): void {
  surfacePendingSideChannels();
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional).toMatchObject({ source: { cardId: sourceId, abilityId: 'a2' } });
  expect(dispatchEngineAction(bindPendingDecision(optional!, {
    type: 'optionalResolve', run: true,
  }))).toEqual({ ok: true });
}

function setCards() {
  return [0, 1].map(index => ({
    cardId: SETTER.id, faceUp: true, instanceId: `w154-set-${index}`,
  }));
}

function endTurnBoard(source: CardDef, owner: Player, full: boolean): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 154, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['白'];
  state.players[owner].scene = [
    sceneChar(source.id, 'source', { setCards: setCards() }),
    ...Array.from({ length: full ? 4 : 0 }, (_value, index) => sceneChar(FILLER.id, `filler-${index}`)),
  ];
  state.players[owner].deck = [DRAW.id, DRAW.id, DRAW.id];
  state.players[other(owner)].deck = [DRAW.id, DRAW.id, DRAW.id];
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
  for (const card of [SETTER, ENTRY, DISCARD, FILLER, FILE_CARD, DRAW]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave154: B06046 mandatory set-card reactivation', () => {
  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner=$owner fires while active, offers no decline, and spends Turn2',
    ({ source, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 154, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case.colors = ['白'];
      state.players[owner].file = Array.from({ length: 6 }, () => ({
        type: 'card-back' as const, cardId: FILE_CARD.id,
      }));
      state.players[owner].hand = [SETTER.id, SETTER.id, SETTER.id];
      state.players[owner].scene = [sceneChar(source.id, 'source', { state: 'sleep' })];
      state.players[owner].deck = [DRAW.id, DRAW.id, DRAW.id];
      state.players[other(owner)].deck = [DRAW.id, DRAW.id, DRAW.id];
      install(state, owner, `${source.id}-${owner}-turn2`);

      for (const expectedUseCount of [1, 2, 2]) {
        expect(dispatchEngineAction({ type: 'nextHint', player: owner, optionalCardId: SETTER.id }))
          .toEqual({ ok: true });
        const set = pendingPick(SETTER.id, 'a1', 'charSetCard');
        expect(set.candidates.map(candidate => candidate.uid)).toEqual(['source']);
        choose(set, 'source');
        surfacePendingSideChannels();
        expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
        expect(current().players[owner].scene[0]?.state).toBe('active');
        expect(read.char.declaredUseCount(current(), 'source', 'a1', {
          abilityOrigin: 'printed', abilityIndex: 0,
        })).toBe(expectedUseCount);
      }
      expect(current().players[owner].scene[0]?.setCards).toHaveLength(3);
    },
  );
});

describe('official QA Wave154: B06046 end-turn re-entry', () => {
  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner=$owner may re-enter the exact YAIBA character paid from hand',
    ({ source, owner }) => {
      const state = endTurnBoard(source, owner, false);
      state.players[owner].hand = [ENTRY.id];
      install(state, owner, `${source.id}-${owner}-hand-paid`);

      expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
      resolveOptional(source.id);
      const discard = pendingPick(source.id, 'a2', 'discard');
      const handCard = discard.candidates.find(candidate => candidate.cardId === ENTRY.id);
      expect(handCard).toMatchObject({ player: owner, area: 'hand' });
      choose(discard, handCard!.uid);

      const enter = pendingPick(source.id, 'a2', 'sceneEnter');
      const paidCard = enter.candidates.find(candidate => candidate.cardId === ENTRY.id);
      expect(paidCard).toMatchObject({ player: owner, area: 'remove' });
      choose(enter, paidCard!.uid);

      expect(current().players[owner].scene.find(character => character.cardId === ENTRY.id)?.state)
        .toBe('sleep');
      expect(current().players[owner].remove).not.toContain(ENTRY.id);
    },
  );

  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner=$owner may switch out its own source from a full scene',
    ({ source, owner }) => {
      const state = endTurnBoard(source, owner, true);
      state.players[owner].hand = [DISCARD.id];
      state.players[owner].remove = [ENTRY.id];
      install(state, owner, `${source.id}-${owner}-source-switch`);

      expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
      resolveOptional(source.id);
      const discard = pendingPick(source.id, 'a2', 'discard');
      choose(discard, discard.candidates.find(candidate => candidate.cardId === DISCARD.id)!.uid);
      const enter = pendingPick(source.id, 'a2', 'sceneEnter');
      const entrant = enter.candidates.find(candidate => candidate.cardId === ENTRY.id)!;
      choose(enter, entrant.uid, 'source');

      const ownerState = current().players[owner];
      expect(ownerState.scene).toHaveLength(5);
      expect(ownerState.scene.some(character => character.uid === 'source')).toBe(false);
      expect(ownerState.scene.find(character => character.cardId === ENTRY.id)?.state).toBe('sleep');
      expect(ownerState.remove).toEqual(expect.arrayContaining([source.id, SETTER.id, SETTER.id, DISCARD.id]));
      expect(ownerState.hand).toContain(DRAW.id);
    },
  );
});
