// qa: card:B10007:c93226a2bebd7c4a5a21e373534e75faba33cbe2ec6c147a0d4b0d4a745cec10
// qa: card:B10012:c93226a2bebd7c4a5a21e373534e75faba33cbe2ec6c147a0d4b0d4a745cec10
// qa: card:B10013:c93226a2bebd7c4a5a21e373534e75faba33cbe2ec6c147a0d4b0d4a745cec10

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B10007, B10007P } from '@/cards/ct-p10/B10007';
import { B10012, B10012P } from '@/cards/ct-p10/B10012';
import { B10013, B10013P } from '@/cards/ct-p10/B10013';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { projectReplayStateForViewer } from '@/ui/services/replayViewerProjection';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const SOURCES = [B10007, B10007P, B10012, B10012P, B10013, B10013P] as const;
const PARTNER_BLUE = fixture('W121_PARTNER_BLUE', { kind: 'partner', colors: ['青'], ap: undefined, lp: 5 });
const DESTINATION = fixture('W121_DESTINATION', { traits: ['サッカー選手'] });
const BLOCKED = fixture('W121_BLOCKED', { traits: ['サッカー選手'] });
const NON_SOCCER = fixture('W121_NON_SOCCER', { traits: ['探偵'] });
const OPP_SOCCER = fixture('W121_OPP_SOCCER', { traits: ['サッカー選手'] });
const SECRET = fixture('W121_SECRET', { kind: 'event' });
const TAIL = fixture('W121_TAIL');

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['青'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function hidden(instanceId: string) {
  return { cardId: SECRET.id, faceUp: false, instanceId };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave121 state');
  return state;
}

function base(source: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['青'];
  state.players[owner].partner = {
    cardId: PARTNER_BLUE.id, state: 'active', colors: ['青'], location: 'partner-area',
  } as GameState['players']['self']['partner'];
  state.players[owner].file = Array.from(
    { length: source.level ?? 0 },
    () => ({ type: 'card-back' as const, cardId: TAIL.id }),
  );
  return state;
}

function install(state: GameState, owner: Player): void {
  endMatchSession();
  beginMatchSession(owner);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function expectHiddenEverywhere(state: GameState): void {
  expect(JSON.stringify(state)).toContain(SECRET.id);
  for (const mode of ['solo-self', 'spectator'] as const) {
    expect(JSON.stringify(projectReplayStateForViewer(state, mode))).not.toContain(SECRET.id);
  }
}

function expectSettled(): void {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  expect(store.pendingEffectPick).toBeNull();
  expect(store.pendingSetCardChoice).toBeNull();
  expect(current().pendingRuntimeState).toBeUndefined();
}

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [PARTNER_BLUE, DESTINATION, BLOCKED, NON_SOCCER, OPP_SOCCER, SECRET, TAIL]) register(card);
  registerTriggeredListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave121: owner cannot inspect the face-down card set on entry', () => {
  // Card-bound physical rows: B10007/P B10012/P B10013/P.
  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner keeps the deck-top set identity hidden',
    ({ source, owner }) => {
      const state = base(source, owner);
      state.players[owner].hand = [source.id];
      state.players[owner].deck = [SECRET.id, TAIL.id];
      install(state, owner);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: source.id }))
        .toEqual({ ok: true });
      const entered = current().players[owner].scene.find(card => card.cardId === source.id)!;
      expect(entered.setCards).toHaveLength(1);
      expect(entered.setCards[0]).toMatchObject({ cardId: SECRET.id, faceUp: false });
      expect(current().players[owner].deck).toEqual([TAIL.id]);
      expectHiddenEverywhere(current());
      expectSettled();
    },
  );
});

describe('official QA Wave121: face-down set movement is occurrence-only', () => {
  // Card-bound physical rows: B10007/P B10012/P B10013/P.
  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner moves the selected opaque occurrence without revealing it',
    ({ source, owner }) => {
      const state = base(source, owner);
      state.players[owner].scene = [
        sceneChar(source.id, 'source', { setCards: [hidden('set:a'), hidden('set:b')] }),
        sceneChar(DESTINATION.id, 'destination'),
        sceneChar(BLOCKED.id, 'blocked', { setCards: [hidden('set:blocked')] }),
        sceneChar(NON_SOCCER.id, 'non-soccer'),
      ];
      state.players[other(owner)].scene = [sceneChar(OPP_SOCCER.id, 'opp-soccer')];
      install(state, owner);
      expectHiddenEverywhere(current());

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a2',
        abilityOrigin: 'printed', abilityIndex: 1,
      })).toEqual({ ok: true });
      const host = useGameStateStore.getState().pendingEffectPick;
      expect(host).toMatchObject({
        player: owner, ownerPlayer: owner, atomVerb: 'bindPick', nMin: 0, nMax: 1,
        source: { uid: 'source', cardId: source.id, abilityId: 'a2', abilityOrigin: 'printed', abilityIndex: 1 },
      });
      expect(host?.candidates.map(candidate => candidate.uid)).toEqual(['destination']);
      expect(dispatchEngineAction(bindPendingDecision(host!, {
        type: 'effectPickResolve', pickedUid: 'destination',
      }))).toEqual({ ok: true });

      surfacePendingSideChannels();
      const choice = useGameStateStore.getState().pendingSetCardChoice;
      expect(choice).toMatchObject({
        player: owner, hostUid: 'source', face: 'down',
        destination: { area: 'scene', hostUid: 'destination' },
        source: { uid: 'source', cardId: source.id, abilityId: 'a2' },
      });
      expect(choice?.entries).toEqual([
        { instanceId: 'set:a', ordinal: 1, hidden: true },
        { instanceId: 'set:b', ordinal: 2, hidden: true },
      ]);
      expect(JSON.stringify(choice)).not.toContain(SECRET.id);
      expect(dispatchEngineAction(bindPendingDecision(choice!, {
        type: 'setCardChoiceResolve', instanceId: 'set:b',
      }))).toEqual({ ok: true });

      expect(current().players[owner].scene.find(card => card.uid === 'source')?.state).toBe('sleep');
      expect(current().players[owner].scene.find(card => card.uid === 'source')?.setCards)
        .toEqual([hidden('set:a')]);
      expect(current().players[owner].scene.find(card => card.uid === 'destination')?.setCards)
        .toEqual([hidden('set:b')]);
      expect(current().players[owner].scene.find(card => card.uid === 'blocked')?.setCards)
        .toEqual([hidden('set:blocked')]);
      expect(current().players[other(owner)].scene.find(card => card.uid === 'opp-soccer')?.setCards)
        .toEqual([]);
      expectHiddenEverywhere(current());
      expectSettled();
    },
  );
});
