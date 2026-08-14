// qa: card:B03029:83d447e04f250f995eb1040561f6f0f992b0be02cc6c13613c214b837568b222
// qa: card:B03029:f2e98bbb3d44e213bf33b029253bb3aecf1a2669c18736ed488d4ae55db630f0
// qa: card:B03029:1288047ffe1ab14ba80741f5243ea5a397b7ded2cc6609ae8a73033f82539ecf
// qa: card:B03029:4f49c6fb344ba2decc84dcd6321f502294c5c2b218e3c92a50f4785a675772b3
// qa: card:B03029:19b1f2b3db0e779b26cce4d1f006e3ced97e60aed23b360b552b64f202618e10

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { B02032 } from '@/cards/ct-p02/B02032';
import { B03028 } from '@/cards/ct-p03/B03028';
import { B03029 } from '@/cards/ct-p03/B03029';
import { B03041 } from '@/cards/ct-p03/B03041';
import { B03043 } from '@/cards/ct-p03/B03043';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA = {
  exactCost: 'card:B03029:83d447e04f250f995eb1040561f6f0f992b0be02cc6c13613c214b837568b222',
  chainedEvents: 'card:B03029:f2e98bbb3d44e213bf33b029253bb3aecf1a2669c18736ed488d4ae55db630f0',
  fileZero: 'card:B03029:1288047ffe1ab14ba80741f5243ea5a397b7ded2cc6609ae8a73033f82539ecf',
  conditionalEvent: 'card:B03029:4f49c6fb344ba2decc84dcd6321f502294c5c2b218e3c92a50f4785a675772b3',
  observerOptional: 'card:B03029:19b1f2b3db0e779b26cce4d1f006e3ced97e60aed23b360b552b64f202618e10',
} as const;

const COST_A = 'QA_B03029_COST_A';
const COST_B = 'QA_B03029_COST_B';
const RED_COST = 'QA_B03029_RED_COST';
const TARGET = 'QA_B03029_TARGET';
const FILLER = 'QA_B03029_FILLER';
const HATTORI = 'QA_B03029_HATTORI';

function eventCard(id: string, level = 5, colors = [...B03029.colors]): CardDef {
  return {
    id, no: id, kind: 'event', names: [id], colors, level,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function character(id: string, options: { names?: string[]; level?: number } = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: options.names ?? [id], colors: [...B03029.colors],
    level: options.level ?? 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const COST_A_DEF = eventCard(COST_A);
const COST_B_DEF = eventCard(COST_B);
const RED_COST_DEF = eventCard(RED_COST, 5, ['qa-red']);
const TARGET_DEF = character(TARGET);
const FILLER_DEF = eventCard(FILLER);
const HATTORI_DEF = character(HATTORI, { names: [...B03028.names] });

function baseState(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [...B03029.colors];
  state.players.self.scene = [makeChar({ uid: 'wakasa', cardId: B03029.id, state: 'active' })];
  return state;
}

function install(state: GameState): void {
  endMatchSession();
  beginMatchSession('self');
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function declareB03029(): ReturnType<typeof dispatchEngineAction> {
  return dispatchEngineAction({
    type: 'declaredAbility',
    uid: 'wakasa',
    abilId: 'a1',
    costParams: { removeAreaToDeckBottom: { ids: [COST_A, COST_B] } },
  });
}

function eventPick(cardId: string) {
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending?.atomVerb).toBe('useEventFromHand');
  const candidate = pending?.candidates.find((entry) => entry.cardId === cardId);
  expect(candidate, `event candidate ${cardId}`).toBeTruthy();
  return { pending: pending!, candidate: candidate! };
}

function useB03029Event(cardId: string): void {
  expect(declareB03029()).toEqual({ ok: true });
  const { pending, candidate } = eventPick(cardId);
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: candidate.uid,
  }))).toEqual({ ok: true });
}

beforeAll(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  [
    B02032, B03028, B03029, B03041, B03043,
    COST_A_DEF, COST_B_DEF, RED_COST_DEF, TARGET_DEF, FILLER_DEF, HATTORI_DEF,
  ].forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('B03029 official-QA public event use', () => {
  it(`${QA.exactCost}: rejects one matching remove card, then pays exactly two physical green event cards`, () => {
    const negative = baseState();
    negative.players.self.remove = [COST_A, RED_COST];
    install(negative);

    expect(declareB03029()).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current().players.self.scene[0]?.state).toBe('active');
    expect(current().players.self.remove).toEqual([COST_A, RED_COST]);
    expect(current().players.self.scene[0]?.declaredUseCount.a1).toBeUndefined();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();

    const positive = baseState();
    positive.players.self.remove = [COST_A, COST_B, RED_COST];
    positive.players.self.hand = [B03043.id];
    positive.players.self.deck = [FILLER, FILLER];
    install(positive);

    expect(declareB03029()).toEqual({ ok: true });
    expect(current().players.self.scene[0]?.state).toBe('sleep');
    expect(current().players.self.remove).toEqual([RED_COST]);
    expect(current().players.self.deck.slice(-2)).toEqual([COST_A, COST_B]);
    const { pending, candidate } = eventPick(B03043.id);
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: candidate.uid,
    }))).toEqual({ ok: true });
  });

  it(`${QA.chainedEvents}: B03043 draws two and B03041 sets one self character after effect-use`, () => {
    const drawState = baseState();
    drawState.players.self.remove = [COST_A, COST_B];
    drawState.players.self.hand = [B03043.id];
    drawState.players.self.deck = [FILLER, FILLER, TARGET];
    install(drawState);

    useB03029Event(B03043.id);
    expect(current().players.self.remove).toContain(B03043.id);
    expect(current().players.self.hand).toEqual([FILLER, FILLER]);

    const setState = baseState();
    setState.players.self.remove = [COST_A, COST_B];
    setState.players.self.hand = [B03041.id];
    install(setState);

    useB03029Event(B03041.id);
    const setPick = useGameStateStore.getState().pendingEffectPick;
    expect(setPick?.source).toMatchObject({ cardId: B03041.id, abilityId: 'a1' });
    const setCandidate = setPick?.candidates.find((entry) => entry.uid === 'wakasa');
    expect(setCandidate).toBeTruthy();
    expect(dispatchEngineAction(bindPendingDecision(setPick!, {
      type: 'effectPickResolve', pickedUid: setCandidate!.uid,
    }))).toEqual({ ok: true });
    expect(current().players.self.hand).not.toContain(B03041.id);
    expect(current().players.self.remove).not.toContain(B03041.id);
    expect(current().players.self.scene.find((card) => card.uid === 'wakasa')?.setCards).toEqual(expect.arrayContaining([
      expect.objectContaining({ cardId: B03041.id, faceUp: true }),
    ]));
  });

  it(`${QA.fileZero}: effect-use works with FILE 0 while ordinary handUseCard is rejected`, () => {
    const effectUse = baseState();
    effectUse.players.self.remove = [COST_A, COST_B];
    effectUse.players.self.hand = [B03043.id];
    effectUse.players.self.deck = [FILLER, FILLER];
    install(effectUse);

    useB03029Event(B03043.id);
    expect(current().players.self.file).toEqual([]);
    expect(current().players.self.hand).toEqual([FILLER, FILLER]);
    expect(current().players.self.remove).toContain(B03043.id);

    const ordinary = baseState();
    ordinary.players.self.hand = [B03043.id];
    ordinary.players.self.file = [];
    install(ordinary);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B03043.id }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(current().players.self.hand).toEqual([B03043.id]);
  });

  it(`${QA.conditionalEvent}: B02032 is absent while unmet, then becomes a B03029 candidate and sleeps every opponent character`, () => {
    const unmet = baseState();
    unmet.players.self.remove = [COST_A, COST_B];
    unmet.players.self.hand = [B02032.id, B03043.id];
    unmet.players.self.deck = [FILLER, FILLER];
    install(unmet);

    expect(declareB03029()).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick?.candidates.map((entry) => entry.cardId))
      .toEqual([B03043.id]);

    const met = baseState();
    met.players.self.remove = [COST_A, COST_B];
    met.players.self.hand = [B02032.id];
    met.players.self.case.status = '解決編';
    met.players.self.scene.push(makeChar({ uid: 'hattori', cardId: HATTORI }));
    met.players.opp.scene = [
      makeChar({ uid: 'opp-active', cardId: TARGET, state: 'active' }),
      makeChar({ uid: 'opp-sleep', cardId: TARGET, state: 'sleep' }),
    ];
    install(met);

    expect(declareB03029()).toEqual({ ok: true });
    const metPick = eventPick(B02032.id);
    const stale = structuredClone(current());
    stale.players.self.scene = stale.players.self.scene.filter((card) => card.uid !== 'hattori');
    expect(useGameStateStore.getState().setGameState(stale, { preserveRuntime: true })).toBe(true);
    expect(dispatchEngineAction(bindPendingDecision(metPick.pending, {
      type: 'effectPickResolve', pickedUid: metPick.candidate.uid,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current().players.self.hand).toContain(B02032.id);

    const live = baseState();
    live.players.self.remove = [COST_A, COST_B];
    live.players.self.hand = [B02032.id];
    live.players.self.case.status = met.players.self.case.status;
    live.players.self.scene.push(makeChar({ uid: 'hattori', cardId: HATTORI }));
    live.players.opp.scene = [
      makeChar({ uid: 'opp-active', cardId: TARGET, state: 'active' }),
      makeChar({ uid: 'opp-sleep', cardId: TARGET, state: 'sleep' }),
    ];
    install(live);

    useB03029Event(B02032.id);
    expect(current().players.self.remove).toContain(B02032.id);
    expect(current().players.opp.scene.map((card) => card.state)).toEqual(['sleep', 'sleep']);
  });

  it(`${QA.observerOptional}: B03028 observes via-effect event-use and both accepts and declines its optional chain`, () => {
    const accepted = baseState();
    accepted.players.self.remove = [COST_A, COST_B];
    accepted.players.self.hand = [B03043.id, FILLER];
    accepted.players.self.deck = [FILLER, FILLER];
    accepted.players.self.scene.push(makeChar({ uid: 'observer', cardId: B03028.id }));
    accepted.players.opp.scene = [makeChar({ uid: 'remove-target', cardId: TARGET, state: 'active' })];
    install(accepted);

    useB03029Event(B03043.id);
    expect(current().players.self.remove).toContain(B03043.id);
    expect(current().players.self.deck).toEqual([COST_A, COST_B]);
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(optional?.source).toMatchObject({ cardId: B03028.id, abilityId: 'a2' });
    expect(dispatchEngineAction(bindPendingDecision(optional!, { type: 'optionalResolve', run: true })))
      .toEqual({ ok: true });
    const discard = useGameStateStore.getState().pendingEffectPick;
    const discardCandidate = discard?.candidates.find((entry) => entry.cardId === FILLER);
    expect(discardCandidate).toBeTruthy();
    expect(dispatchEngineAction(bindPendingDecision(discard!, {
      type: 'effectPickResolve', pickedUid: discardCandidate!.uid,
    }))).toEqual({ ok: true });
    const remove = useGameStateStore.getState().pendingEffectPick;
    expect(remove?.atomVerb).toBe('sceneRemove');
    const removeCandidate = remove?.candidates.find((entry) => entry.uid === 'remove-target');
    expect(removeCandidate).toBeTruthy();
    expect(dispatchEngineAction(bindPendingDecision(remove!, {
      type: 'effectPickResolve', pickedUid: removeCandidate!.uid,
    }))).toEqual({ ok: true });
    expect(current().players.self.remove).toContain(FILLER);
    expect(current().players.opp.remove).toContain(TARGET);

    const declined = baseState();
    declined.players.self.remove = [COST_A, COST_B];
    declined.players.self.hand = [B03043.id, FILLER];
    declined.players.self.deck = [FILLER, FILLER];
    declined.players.self.scene.push(makeChar({ uid: 'observer', cardId: B03028.id }));
    declined.players.opp.scene = [makeChar({ uid: 'keep-target', cardId: TARGET, state: 'active' })];
    install(declined);

    useB03029Event(B03043.id);
    const declinedOptional = useGameStateStore.getState().pendingEffectOptional;
    expect(declinedOptional?.source).toMatchObject({ cardId: B03028.id, abilityId: 'a2' });
    expect(dispatchEngineAction(bindPendingDecision(declinedOptional!, { type: 'optionalResolve', run: false })))
      .toEqual({ ok: true });
    expect(current().players.self.hand).toContain(FILLER);
    expect(current().players.opp.scene.map((card) => card.uid)).toContain('keep-target');
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();

    const skippedEvent = baseState();
    skippedEvent.players.self.remove = [COST_A, COST_B];
    skippedEvent.players.self.hand = [B03043.id];
    skippedEvent.players.self.deck = [FILLER, FILLER];
    skippedEvent.players.self.scene.push(makeChar({ uid: 'observer', cardId: B03028.id }));
    install(skippedEvent);

    expect(declareB03029()).toEqual({ ok: true });
    const skippedPick = eventPick(B03043.id);
    expect(dispatchEngineAction(bindPendingDecision(skippedPick.pending, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    expect(current().players.self.hand).toContain(B03043.id);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });
});
