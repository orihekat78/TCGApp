// qa: card:B07058:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B07090:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B08029:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B08092:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:D11019:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// Rules: 15-abilities-effects.md, 17-icons.md, 25-qa-effects-resolution.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B02019 } from '@/cards/ct-p02/B02019';
import { D05004 } from '@/cards/ct-d05/D05004';
import { B07048 } from '@/cards/ct-p07/B07048';
import { B07058 } from '@/cards/ct-p07/B07058';
import { B07090 } from '@/cards/ct-p07/B07090';
import { B08016 } from '@/cards/ct-p08/B08016';
import { B08029 } from '@/cards/ct-p08/B08029';
import { B08092 } from '@/cards/ct-p08/B08092';
import { D09022 } from '@/cards/ct-d09/D09022';
import { D11019 } from '@/cards/ct-d11/D11019';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA = 'd8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa';
const RED_MAGIC_CASE = 'B07062';
const MOMIJI = 'QA-ENTRY-MOMIJI';
const SHERRY = 'QA-ENTRY-SHERRY';
const REMOVE_TARGET = 'QA-ENTRY-REMOVE-TARGET';
const POLICE = 'QA-ENTRY-POLICE';
const GREEN_PARTNER = 'QA-ENTRY-GREEN-PARTNER';
const GREEN_EVENT = 'QA-ENTRY-GREEN-EVENT';
const BLUE_MATCH = 'QA-ENTRY-BLUE-MATCH';
const SET_ONE = 'QA-ENTRY-SET-ONE';
const SET_TWO = 'QA-ENTRY-SET-TWO';
const SOURCE_DRAW = 'QA-ENTRY-SOURCE-DRAW';
const DISCARD = 'QA-ENTRY-DISCARD';
const NONMATCH = 'QA-ENTRY-NONMATCH';
const TAIL = 'QA-ENTRY-TAIL';
const OPP_HAND = 'QA-ENTRY-OPP-HAND';

function character(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黄'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  };
}

const fixtures: CardDef[] = [
  character(MOMIJI, { names: ['大岡紅葉'], level: 7 }),
  character(SHERRY, { names: ['シェリー'] }),
  character(REMOVE_TARGET, { level: 7 }),
  character(POLICE, { traits: ['警視庁'], ap: 2000 }),
  character(BLUE_MATCH, { colors: ['青'] }),
  character(SET_ONE),
  character(SET_TWO),
  character(SOURCE_DRAW),
  character(DISCARD),
  character(TAIL),
  character(OPP_HAND),
  { ...character(GREEN_EVENT, { colors: ['緑'] }), kind: 'event', ap: undefined, lp: undefined },
  { ...character(NONMATCH), kind: 'event', ap: undefined, lp: undefined },
  { ...character(GREEN_PARTNER, { colors: ['緑'] }), kind: 'partner' },
];

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function base(card: CardDef): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [...card.colors];
  state.players.self.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: NONMATCH }));
  state.players.self.hand = [card.id];
  return state;
}

function install(state: GameState, label: string): void {
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function useEvent(card: CardDef): void {
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: card.id }), card.id).toEqual({ ok: true });
}

function pendingPick(sourceCardId: string, atomVerb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${sourceCardId}: ${atomVerb} pending`).toBeTruthy();
  expect(pending, `${sourceCardId}: ${atomVerb} authority`).toMatchObject({
    player: 'self', atomVerb, source: { cardId: sourceCardId, abilityId: 'a1' },
  });
  return pending!;
}

function resolvePick(sourceCardId: string, atomVerb: string, cardId: string): void {
  const pending = pendingPick(sourceCardId, atomVerb);
  const candidate = pending.candidates.find(item => item.cardId === cardId);
  expect(candidate, `${sourceCardId}: ${atomVerb}/${cardId} candidate`).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: candidate!.uid,
  })), `${sourceCardId}: ${atomVerb}/${cardId}`).toEqual({ ok: true });
}

function declinePick(sourceCardId: string, atomVerb: string): void {
  const pending = pendingPick(sourceCardId, atomVerb);
  expect(pending.nMin, `${sourceCardId}: optional selection`).toBe(0);
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: null,
  })), `${sourceCardId}: decline ${atomVerb}`).toEqual({ ok: true });
}

function resolveChoice(card: CardDef, choiceIndex: number): void {
  const pending = useGameStateStore.getState().pendingEffectChoice;
  expect(pending, `${card.id}: choice pending`).toMatchObject({
    player: 'self', source: { cardId: card.id, abilityId: 'a1' },
  });
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'choiceResolve', choiceIndex,
  })), `${card.id}: choice ${choiceIndex}`).toEqual({ ok: true });
}

function dismissReveal(): void {
  if (useGameStateStore.getState().pendingDeckReveal) {
    useGameStateStore.getState().setPendingDeckReveal(null);
    surfacePendingSideChannels();
  }
}

function declineEnteredDeckLook(cardId: string): void {
  declinePick(cardId, 'deckRevealUntil');
  dismissReveal();
  const reorder = useGameStateStore.getState().pendingDeckReorder;
  if (reorder) {
    expect(dispatchEngineAction(bindPendingDecision(reorder, {
      type: 'deckReorderResolve', order: reorder.cardIds,
    }))).toEqual({ ok: true });
  }
}

function expectSettled(card: CardDef): void {
  dismissReveal();
  const store = useGameStateStore.getState();
  expect(store.pendingEffectPick, `${card.id}: pick cleared`).toBeNull();
  expect(store.pendingEffectChoice, `${card.id}: choice cleared`).toBeNull();
  expect(store.pendingEffectOptional, `${card.id}: optional cleared`).toBeNull();
  expect(store.pendingDeckReorder, `${card.id}: reorder cleared`).toBeNull();
  expect(current().pendingEffects.every(item => item.state === 'resolved'), `${card.id}: effects resolved`).toBe(true);
  expect(current().players.self.remove, `${card.id}: event consumed`).toContain(card.id);
  expect(current().pendingRuntimeState, `${card.id}: runtime authority cleared`).toBeUndefined();
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null });
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('effect entry official Q&A — event body finishes before the entered ability', () => {
  it(`card:B07058:${QA}: source set resolves before B07048 enter-set`, () => {
    const state = base(B07058);
    state.players.self.case.cardId = RED_MAGIC_CASE;
    state.players.self.remove = [B07048.id, B07048.id];
    state.players.self.deck = [SET_ONE, SET_TWO, TAIL];
    install(state, 'qa-effect-entry-b07058');

    useEvent(B07058);
    resolvePick(B07058.id, 'sceneEnter', B07048.id);

    const entered = current().players.self.scene.find(item => item.cardId === B07048.id)!;
    expect(entered.setCards.map(item => item.cardId), 'event set then B07048 enter-set').toEqual([SET_ONE, SET_TWO]);
    expect(current().players.self.remove.filter(cardId => cardId === B07048.id), 'only the selected occurrence entered').toHaveLength(1);
    expect(read.char.ap(current(), entered.uid), 'event AP rider completed').toBe(B07048.ap! + 3000);
    expect(read.char.hasKeyword(current(), entered.uid, '突撃[キャラ]'), 'event keyword rider completed').toBe(true);
    expectSettled(B07058);
  });

  it(`card:B07090:${QA}: AP rider resolves before D09022 draw-discard`, () => {
    const state = base(B07090);
    state.players.self.remove = [D09022.id];
    state.players.self.deck = [SOURCE_DRAW, TAIL];
    state.players.self.hand.push(DISCARD);
    state.players.opp.scene = [makeChar({ cardId: POLICE, uid: 'opp-police' })];
    install(state, 'qa-effect-entry-b07090');

    useEvent(B07090);
    resolvePick(B07090.id, 'sceneEnter', D09022.id);
    resolvePick(B07090.id, 'charModifyAP', POLICE);

    expect(read.char.ap(current(), 'opp-police'), 'either-side source AP rider is already applied').toBe(3000);
    expect(current().players.opp.scene[0]!.turnEffects.actionTargetsActive, 'source action-target rider is already applied').toBe(true);
    const discard = pendingPick(D09022.id, 'discard');
    expect(current().players.self.hand, 'entered draw happened only after source rider').toContain(SOURCE_DRAW);
    const discardCandidate = discard.candidates.find(item => item.cardId === DISCARD)!;
    expect(dispatchEngineAction(bindPendingDecision(discard, {
      type: 'effectPickResolve', pickedUid: discardCandidate.uid,
    }))).toEqual({ ok: true });
    expectSettled(B07090);
  });

  it(`card:B08029:${QA}: grant and Momiji recovery resolve before B02019 deck-look`, () => {
    const state = base(B08029);
    state.players.self.partner = { cardId: GREEN_PARTNER, state: 'active', location: 'partner-area' };
    state.players.self.remove = [B02019.id, MOMIJI];
    state.players.self.deck = [GREEN_EVENT];
    install(state, 'qa-effect-entry-b08029');

    useEvent(B08029);
    resolveChoice(B08029, 1);
    resolvePick(B08029.id, 'sceneEnter', B02019.id);
    resolvePick(B08029.id, 'handAddFromRemove', MOMIJI);

    const entered = current().players.self.scene.find(item => item.cardId === B02019.id)!;
    expect(entered.turnEffects.actionTargetsActive, 'selected grant completed first').toBe(true);
    expect(current().players.self.hand, 'parallel Momiji recovery completed first').toContain(MOMIJI);
    expect(pendingPick(B02019.id, 'deckRevealUntil').candidates.map(item => item.cardId)).toContain(GREEN_EVENT);
    declineEnteredDeckLook(B02019.id);
    expectSettled(B08029);
  });

  it(`card:B08092:${QA}: conditional removal resolves before B08016 deck-look`, () => {
    const state = base(B08092);
    state.players.self.case.colors = ['青', '黒'];
    state.players.self.case.status = '事件編';
    state.players.self.hand.push(B08016.id);
    state.players.self.deck = [SOURCE_DRAW, BLUE_MATCH];
    state.players.self.scene = [makeChar({ cardId: SHERRY, uid: 'sherry' })];
    state.players.opp.scene = [makeChar({ cardId: REMOVE_TARGET, uid: 'remove-target', state: 'sleep' })];
    install(state, 'qa-effect-entry-b08092');

    useEvent(B08092);
    expect(current().players.self.hand, 'source leading draw').toContain(SOURCE_DRAW);
    resolvePick(B08092.id, 'sceneEnter', B08016.id);
    resolvePick(B08092.id, 'sceneRemove', REMOVE_TARGET);

    expect(current().players.opp.remove, 'source conditional tail completed first').toContain(REMOVE_TARGET);
    expect(pendingPick(B08016.id, 'deckRevealUntil').candidates.map(item => item.cardId)).toContain(BLUE_MATCH);
    declineEnteredDeckLook(B08016.id);
    expectSettled(B08092);
  });

  it(`card:D11019:${QA}: bottom-shuffle resolves before D05004 hand reveal`, () => {
    const state = base(D11019);
    state.players.self.deck = [NONMATCH, D05004.id, TAIL];
    state.players.opp.hand = [OPP_HAND];
    install(state, 'qa-effect-entry-d11019');

    useEvent(D11019);
    expect(current().players.self.scene.map(item => item.cardId)).toContain(D05004.id);
    const actions = current().log.map(item => item.action);
    expect(actions.lastIndexOf('effect:deckShuffle'), 'source shuffle happened').toBeGreaterThanOrEqual(0);
    expect(actions.lastIndexOf('effect:handReveal'), 'entered ability happened after source shuffle')
      .toBeGreaterThan(actions.lastIndexOf('effect:deckShuffle'));
    expect(current().players.self.deck, 'matched occurrence left deck').not.toContain(D05004.id);
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: 'self', visibility: 'public', viewer: 'all',
      revealed: [NONMATCH, D05004.id], matched: D05004.id,
      source: { cardId: D11019.id, abilityId: 'a1', abilityOrigin: 'printed', abilityIndex: 0 },
    });
    dismissReveal();
    const entered = current().players.self.scene.find(item => item.cardId === D05004.id)!;
    expect(useGameStateStore.getState().pendingPublicHandReveal).toEqual({
      owner: 'opp', audience: 'all', cardIds: [OPP_HAND], handSnapshot: [OPP_HAND],
      lifetime: 'presentation', resolutionToken: expect.any(String),
      source: { cardId: D05004.id, abilityId: 'a1', abilityOrigin: 'printed', abilityIndex: 0, uid: entered.uid },
    });
    useGameStateStore.getState().setPendingPublicHandReveal(null);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
    expectSettled(D11019);
  });
});

describe('independent event tails survive declining the optional entry', () => {
  it('B07058: declining the remove entry leaves every occurrence and follow-up untouched', () => {
    const state = base(B07058);
    state.players.self.case.cardId = RED_MAGIC_CASE;
    state.players.self.remove = [B07048.id, B07048.id];
    state.players.self.deck = [SET_ONE, SET_TWO, TAIL];
    install(state, 'qa-effect-entry-b07058-decline');

    useEvent(B07058);
    declinePick(B07058.id, 'sceneEnter');

    expect(current().players.self.scene.map(item => item.cardId)).not.toContain(B07048.id);
    expect(current().players.self.remove.filter(cardId => cardId === B07048.id)).toHaveLength(2);
    expect(current().players.self.deck).toEqual([SET_ONE, SET_TWO, TAIL]);
    expectSettled(B07058);
  });

  it('B07090: declining the remove entry still allows the AP rider', () => {
    const state = base(B07090);
    state.players.self.remove = [D09022.id];
    state.players.self.scene = [makeChar({ cardId: POLICE, uid: 'police' })];
    install(state, 'qa-effect-entry-b07090-decline');

    useEvent(B07090);
    declinePick(B07090.id, 'sceneEnter');
    resolvePick(B07090.id, 'charModifyAP', POLICE);

    expect(read.char.ap(current(), 'police')).toBe(3000);
    expect(current().players.self.scene[0]!.turnEffects.actionTargetsActive).toBe(true);
    expect(current().players.self.remove).toContain(D09022.id);
    expectSettled(B07090);
  });

  it('B08029: declining Iori still allows Momiji recovery', () => {
    const state = base(B08029);
    state.players.self.partner = { cardId: GREEN_PARTNER, state: 'active', location: 'partner-area' };
    state.players.self.remove = [B02019.id, MOMIJI];
    install(state, 'qa-effect-entry-b08029-decline');

    useEvent(B08029);
    resolveChoice(B08029, 1);
    declinePick(B08029.id, 'sceneEnter');
    resolvePick(B08029.id, 'handAddFromRemove', MOMIJI);

    expect(current().players.self.hand).toContain(MOMIJI);
    expect(current().players.self.remove).toContain(B02019.id);
    expect(current().players.self.scene.map(item => item.cardId)).not.toContain(B02019.id);
    expectSettled(B08029);
  });

  it('B08092: declining the hand entry still allows the conditional removal', () => {
    const state = base(B08092);
    state.players.self.case.colors = ['青', '黒'];
    state.players.self.case.status = '事件編';
    state.players.self.hand.push(B08016.id);
    state.players.self.deck = [SOURCE_DRAW, TAIL];
    state.players.self.scene = [makeChar({ cardId: SHERRY, uid: 'sherry' })];
    state.players.opp.scene = [makeChar({ cardId: REMOVE_TARGET, uid: 'remove-target', state: 'sleep' })];
    install(state, 'qa-effect-entry-b08092-decline');

    useEvent(B08092);
    declinePick(B08092.id, 'sceneEnter');
    resolvePick(B08092.id, 'sceneRemove', REMOVE_TARGET);

    expect(current().players.self.hand).toContain(B08016.id);
    expect(current().players.opp.remove).toContain(REMOVE_TARGET);
    expectSettled(B08092);
  });
});
