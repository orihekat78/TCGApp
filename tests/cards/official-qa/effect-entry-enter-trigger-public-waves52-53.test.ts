// qa: card:B06047:a995d1c10d720a31ed82e873a38fc303c498ee2145d91386e258841a02350580
// qa: card:B08083:a96985ed96d005b04cd0c44c2dadf206fac63c8bd49e8c42cef6ea4c73808dae
// qa: card:B09007:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// Rules: 15, 16, 17, 20, 21, 25. Effect-entered characters resolve their
// normal enter abilities after the source operation completes.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B06047 } from '@/cards/ct-p06/B06047';
import { B08083 } from '@/cards/ct-p08/B08083';
import { B09007 } from '@/cards/ct-p09/B09007';
import { B09007P } from '@/cards/ct-p09/B09007P';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const DRAW = 'W52-ENTER-DRAW';
const FILLER = 'W52-FILLER';
const SET_EVENT = 'W52-YAIBA-SET-EVENT';
const YAIBA_ENTRY = 'W52-YAIBA-ENTRY';
const YAIBA_HIGH = 'W52-YAIBA-HIGH';
const YAIBA_WRONG = 'W52-YAIBA-WRONG';
const LEAVE_ENTRY = 'W52-LEAVE-ENTRY';
const LEAVE_INACTIVE = 'W52-LEAVE-INACTIVE';
const LEAVE_HIGH = 'W52-LEAVE-HIGH';
const LEAVE_WRONG = 'W52-LEAVE-WRONG';
const RUM_ENTRY = 'W52-RUM-ENTRY';
const RUM_HIGH = 'W52-RUM-HIGH';
const RUM_WRONG = 'W52-RUM-WRONG';
const BLACK_PARTNER = 'W52-BLACK-PARTNER';

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['白'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...options,
  };
}

const enterDraw: AbilityDef = {
  id: 'enter-draw', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '登場時に1枚引く。', ruleRefs: [],
};

const leaveMarker: AbilityDef = {
  id: 'leave-marker', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  effect: { kind: 'atom', verb: 'noop', args: {} },
  description: '現場リムーブ時マーカー。', ruleRefs: [],
};

const inactiveLeaveMarker: AbilityDef = {
  ...leaveMarker,
  id: 'leave-marker-inactive',
  condition: { kind: 'turn', player: 'opp' },
};

const fixtures: readonly CardDef[] = [
  fixture(DRAW), fixture(FILLER),
  fixture(BLACK_PARTNER, { kind: 'partner', colors: ['黒'], ap: undefined, lp: undefined }),
  fixture(SET_EVENT, {
    kind: 'event', colors: ['白'], level: 1, ap: undefined, lp: undefined,
    traits: ['YAIBA'],
    abilities: [{
      id: 'set', type: 'triggered', scope: 'on-hand',
      trigger: {
        hook: 'effect:declared', selfOnly: true,
        matcher: payload => (payload as { kind?: unknown })?.kind === 'event-use',
      },
      effect: {
        kind: 'atom', verb: 'charSetCard',
        args: { player: 'self', fromSelf: true, n: 1, filter: { kind: 'character', cardName: '鉄刃' } },
      },
      description: '自身を鉄刃へセットする。', ruleRefs: [],
    }],
  }),
  fixture(YAIBA_ENTRY, { traits: ['YAIBA'], level: 5, abilities: [enterDraw] }),
  fixture(YAIBA_HIGH, { traits: ['YAIBA'], level: 6, abilities: [enterDraw] }),
  fixture(YAIBA_WRONG, { level: 5, abilities: [enterDraw] }),
  fixture(LEAVE_ENTRY, { level: 5, abilities: [leaveMarker, enterDraw] }),
  fixture(LEAVE_INACTIVE, { level: 5, abilities: [inactiveLeaveMarker, enterDraw] }),
  fixture(LEAVE_HIGH, { level: 6, abilities: [leaveMarker, enterDraw] }),
  fixture(LEAVE_WRONG, { level: 5, abilities: [enterDraw] }),
  fixture(RUM_ENTRY, { names: ['ラム'], level: 8, abilities: [enterDraw] }),
  fixture(RUM_HIGH, { names: ['ラム'], level: 9, abilities: [enterDraw] }),
  fixture(RUM_WRONG, { names: ['脇田兼則'], level: 8, abilities: [enterDraw] }),
];

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['白', '青', '黒'];
  state.players.self.case.status = '解決編';
  state.players.self.partner.cardId = BLACK_PARTNER;
  state.players.self.file = Array.from(
    { length: 10 }, () => ({ type: 'card-back' as const, cardId: FILLER }),
  );
  state.players.self.deck = [DRAW, FILLER, FILLER];
  state.players.opp.deck = [FILLER, FILLER];
  return state;
}

function install(state: GameState, label: string): void {
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(`qa-w52-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave52 state');
  return state;
}

function pendingPick(sourceCardId: string, abilityId: string, atomVerb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${sourceCardId}: ${atomVerb} public authority`).toMatchObject({
    player: 'self', atomVerb, source: { cardId: sourceCardId, abilityId },
  });
  return pending!;
}

function resolveOnlyCandidate(sourceCardId: string, abilityId: string, targetCardId: string): void {
  const pending = pendingPick(sourceCardId, abilityId, 'sceneEnter');
  expect(pending.candidates.map(candidate => candidate.cardId), `${sourceCardId}: typed entry candidate`)
    .toEqual([targetCardId]);
  const selected = pending.candidates[0]!;
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: selected.uid,
  }))).toEqual({ ok: true });
}

function expectNormalEnter(cardId: string, state: 'active' | 'sleep'): void {
  const game = current();
  expect(game.players.self.scene.find(card => card.cardId === cardId)?.state, `${cardId}: entered state`)
    .toBe(state);
  expect(game.pendingEffects
    .filter(entry => entry.source.cardId === cardId && entry.source.abilityId === enterDraw.id)
    .map(entry => entry.state), `${cardId}: normal enter ability resolved`)
    .toEqual(['resolved']);
  expect(game.players.self.hand.filter(id => id === DRAW), `${cardId}: enter draw`).toHaveLength(1);
  const actions = game.log.map(entry => entry.action);
  expect(actions.lastIndexOf('effect:draw'), `${cardId}: enter effect follows scene entry`)
    .toBeGreaterThan(actions.lastIndexOf('effect:sceneEnter'));
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null });
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('Wave52 missing effect-entry sources', () => {
  it('B06047 set-card trigger enters one YAIBA and fires its normal enter ability', () => {
    const state = base();
    state.players.self.scene = [sceneChar(B06047.id, 'yaiba')];
    state.players.self.hand = [SET_EVENT];
    state.players.self.remove = [YAIBA_ENTRY, YAIBA_HIGH, YAIBA_WRONG];
    install(state, 'B06047');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: SET_EVENT }))
      .toEqual({ ok: true });
    const setPick = pendingPick(SET_EVENT, 'set', 'charSetCard');
    expect(setPick.candidates.map(candidate => candidate.uid)).toEqual(['yaiba']);
    expect(dispatchEngineAction(bindPendingDecision(setPick, {
      type: 'effectPickResolve', pickedUid: 'yaiba',
    }))).toEqual({ ok: true });

    resolveOnlyCandidate(B06047.id, 'a2', YAIBA_ENTRY);
    expect(current().players.self.scene.find(card => card.uid === 'yaiba')?.setCards)
      .toEqual([expect.objectContaining({ cardId: SET_EVENT })]);
    expectNormalEnter(YAIBA_ENTRY, 'sleep');
    expect(current().pendingEffects
      .filter(entry => entry.source.cardId === YAIBA_ENTRY && entry.source.abilityId === enterDraw.id)
      .map(entry => entry.state), 'B06047: effect-entered YAIBA resolves normal enter').toEqual(['resolved']);
  });

  it('B08083 declared ability enters only an eligible leave-trigger character and fires enter', () => {
    const state = base();
    state.players.self.scene = [sceneChar(B08083.id, 'rum')];
    state.players.self.hand = [LEAVE_ENTRY, LEAVE_HIGH, LEAVE_WRONG];
    install(state, 'B08083');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'rum', abilId: 'a2' }))
      .toEqual({ ok: true });
    expect(current().players.self.scene.find(card => card.uid === 'rum')?.state).toBe('sleep');
    resolveOnlyCandidate(B08083.id, 'a2', LEAVE_ENTRY);
    expectNormalEnter(LEAVE_ENTRY, 'active');
    expect(current().pendingEffects
      .filter(entry => entry.source.cardId === LEAVE_ENTRY && entry.source.abilityId === enterDraw.id)
      .map(entry => entry.state), 'B08083: declared entry resolves normal enter').toEqual(['resolved']);
  });

  it('B08083 sees a printed but currently inactive leave trigger and switches its own full-scene source', () => {
    const state = base();
    state.players.self.scene = [
      sceneChar(B08083.id, 'rum'),
      ...Array.from({ length: 4 }, (_, index) => sceneChar(FILLER, `full-${index}`)),
    ];
    state.players.self.hand = [LEAVE_INACTIVE, LEAVE_HIGH, LEAVE_WRONG];
    install(state, 'B08083-inactive-keyword-switch');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'rum', abilId: 'a2' }))
      .toEqual({ ok: true });
    const pending = pendingPick(B08083.id, 'a2', 'sceneEnter');
    expect(pending.candidates.map(candidate => candidate.cardId), 'printed hook is static eligibility')
      .toEqual([LEAVE_INACTIVE]);
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: pending.candidates[0]!.uid, switchRemoveUid: 'rum',
    }))).toEqual({ ok: true });

    expect(current().players.self.scene).toHaveLength(5);
    expect(current().players.self.scene.some(card => card.uid === 'rum')).toBe(false);
    expect(current().players.self.remove).toContain(B08083.id);
    expectNormalEnter(LEAVE_INACTIVE, 'active');
  });

  it('B08083 rejects the wrong case color without sleeping or consuming its declared use', () => {
    const state = base();
    state.players.self.case.colors = ['青'];
    state.players.self.scene = [sceneChar(B08083.id, 'rum')];
    state.players.self.hand = [LEAVE_ENTRY];
    install(state, 'B08083-wrong-color');
    const before = current();
    const beforeJson = JSON.stringify(before);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'rum', abilId: 'a2' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(JSON.stringify(current())).toBe(beforeJson);
    expect(current().players.self.scene[0]?.state).toBe('active');
    expect(readChar.declaredUseCount(current(), 'rum', 'a2')).toBe(0);
    const store = useGameStateStore.getState();
    expect([store.pendingEffectPick, store.pendingEffectOptional, store.pendingEffectChoice])
      .toEqual([null, null, null]);
  });

  it('B08083 rejects a forged entry occurrence without changing the paid pending boundary', () => {
    const state = base();
    state.players.self.scene = [sceneChar(B08083.id, 'rum')];
    state.players.self.hand = [LEAVE_ENTRY];
    install(state, 'B08083-forged-entry');
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'rum', abilId: 'a2' }))
      .toEqual({ ok: true });
    const pending = pendingPick(B08083.id, 'a2', 'sceneEnter');
    const before = current();
    const beforeJson = JSON.stringify(before);

    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: 'forged-entry-occurrence',
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(JSON.stringify(current())).toBe(beforeJson);
    expect(useGameStateStore.getState().pendingEffectPick).toBe(pending);

    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: pending.candidates[0]!.uid,
    }))).toEqual({ ok: true });
    expectNormalEnter(LEAVE_ENTRY, 'active');
  });

  it('B08083 resolves zero eligible candidates after paying its valid declared cost', () => {
    const state = base();
    state.players.self.scene = [sceneChar(B08083.id, 'rum')];
    state.players.self.hand = [LEAVE_HIGH, LEAVE_WRONG];
    install(state, 'B08083-zero-candidate');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'rum', abilId: 'a2' }))
      .toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(current().players.self.scene[0]?.state).toBe('sleep');
    expect(readChar.declaredUseCount(current(), 'rum', 'a2')).toBe(1);
    expect(current().players.self.hand).toEqual([LEAVE_HIGH, LEAVE_WRONG]);
    expect(current().players.self.hand).not.toContain(DRAW);
    const emptyPick = pendingPick(B08083.id, 'a2', 'sceneEnter');
    expect(emptyPick.candidates).toEqual([]);
    expect(dispatchEngineAction(bindPendingDecision(emptyPick, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    const store = useGameStateStore.getState();
    expect([store.pendingEffectPick, store.pendingEffectOptional, store.pendingEffectChoice])
      .toEqual([null, null, null]);
  });

  it('B09007/P entry accepts its optional self-removal, enters Rum, and fires Rum enter', () => {
    expect(B09007P.abilities).toEqual(B09007.abilities);
    const state = base();
    state.players.self.hand = [B09007.id, RUM_ENTRY, RUM_HIGH, RUM_WRONG];
    install(state, 'B09007');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B09007.id }))
      .toEqual({ ok: true });
    surfacePendingSideChannels();
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(optional?.source).toMatchObject({ cardId: B09007.id, abilityId: 'a1' });
    expect(dispatchEngineAction(bindPendingDecision(optional!, {
      type: 'optionalResolve', run: true,
    }))).toEqual({ ok: true });

    expect(current().players.self.remove).toContain(B09007.id);
    resolveOnlyCandidate(B09007.id, 'a1', RUM_ENTRY);
    expectNormalEnter(RUM_ENTRY, 'active');
    expect(current().pendingEffects
      .filter(entry => entry.source.cardId === RUM_ENTRY && entry.source.abilityId === enterDraw.id)
      .map(entry => entry.state), 'B09007: effect-entered Rum resolves normal enter').toEqual(['resolved']);
  });

  it('B09007P preserves the old a2 index and a declined a1 leaves the source in scene', () => {
    expect(B09007.abilities.map(ability => ability.id)).toEqual(['a2', 'a1']);
    expect(B09007P.abilities.map(ability => ability.id)).toEqual(['a2', 'a1']);
    const state = base();
    state.players.self.hand = [B09007P.id, RUM_ENTRY];
    install(state, 'B09007P-decline');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B09007P.id }))
      .toEqual({ ok: true });
    surfacePendingSideChannels();
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(optional?.source).toMatchObject({ cardId: B09007P.id, abilityId: 'a1' });
    expect(dispatchEngineAction(bindPendingDecision(optional!, {
      type: 'optionalResolve', run: false,
    }))).toEqual({ ok: true });

    expect(current().players.self.scene.some(card => card.cardId === B09007P.id)).toBe(true);
    expect(current().players.self.remove).not.toContain(B09007P.id);
    expect(current().players.self.hand).toContain(RUM_ENTRY);
    expect(current().players.self.hand).not.toContain(DRAW);
    const store = useGameStateStore.getState();
    expect([store.pendingEffectPick, store.pendingEffectOptional, store.pendingEffectChoice])
      .toEqual([null, null, null]);
    expect(current().pendingEffects.every(entry => entry.state === 'resolved')).toBe(true);
  });
});
