// qa: card:B09003:47be099f12105fcb17bdc68f8bf3ebbe2d1d1100aa005a41d302a5df45f74ab5
// qa: card:B09010:0ae3329b249fa56d9f5b74d8cc5763d116f5816852e8f6c82c9f8b3f7ef24ac4
// qa: card:B09033:0ae3329b249fa56d9f5b74d8cc5763d116f5816852e8f6c82c9f8b3f7ef24ac4
// qa: card:B09108:a67bd33bd2453d8145bfa1b91131258a1a4996ce6a60a759955d89f39857c140
// qa: card:B09111:47be099f12105fcb17bdc68f8bf3ebbe2d1d1100aa005a41d302a5df45f74ab5

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09003 } from '@/cards/ct-p09/B09003';
import { B09003P } from '@/cards/ct-p09/B09003P';
import { B09010 } from '@/cards/ct-p09/B09010';
import { B09010P } from '@/cards/ct-p09/B09010P';
import { B09033 } from '@/cards/ct-p09/B09033';
import { B09033P } from '@/cards/ct-p09/B09033P';
import { B09108 } from '@/cards/ct-p09/B09108';
import { B09108P } from '@/cards/ct-p09/B09108P';
import { B09111 } from '@/cards/ct-p09/B09111';
import { B09111P } from '@/cards/ct-p09/B09111P';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const PARTNER = 'D08001';
const HATTORI = 'W89-HATTORI';
const NONMATCH_ID = 'W89-REGISTERED-NONMATCH';
const NONMATCH = '波八十九登録非一致事件';
const HATTORI_DEF: CardDef = {
  id: HATTORI, no: HATTORI, kind: 'character', names: ['服部平次'], colors: ['緑'],
  level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const NONMATCH_DEF: CardDef = {
  id: NONMATCH_ID, no: NONMATCH_ID, kind: 'event', names: [NONMATCH], colors: ['青'],
  traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

function fileCards(prefix: string, count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    type: 'card-back' as const,
    cardId: `${prefix}-${index}`,
  }));
}

function install(state: GameState, label: string, human: Player = 'self'): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  resetPresentationQueue(`qa-wave89-remove-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave89 remove state');
  return state;
}

function assistSelf(partnerCardId = PARTNER): void {
  expect(dispatchEngineAction({ type: 'assist', player: 'self' })).toEqual({ ok: true });
  expect(current().players.self.partner.location).toBe('file-area');
}

function assistOpponentAndPass(): void {
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = 'opp';
  expect(dispatchEngineAction({ type: 'assist', player: 'opp' })).toEqual({ ok: true });
  expect(current().players.opp.partner.location).toBe('file-area');
  expect(dispatchEngineAction({ type: 'endTurn', player: 'opp' })).toEqual({ ok: true });
  expect(current().turn).toMatchObject({ player: 'self', phase: 'main' });
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = 'self';
}

function declineRepeatOptional(): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectRepeatOptional;
  expect(pending).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'repeatOptionalResolve', run: false,
  }))).toEqual({ ok: true });
}

function acceptRepeatOptional(): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectRepeatOptional;
  expect(pending).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'repeatOptionalResolve', run: true,
  }))).toEqual({ ok: true });
}

function opponentBase(card: CardDef): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 3, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.opp.partner = { cardId: PARTNER, state: 'active', location: 'partner-area' };
  state.players.opp.file = fileCards(`${card.id}-OPP`, 1);
  state.players.opp.deck = [`${card.id}-OPP-DRAW`, `${card.id}-OPP-SPARE`];
  state.players.self.deck = ['B01001', 'B01002', 'B01003', 'B01004', 'B01005'];
  return state;
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetPendingRuntimeState();
  registerAll();
  register(HATTORI_DEF);
  register(NONMATCH_DEF);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('Wave89 public FILE remove movement skips the assisted partner', () => {
  it.each([B09003, B09003P])('$id removes only the opponent ordinary top card through its full named chain', card => {
    const state = opponentBase(card);
    state.players.self.scene = [
      makeChar({ cardId: card.id, uid: 'source' }),
      makeChar({ cardId: HATTORI, uid: 'hattori' }),
    ];
    install(state, card.id, 'opp');
    assistOpponentAndPass();
    const selfFileBefore = structuredClone(current().players.self.file);
    const selfRemoveBefore = [...current().players.self.remove];

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a3', costParams: { declaredName: NONMATCH },
    })).toEqual({ ok: true });

    // Card-bound opponent matrix: B09003 B09003P.
    expect(current().players.opp.remove).toContain(`${card.id}-OPP-0`);
    expect(current().players.opp.remove).not.toContain(PARTNER);
    expect(current().players.opp.file.filter(entry => entry.type === 'assisted-partner')).toHaveLength(1);
    expect(current().players.opp.partner.location).toBe('file-area');
    expect(current().players.self.file).toEqual(selfFileBefore);
    expect(current().players.self.remove.slice(0, selfRemoveBefore.length)).toEqual(selfRemoveBefore);
  });

  it.each([B09010, B09010P])('$id FILE6 declaration removes one ordinary card and preserves the partner', card => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partner = { cardId: PARTNER, state: 'active', location: 'partner-area' };
    state.players.self.file = fileCards(card.id, 5);
    state.players.self.scene = [makeChar({ cardId: card.id, uid: 'source' })];
    state.players.self.deck = ['B01001', 'B01002', 'B01003'];
    install(state, card.id);
    assistSelf();

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1' })).toEqual({ ok: true });

    // Card-bound self matrix: B09010 B09010P.
    expect(current().players.self.remove).toContain(`${card.id}-4`);
    expect(current().players.self.remove).not.toContain(PARTNER);
    expect(current().players.self.file.filter(entry => entry.type === 'assisted-partner')).toHaveLength(1);
    expect(current().players.self.partner.location).toBe('file-area');
  });

  it.each([B09033, B09033P])('$id repeat removes an ordinary FILE card while the partner stays', card => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partner = { cardId: PARTNER, state: 'active', location: 'partner-area' };
    state.players.self.file = fileCards(card.id, 5);
    state.players.self.case = { cardId: 'D02020', status: '解決編', requiredEvidence: 7, colors: [...card.colors], declaredUseCount: {} };
    state.players.self.hand = [card.id];
    state.players.self.deck = ['B01001'];
    install(state, card.id);
    assistSelf();
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: card.id })).toEqual({ ok: true });
    acceptRepeatOptional();
    declineRepeatOptional();

    // Card-bound repeat matrix: B09033 B09033P.
    expect(current().players.self.remove).toContain(`${card.id}-4`);
    expect(current().players.self.remove).not.toContain(PARTNER);
    expect(current().players.self.file.filter(entry => entry.type === 'assisted-partner')).toHaveLength(1);
    expect(current().players.self.partner.location).toBe('file-area');
  });

  it.each([B09108, B09108P])('$id partner-area named chain removes only the opponent ordinary top card', card => {
    const state = opponentBase(card);
    state.players.self.partnerAreaMR = makeChar({ cardId: card.id, uid: 'partnerMR:self' });
    install(state, card.id, 'opp');
    assistOpponentAndPass();

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'partnerMR:self', abilId: 'a2', costParams: { declaredName: NONMATCH },
    })).toEqual({ ok: true });

    // Card-bound MR opponent matrix: B09108 B09108P.
    expect(current().players.opp.remove).toContain(`${card.id}-OPP-0`);
    expect(current().players.opp.remove).not.toContain(PARTNER);
    expect(current().players.opp.file.filter(entry => entry.type === 'assisted-partner')).toHaveLength(1);
    expect(current().players.opp.partner.location).toBe('file-area');
  });

  it.each([B09111, B09111P])('$id case declaration removes only the opponent ordinary top card', card => {
    const state = opponentBase(card);
    state.players.self.case = { cardId: card.id, status: '解決編', requiredEvidence: 7, colors: [...card.colors], declaredUseCount: {} };
    state.players.self.evidence = [0, 1].map(index => ({
      cardId: `EVIDENCE-${index}`, faceUp: false, origin: { turn: 2, via: 'reasoning' as const },
    }));
    install(state, card.id, 'opp');
    assistOpponentAndPass();

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'case:self', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { flipFaceUpEvidence: { indices: [0, 1] }, declaredName: NONMATCH },
    })).toEqual({ ok: true });

    // Card-bound case opponent matrix: B09111 B09111P.
    expect(current().players.opp.remove).toContain(`${card.id}-OPP-0`);
    expect(current().players.opp.remove).not.toContain(PARTNER);
    expect(current().players.opp.file.filter(entry => entry.type === 'assisted-partner')).toHaveLength(1);
    expect(current().players.opp.partner.location).toBe('file-area');
  });
});
