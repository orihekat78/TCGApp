// qa: card:B02058:762a82ad66fef61f8a12010f8d850cf7cca54916f71d63712f5f7227f290bd90
// qa: card:B02058:9ff7004a98391ecf3ed326a6439ca5d0981cd5a4822ea9e2677a4e4f87f3827b
// qa: card:B02058:a8bf8ce39b8a67e444cda3c78a26487df7e177215c5b63cf6e8daf83c0e15c8f
// qa: card:B02058:ff6d7da4ad97717ae37b4645860b39a777bb7f4a57c5a809108b2510919a56a4

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B02058 } from '@/cards/ct-p02/B02058';
import { B02058P } from '@/cards/ct-p02/B02058P';
import { B10022 } from '@/cards/ct-p10/B10022';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const OWNER_KEEP = 'W146_OWNER_KEEP';
const OPP_DISCARD = 'W146_OPP_DISCARD';
const FILE_CARD = 'W146_FILE_CARD';
const OKIYA = 'W146_OKIYA';
const DECOY = 'W146_DECOY';
const TAIL = 'W146_TAIL';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['赤'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const ROWS = [
  { label: 'base-self', owner: 'self' as const, card: B02058 },
  { label: 'parallel-opp', owner: 'opp' as const, card: B02058P },
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave146 state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  resetPresentationQueue(`qa-wave146-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function removeThroughDeclaredAbility(owner: Player, card: CardDef, deck: string[], label: string): void {
  const remover = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 46, player: remover, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[remover].scene = [sceneChar(B10022.id, 'remover')];
  state.players[owner].scene = [sceneChar(card.id, 'akai')];
  state.players[owner].deck = [...deck];
  install(state, remover, label);

  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' }))
    .toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toMatchObject({ player: remover, source: { cardId: B10022.id, abilityId: 'a1' } });
  expect(pick?.candidates.map(candidate => candidate.uid)).toContain('akai');
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: 'akai',
  }))).toEqual({ ok: true });
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  [
    fixture(OWNER_KEEP), fixture(OPP_DISCARD), fixture(FILE_CARD, { kind: 'event' }),
    fixture(OKIYA, { names: ['沖矢昴'] }), fixture(DECOY, { kind: 'event' }),
    fixture(TAIL, { kind: 'event' }),
  ].forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave146: B02058 hand-count timing', () => {
  it.each(ROWS)('$label excludes the entering card and fires when the post-use hands are equal', ({ owner, card, label }) => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 46, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['赤'];
    state.players[owner].file = Array.from({ length: 6 }, () => FILE_CARD);
    state.players[owner].hand = [card.id, OWNER_KEEP];
    state.players[opponent].hand = [OPP_DISCARD];
    install(state, owner, `${label}-hand-count`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
      .toEqual({ ok: true });
    expect(current().players[owner].hand).toEqual([OWNER_KEEP]);
    expect(current().players[owner].scene.some(character => character.cardId === card.id)).toBe(true);
    expect(current().players[opponent].hand).toEqual([]);
    expect(current().players[opponent].remove).toEqual([OPP_DISCARD]);
  });
});

describe('official QA Wave146: B02058 forced reveal-until', () => {
  it.each(ROWS)('$label must add the first matching card and grants no decline decision', ({ owner, card, label }) => {
    removeThroughDeclaredAbility(owner, card, [DECOY, OKIYA, TAIL], `${label}-forced-match`);

    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: owner, visibility: 'public', viewer: 'all', revealed: [DECOY, OKIYA], matched: OKIYA,
    });
    expect(current().players[owner].hand).toEqual([OKIYA]);
    expect([...current().players[owner].deck].sort()).toEqual([DECOY, TAIL].sort());
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(useGameStateStore.getState().pendingDeckReorder).toBeNull();
  });

  it.each(ROWS)('$label returns every revealed card and shuffles when no match exists', ({ owner, card, label }) => {
    removeThroughDeclaredAbility(owner, card, [DECOY, TAIL], `${label}-no-match`);

    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: owner, visibility: 'public', viewer: 'all', revealed: [DECOY, TAIL], matched: null,
    });
    expect(current().players[owner].hand).toEqual([]);
    expect([...current().players[owner].deck].sort()).toEqual([DECOY, TAIL].sort());
    expect(current().log.some(entry => entry.action === 'effect:deckShuffle')).toBe(true);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(useGameStateStore.getState().pendingDeckReorder).toBeNull();
  });
});
