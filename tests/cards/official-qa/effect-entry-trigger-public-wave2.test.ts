// qa: card:B04064:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B09089:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B10032:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// Rules: 15-abilities-effects.md, 17-icons.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B04064 } from '@/cards/ct-p04/B04064';
import { B09089 } from '@/cards/ct-p09/B09089';
import { B10032 } from '@/cards/ct-p10/B10032';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const ENTRY = 'QA_EFFECT_ENTRY';
const DRAW = 'QA_EFFECT_ENTRY_DRAW';
const FILLER = 'QA_EFFECT_ENTRY_FILLER';
const REMOVE_TARGET = 'QA_EFFECT_ENTRY_REMOVE_TARGET';
const ASSAULT_TARGET = 'QA_EFFECT_ENTRY_ASSAULT_TARGET';
const RED_PARTNER = 'QA_EFFECT_ENTRY_RED_PARTNER';
const GREEN_PARTNER = 'QA_EFFECT_ENTRY_GREEN_PARTNER';

function card(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['緑'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  };
}

const enterDraw: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
};

const fixtures: CardDef[] = [
  card(ENTRY, { colors: ['緑'], level: 3, traits: ['警察'], abilities: [enterDraw] }),
  card(DRAW), card(FILLER),
  card(REMOVE_TARGET, { level: 8, ap: 1000 }),
  card(ASSAULT_TARGET, { colors: ['緑'], traits: ['警察'] }),
  card(RED_PARTNER, { kind: 'partner', colors: ['赤'] }),
  card(GREEN_PARTNER, { kind: 'partner', colors: ['緑'] }),
];

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function base(source: CardDef, partnerId = RED_PARTNER): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.hand = [source.id];
  state.players.self.deck = [DRAW, FILLER];
  state.players.self.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
  state.players.self.case = {
    cardId: 'QA_EFFECT_ENTRY_CASE', status: '解決編', requiredEvidence: 7,
    colors: [...source.colors], declaredUseCount: {},
  };
  state.players.self.partner = { cardId: partnerId, state: 'active', location: 'partner-area' };
  return state;
}

function install(state: GameState, label: string): void {
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function useEvent(source: CardDef): void {
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: source.id }), source.id)
    .toEqual({ ok: true });
}

function resolvePick(source: CardDef, atomVerb: string, cardId: string): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${source.id}: ${atomVerb} pending`).toMatchObject({
    player: 'self', atomVerb, source: { cardId: source.id, abilityId: 'a1' },
  });
  const candidate = pending!.candidates.find(item => item.cardId === cardId);
  expect(candidate, `${source.id}: ${cardId} candidate`).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: candidate!.uid,
  })), `${source.id}: resolve ${atomVerb}`).toEqual({ ok: true });
}

function expectTriggered(source: CardDef): void {
  surfacePendingSideChannels();
  const state = current();
  expect(state.players.self.scene.some(item => item.cardId === ENTRY), `${source.id}: entered`).toBe(true);
  expect(state.players.self.hand, `${source.id}: enter ability drew`).toContain(DRAW);
  expect(state.players.self.remove, `${source.id}: event consumed`).toContain(source.id);
  const store = useGameStateStore.getState();
  expect(store.pendingEffectPick, `${source.id}: pick cleared`).toBeNull();
  expect(store.pendingEffectChoice, `${source.id}: choice cleared`).toBeNull();
  expect(store.pendingEffectOptional, `${source.id}: optional cleared`).toBeNull();
  expect(state.pendingEffects.every(item => item.state === 'resolved'), `${source.id}: effects resolved`).toBe(true);
  expect(state.pendingRuntimeState, `${source.id}: runtime cleared`).toBeUndefined();
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

describe('effect entry official Q&A — entered characters fire their enter ability', () => {
  it('B04064 removes first, then its hand entry fires the enter ability', () => {
    const state = base(B04064);
    state.players.self.file = state.players.self.file.slice(0, 5);
    state.players.self.hand.push(ENTRY);
    state.players.opp.scene = [makeChar({ cardId: REMOVE_TARGET, uid: 'remove-target' })];
    install(state, 'qa-effect-entry-b04064');

    useEvent(B04064);
    resolvePick(B04064, 'sceneRemove', REMOVE_TARGET);
    resolvePick(B04064, 'sceneEnter', ENTRY);

    expect(current().players.opp.remove, 'source removal completed').toContain(REMOVE_TARGET);
    expect(current().players.self.hand, 'B04064 entered ability fired').toContain(DRAW);
    expectTriggered(B04064);
  });

  it('B09089 removes first, then its remove-area entry fires the enter ability', () => {
    const state = base(B09089);
    state.players.self.remove = [ENTRY];
    state.players.opp.scene = [makeChar({ cardId: REMOVE_TARGET, uid: 'remove-target' })];
    install(state, 'qa-effect-entry-b09089');

    useEvent(B09089);
    resolvePick(B09089, 'sceneRemove', REMOVE_TARGET);
    resolvePick(B09089, 'sceneEnter', ENTRY);

    expect(current().players.opp.remove, 'source removal completed').toContain(REMOVE_TARGET);
    expect(current().players.self.hand, 'B09089 entered ability fired').toContain(DRAW);
    expectTriggered(B09089);
  });

  it('B10032 grants assault first, then its remove-area entry fires the enter ability', () => {
    const state = base(B10032, GREEN_PARTNER);
    state.players.self.remove = [ENTRY];
    state.players.self.scene = [makeChar({ cardId: ASSAULT_TARGET, uid: 'assault-target' })];
    install(state, 'qa-effect-entry-b10032');

    useEvent(B10032);
    resolvePick(B10032, 'charGrantKeyword', ASSAULT_TARGET);
    resolvePick(B10032, 'sceneEnter', ENTRY);

    expect(read.char.hasKeyword(current(), 'assault-target', '突撃[キャラ]'), 'source keyword completed').toBe(true);
    expect(current().players.self.hand, 'B10032 entered ability fired').toContain(DRAW);
    expectTriggered(B10032);
  });
});
