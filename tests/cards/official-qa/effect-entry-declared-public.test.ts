// qa: card:B04019:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B07020:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B09025:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// Rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 21-declared-ability-cost.md, 25-qa-effects-resolution.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B04019 } from '@/cards/ct-p04/B04019';
import { B07020 } from '@/cards/ct-p07/B07020';
import { B07020P } from '@/cards/ct-p07/B07020P';
import { B09025 } from '@/cards/ct-p09/B09025';
import { B09025P } from '@/cards/ct-p09/B09025P';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA = 'd8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa';
const DRAW = 'QA_DECLARED_ENTRY_DRAW';
const FILLER = 'QA_DECLARED_ENTRY_FILLER';

function character(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['緑'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  };
}

function eventCard(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'event', names: [id], colors: ['緑'], level: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  };
}

const enterDraw: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
};

const HATTORI_COST = character('QA_DECLARED_HATTORI_COST', { names: ['服部平次'], level: 7 });
const POLICE = character('QA_DECLARED_POLICE', { traits: ['警察'], level: 5, abilities: [enterDraw] });
const POLICE_DECOY = character('QA_DECLARED_POLICE_DECOY', { traits: ['警察'], level: 6 });
const MARO_COST = character('QA_DECLARED_MARO_COST', { names: ['マロちゃん'], level: 5, abilities: [enterDraw] });
const MARO_DECOY = character('QA_DECLARED_MARO_DECOY', { traits: ['警察'], level: 6 });
const MARO_HAND = character('QA_DECLARED_MARO_HAND', { names: ['マロちゃん'], level: 2, abilities: [enterDraw] });
const MARO_EVENT = eventCard('QA_DECLARED_MARO_EVENT', { names: ['マロちゃん'], level: 2 });
const MARO_OTHER = character('QA_DECLARED_MARO_OTHER', { names: ['別のカード'] });
const fixtures = [
  character(DRAW), character(FILLER), HATTORI_COST, POLICE, POLICE_DECOY,
  MARO_COST, MARO_DECOY, MARO_HAND, MARO_EVENT, MARO_OTHER,
];

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function install(state: GameState, label: string): void {
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function base(source: CardDef): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [makeChar({ cardId: source.id, uid: 'source', state: 'active' })];
  state.players.self.deck = [DRAW, FILLER];
  return state;
}

function pendingPick(source: CardDef, atomVerb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${source.id}: ${atomVerb} authority`).toMatchObject({
    player: 'self', atomVerb, source: { cardId: source.id, uid: 'source', abilityId: 'a1' },
  });
  return pending!;
}

function resolvePick(source: CardDef, atomVerb: string, pickedUid: string | null, switchRemoveUid?: string): void {
  const pending = pendingPick(source, atomVerb);
  const action = switchRemoveUid
    ? { type: 'effectPickResolve' as const, pickedUid, switchRemoveUid }
    : { type: 'effectPickResolve' as const, pickedUid };
  expect(dispatchEngineAction(bindPendingDecision(pending, action))).toEqual({ ok: true });
}

function expectSettled(source: CardDef): void {
  const store = useGameStateStore.getState();
  expect(store.pendingEffectPick, `${source.id}: pick cleared`).toBeNull();
  expect(store.pendingEffectChoice, `${source.id}: choice cleared`).toBeNull();
  expect(store.pendingEffectOptional, `${source.id}: optional cleared`).toBeNull();
  expect(store.pendingDeckReveal, `${source.id}: reveal cleared`).toBeNull();
  expect(store.pendingDeckReorder, `${source.id}: reorder cleared`).toBeNull();
  expect(store.activeActionId, `${source.id}: no action runtime`).toBeNull();
  expect(current().pendingEffects.every((entry) => entry.state === 'resolved'), `${source.id}: effects resolved`).toBe(true);
  expect(current().pendingRuntimeState, `${source.id}: runtime authority cleared`).toBeUndefined();
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

describe('effect entry official Q&A — public declared abilities fire enter abilities', () => {
  it(`card:B04019:${QA}: cost, remove decline, and remove-area entry resolve in order`, () => {
    const state = base(B04019);
    state.players.self.scene.push(makeChar({ cardId: HATTORI_COST.id, uid: 'cost', state: 'active' }));
    state.players.self.remove = [POLICE.id, POLICE_DECOY.id];
    install(state, 'qa-effect-entry-declared-B04019');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1',
      costParams: { sceneToDeckBottom: { uids: ['cost'] } },
    })).toEqual({ ok: true });

    const remove = pendingPick(B04019, 'sceneRemove');
    expect(remove.nMin).toBe(0);
    expect(remove.candidates.map((candidate) => candidate.uid)).toContain('source');
    resolvePick(B04019, 'sceneRemove', null);
    const entry = pendingPick(B04019, 'sceneEnter');
    expect(entry.candidates.map((candidate) => candidate.cardId)).toContain(POLICE.id);
    expect(entry.candidates.map((candidate) => candidate.cardId)).not.toContain(POLICE_DECOY.id);
    const target = entry.candidates.find((candidate) => candidate.cardId === POLICE.id)!;
    resolvePick(B04019, 'sceneEnter', target.uid);

    const after = current();
    expect(after.players.self.scene.some((card) => card.uid === 'cost')).toBe(false);
    expect(after.players.self.deck).toContain(HATTORI_COST.id);
    expect(after.players.self.scene.find((card) => card.cardId === POLICE.id)?.state).toBe('sleep');
    expect(after.players.self.remove).toContain(POLICE_DECOY.id);
    expect(after.players.self.remove).not.toContain(POLICE.id);
    expect(after.players.self.hand).toContain(DRAW);
    expect(after.log.map((entry) => entry.action).lastIndexOf('effect:draw')).toBeGreaterThan(after.log.map((entry) => entry.action).lastIndexOf('effect:sceneEnter'));
    expectSettled(B04019);
  });

  it('B04019 advances from a declined removal through a declined entry and settles', () => {
    const state = base(B04019);
    state.players.self.scene.push(makeChar({ cardId: HATTORI_COST.id, uid: 'cost', state: 'active' }));
    state.players.self.remove = [POLICE.id];
    install(state, 'qa-effect-entry-declared-B04019-decline');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1',
      costParams: { sceneToDeckBottom: { uids: ['cost'] } },
    })).toEqual({ ok: true });
    resolvePick(B04019, 'sceneRemove', null);
    resolvePick(B04019, 'sceneEnter', null);
    expect(current().players.self.remove).toEqual([POLICE.id]);
    expect(current().players.self.hand).not.toContain(DRAW);
    expectSettled(B04019);
  });

  it(`card:B07020:${QA}: the just-paid hand cost may enter from remove and fire at a full scene`, () => {
    const state = base(B07020);
    while (state.players.self.scene.length < 5) {
      const index = state.players.self.scene.length;
      state.players.self.scene.push(makeChar({ cardId: FILLER, uid: `full-${index}`, state: 'active' }));
    }
    state.players.self.hand = [MARO_COST.id];
    state.players.self.remove = [MARO_DECOY.id];
    install(state, 'qa-effect-entry-declared-B07020');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1',
      costParams: { removeFromHand: { indices: [0] } },
    })).toEqual({ ok: true });

    const entry = pendingPick(B07020, 'sceneEnter');
    expect(current().players.self.scene.find((card) => card.uid === 'source')?.state).toBe('sleep');
    expect(current().players.self.remove).toContain(MARO_COST.id);
    expect(entry.candidates.map((candidate) => candidate.cardId)).toContain(MARO_COST.id);
    expect(entry.candidates.map((candidate) => candidate.cardId)).not.toContain(MARO_DECOY.id);
    const target = entry.candidates.find((candidate) => candidate.cardId === MARO_COST.id)!;
    resolvePick(B07020, 'sceneEnter', target.uid, 'full-1');

    const after = current();
    expect(after.players.self.scene).toHaveLength(5);
    expect(after.players.self.scene.some((card) => card.uid === 'full-1')).toBe(false);
    expect(after.players.self.remove).toContain(FILLER);
    expect(after.players.self.scene.find((card) => card.cardId === MARO_COST.id)?.state).toBe('active');
    expect(after.players.self.remove).not.toContain(MARO_COST.id);
    expect(after.players.self.hand).toContain(DRAW);
    expect(B07020P.abilities).toEqual(B07020.abilities);
    expectSettled(B07020);
  });

  it('B07020 public decline preserves the paid sleep and hand-removal costs', () => {
    const state = base(B07020);
    state.players.self.hand = [MARO_COST.id];
    install(state, 'qa-effect-entry-declared-B07020-decline');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1',
      costParams: { removeFromHand: { indices: [0] } },
    })).toEqual({ ok: true });
    const entry = pendingPick(B07020, 'sceneEnter');
    expect(entry.nMin).toBe(0);
    resolvePick(B07020, 'sceneEnter', null);
    expect(current().players.self.scene.find((card) => card.uid === 'source')?.state).toBe('sleep');
    expect(current().players.self.hand).not.toContain(MARO_COST.id);
    expect(current().players.self.remove).toContain(MARO_COST.id);
    expect(current().players.self.hand).not.toContain(DRAW);
    expectSettled(B07020);
  });

  it(`card:B09025:${QA}: the structural single choice reaches public hand-entry authority`, () => {
    const state = base(B09025);
    state.players.self.hand = [MARO_HAND.id, MARO_EVENT.id, MARO_OTHER.id];
    install(state, 'qa-effect-entry-declared-B09025');
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1' })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectChoice).toBeNull();
    const entry = pendingPick(B09025, 'sceneEnter');
    expect(entry.nMin).toBe(0);
    expect(entry.candidates.map((candidate) => candidate.cardId)).toContain(MARO_HAND.id);
    expect(entry.candidates.map((candidate) => candidate.cardId)).not.toContain(MARO_EVENT.id);
    expect(entry.candidates.map((candidate) => candidate.cardId)).not.toContain(MARO_OTHER.id);
    const target = entry.candidates.find((candidate) => candidate.cardId === MARO_HAND.id)!;
    resolvePick(B09025, 'sceneEnter', target.uid);

    const after = current();
    expect(after.players.self.scene.find((card) => card.cardId === MARO_HAND.id)?.state).toBe('active');
    expect(after.players.self.hand).not.toContain(MARO_HAND.id);
    expect(after.players.self.hand).toContain(MARO_EVENT.id);
    expect(after.players.self.hand).toContain(MARO_OTHER.id);
    expect(after.players.self.hand).toContain(DRAW);
    expect(B09025P.abilities).toEqual(B09025.abilities);
    expectSettled(B09025);
  });
});
