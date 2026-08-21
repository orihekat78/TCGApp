// qa: card:B02077:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B03049:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B04084:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B05062:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B09047:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B09047:f99615ed14f068c2665eb794f70f387bc172946f72a10011407b0a091f842aa3
// Rules: 07-action-flow.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 21-declared-ability-cost.md, 25-qa-effects-resolution.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B02077 } from '@/cards/ct-p02/B02077';
import { B02077P } from '@/cards/ct-p02/B02077P';
import { B03049 } from '@/cards/ct-p03/B03049';
import { B03049P } from '@/cards/ct-p03/B03049P';
import { B04084 } from '@/cards/ct-p04/B04084';
import { B05062 } from '@/cards/ct-p05/B05062';
import { B09047 } from '@/cards/ct-p09/B09047';
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
const DRAW = 'QA_ENTRY_WAVE3_DRAW';
const FILLER = 'QA_ENTRY_WAVE3_FILLER';
const COST_ONE = 'QA_ENTRY_WAVE3_COST_ONE';
const COST_TWO = 'QA_ENTRY_WAVE3_COST_TWO';
const ACTION_TARGET = 'QA_ENTRY_WAVE3_ACTION_TARGET';
const YELLOW_PARTNER = 'QA_ENTRY_WAVE3_YELLOW_PARTNER';

function character(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黄'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  };
}

const enterDraw: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
};

const DETECTIVE_GATE = character('QA_ENTRY_WAVE3_DETECTIVE_GATE', { traits: ['探偵'], level: 7 });
const DETECTIVE_ENTRY = character('QA_ENTRY_WAVE3_DETECTIVE_ENTRY', { traits: ['探偵'], level: 5, abilities: [enterDraw] });
const DETECTIVE_DECOY = character('QA_ENTRY_WAVE3_DETECTIVE_DECOY', { traits: ['探偵'], level: 6 });
const WHITE_ENTRY = character('QA_ENTRY_WAVE3_WHITE_ENTRY', { colors: ['白'], level: 3, abilities: [enterDraw] });
const WHITE_DECOY = character('QA_ENTRY_WAVE3_WHITE_DECOY', { colors: ['白'], level: 5 });
const POLICE_ENTRY = character('QA_ENTRY_WAVE3_POLICE_ENTRY', { traits: ['警察'], level: 5, abilities: [enterDraw] });
const POLICE_DECOY = character('QA_ENTRY_WAVE3_POLICE_DECOY', { traits: ['警察'], level: 9 });
const KYOGOKU_ENTRY = character('QA_ENTRY_WAVE3_KYOGOKU_ENTRY', { names: ['京極真'], level: 7, abilities: [enterDraw] });
const KYOGOKU_DECOY = character('QA_ENTRY_WAVE3_KYOGOKU_DECOY', { names: ['京極真'], level: 8 });
const KYOGOKU_HIGH = character('QA_ENTRY_WAVE3_KYOGOKU_HIGH', { names: ['京極真'], level: 8 });
const SUZUKI_HIGH = character('QA_ENTRY_WAVE3_SUZUKI_HIGH', { traits: ['鈴木財閥'], level: 8 });
const BLUE_ENTRY = character('QA_ENTRY_WAVE3_BLUE_ENTRY', { colors: ['青'], level: 4, abilities: [enterDraw] });
const BLUE_DECOY = character('QA_ENTRY_WAVE3_BLUE_DECOY', { colors: ['青'], level: 5 });
const fixtures: CardDef[] = [
  character(DRAW), character(FILLER), character(COST_ONE), character(COST_TWO),
  character(ACTION_TARGET, { ap: 9000 }),
  character(YELLOW_PARTNER, { kind: 'partner', colors: ['黄'] }),
  DETECTIVE_GATE, DETECTIVE_ENTRY, DETECTIVE_DECOY,
  WHITE_ENTRY, WHITE_DECOY, POLICE_ENTRY, POLICE_DECOY,
  KYOGOKU_ENTRY, KYOGOKU_DECOY, KYOGOKU_HIGH, SUZUKI_HIGH, BLUE_ENTRY, BLUE_DECOY,
];

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function base(source: CardDef): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [...source.colors];
  state.players.self.case.status = '解決編';
  state.players.self.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
  state.players.self.deck = [DRAW, FILLER];
  return state;
}

function install(state: GameState, label: string): void {
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function useCard(card: CardDef): void {
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: card.id }), card.id)
    .toEqual({ ok: true });
}

function pendingPick(card: CardDef, atomVerb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${card.id}: ${atomVerb} authority`).toMatchObject({
    player: 'self', atomVerb, source: { cardId: card.id, abilityId: 'a1' },
  });
  return pending!;
}

function resolveSingle(card: CardDef, atomVerb: string, target: CardDef): void {
  const pending = pendingPick(card, atomVerb);
  const candidate = pending.candidates.find(item => item.cardId === target.id);
  expect(candidate, `${card.id}: ${target.id} eligible`).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: candidate!.uid,
  }))).toEqual({ ok: true });
}

function resolveChoice(card: CardDef, choiceIndex: number): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectChoice;
  expect(pending, `${card.id}: choice authority`).toMatchObject({
    player: 'self', source: { cardId: card.id, abilityId: 'a1' },
  });
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'choiceResolve', choiceIndex,
  }))).toEqual({ ok: true });
}

function dismissReveal(): void {
  if (useGameStateStore.getState().pendingDeckReveal) {
    useGameStateStore.getState().setPendingDeckReveal(null);
    surfacePendingSideChannels();
  }
}

function expectSettled(card: CardDef): void {
  dismissReveal();
  const store = useGameStateStore.getState();
  expect(store.pendingEffectPick, `${card.id}: pick cleared`).toBeNull();
  expect(store.pendingEffectChoice, `${card.id}: choice cleared`).toBeNull();
  expect(store.pendingEffectOptional, `${card.id}: optional cleared`).toBeNull();
  expect(store.pendingDeckReveal, `${card.id}: reveal cleared`).toBeNull();
  expect(store.pendingDeckReorder, `${card.id}: reorder cleared`).toBeNull();
  expect(store.activeActionId, `${card.id}: action cleared`).toBeNull();
  expect(current().pendingEffects.every(entry => entry.state === 'resolved'), `${card.id}: effects resolved`).toBe(true);
  expect(current().pendingRuntimeState, `${card.id}: runtime cleared`).toBeUndefined();
}

function expectEntryTriggered(card: CardDef, target: CardDef, state: 'active' | 'sleep'): void {
  const game = current();
  expect(game.players.self.scene.find(item => item.cardId === target.id)?.state, `${card.id}: target entered`).toBe(state);
  expect(game.players.self.hand, `${card.id}: entered ability drew`).toContain(DRAW);
  const actions = game.log.map(entry => entry.action);
  expect(actions.lastIndexOf('effect:draw'), `${card.id}: entered trigger follows entry`)
    .toBeGreaterThan(actions.lastIndexOf('effect:sceneEnter'));
}

function finishAction(actionId: string): void {
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  for (let index = 0; index < 2 && useGameStateStore.getState().activeActionId === actionId; index += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
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

describe('effect entry official Q&A — public wave 3', () => {
  it(`card:B02077:${QA}: its enter trigger reanimates a valid Detective and that character fires`, () => {
    const state = base(B02077);
    state.players.self.hand = [B02077.id];
    state.players.self.scene = [makeChar({ cardId: DETECTIVE_GATE.id, uid: 'detective-gate' })];
    state.players.self.remove = [DETECTIVE_ENTRY.id, DETECTIVE_DECOY.id];
    install(state, 'qa-entry-wave3-B02077');

    useCard(B02077);
    const entry = pendingPick(B02077, 'sceneEnter');
    expect(entry.candidates.map(item => item.cardId)).not.toContain(DETECTIVE_DECOY.id);
    resolveSingle(B02077, 'sceneEnter', DETECTIVE_ENTRY);

    expectEntryTriggered(B02077, DETECTIVE_ENTRY, 'sleep');
    expect(current().players.self.remove).toContain(DETECTIVE_DECOY.id);
    expect(B02077P.abilities).toEqual(B02077.abilities);
    expectSettled(B02077);
  });

  it(`card:B03049:${QA}: its declared bottom-deck entry fires the entered character`, () => {
    const state = base(B03049);
    state.players.self.file = state.players.self.file.slice(0, 4);
    state.players.self.scene = [
      makeChar({ cardId: B03049.id, uid: 'source', state: 'active' }),
      ...Array.from({ length: 4 }, (_, index) => makeChar({
        cardId: FILLER, uid: `full-scene-${index}`, state: 'active',
      })),
    ];
    state.players.self.deck = [DRAW, WHITE_DECOY.id, WHITE_ENTRY.id];
    install(state, 'qa-entry-wave3-B03049');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1' })).toEqual({ ok: true });
    surfacePendingSideChannels();

    expect(current().players.self.remove).toContain(B03049.id);
    expect(current().players.self.scene).toHaveLength(5);
    expect(current().players.self.deck).toContain(WHITE_DECOY.id);
    expectEntryTriggered(B03049, WHITE_ENTRY, 'active');
    expect(B03049P.abilities).toEqual(B03049.abilities);
    expectSettled(B03049);
  });

  it(`card:B04084:${QA}: public event choices enter Police and fire its enter ability`, () => {
    const state = base(B04084);
    state.players.self.hand = [B04084.id, COST_ONE, COST_TWO];
    state.players.self.remove = [POLICE_ENTRY.id, POLICE_DECOY.id];
    state.players.self.partner = { cardId: YELLOW_PARTNER, state: 'active', location: 'partner-area' };
    install(state, 'qa-entry-wave3-B04084');

    useCard(B04084);
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(optional?.source).toMatchObject({ cardId: B04084.id, abilityId: 'a1' });
    expect(dispatchEngineAction(bindPendingDecision(optional!, { type: 'optionalResolve', run: true }))).toEqual({ ok: true });

    const discard = pendingPick(B04084, 'discard');
    const costs = [COST_ONE, COST_TWO].map(cardId => discard.candidates.find(item => item.cardId === cardId)!);
    expect(costs.every(Boolean)).toBe(true);
    expect(dispatchEngineAction(bindPendingDecision(discard, {
      type: 'effectPickResolve', pickedUid: costs[0]!.uid, pickedUids: costs.map(item => item.uid),
    }))).toEqual({ ok: true });

    const group = pendingPick(B04084, 'bindPick');
    expect(group.candidates.map(item => item.cardId)).not.toContain(POLICE_DECOY.id);
    const selected = group.candidates.find(item => item.cardId === POLICE_ENTRY.id)!;
    expect(dispatchEngineAction(bindPendingDecision(group, {
      type: 'effectPickResolve', pickedUid: selected.uid,
    }))).toEqual({ ok: true });
    resolveSingle(B04084, 'sceneEnter', POLICE_ENTRY);

    expectEntryTriggered(B04084, POLICE_ENTRY, 'active');
    expect(current().players.self.remove).toEqual(expect.arrayContaining([B04084.id, COST_ONE, COST_TWO, POLICE_DECOY.id]));
    expectSettled(B04084);
  });

  it(`card:B05062:${QA}: its public reanimate choice fires the entered character`, () => {
    const state = base(B05062);
    state.players.self.hand = [B05062.id];
    state.players.self.remove = [KYOGOKU_ENTRY.id, KYOGOKU_DECOY.id];
    install(state, 'qa-entry-wave3-B05062');

    useCard(B05062);
    resolveChoice(B05062, 1);
    const entry = pendingPick(B05062, 'sceneEnter');
    expect(entry.candidates.map(item => item.cardId)).not.toContain(KYOGOKU_DECOY.id);
    resolveSingle(B05062, 'sceneEnter', KYOGOKU_ENTRY);

    expectEntryTriggered(B05062, KYOGOKU_ENTRY, 'active');
    expect(current().players.self.remove).toEqual(expect.arrayContaining([B05062.id, KYOGOKU_DECOY.id]));
    expectSettled(B05062);
  });

  it('B05062 treats every matching character as a four-card gate match, while its reanimate target remains level 7 or lower', () => {
    const state = base(B05062);
    state.players.self.case.colors = ['白'];
    state.players.self.hand = [B05062.id, COST_ONE];
    state.players.self.deck = [COST_TWO, FILLER, DRAW, ACTION_TARGET];
    state.players.self.remove = [KYOGOKU_ENTRY.id, KYOGOKU_DECOY.id, KYOGOKU_HIGH.id, SUZUKI_HIGH.id];
    install(state, 'qa-entry-wave3-B05062-four-card-gate');

    expect(B05062.colors).toEqual(['白']);
    useCard(B05062);
    expect(useGameStateStore.getState().pendingEffectChoice, 'four matches force all three effects').toBeNull();

    const discard = pendingPick(B05062, 'discard');
    const discarded = discard.candidates.find(item => item.cardId === COST_ONE);
    expect(discarded).toBeTruthy();
    expect(dispatchEngineAction(bindPendingDecision(discard, {
      type: 'effectPickResolve', pickedUid: discarded!.uid,
    }))).toEqual({ ok: true });

    const entry = pendingPick(B05062, 'sceneEnter');
    expect(entry.candidates.map(item => item.cardId)).toContain(KYOGOKU_ENTRY.id);
    expect(entry.candidates.map(item => item.cardId)).not.toEqual(expect.arrayContaining([
      KYOGOKU_DECOY.id, KYOGOKU_HIGH.id, SUZUKI_HIGH.id,
    ]));
    resolveSingle(B05062, 'sceneEnter', KYOGOKU_ENTRY);

    const sleep = pendingPick(B05062, 'sceneSetState');
    expect(dispatchEngineAction(bindPendingDecision(sleep, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });

    expectEntryTriggered(B05062, KYOGOKU_ENTRY, 'active');
    expect(current().players.self.remove).toEqual(expect.arrayContaining([
      B05062.id, COST_ONE, KYOGOKU_DECOY.id, KYOGOKU_HIGH.id, SUZUKI_HIGH.id,
    ]));
    expectSettled(B05062);
  });

  it('B09047 reasoning opens its choice after sleep and before evidence, then resumes reasoning after the entered trigger', () => {
    const state = base(B09047);
    state.players.self.scene = [makeChar({ cardId: B09047.id, uid: 'source', state: 'active' })];
    state.players.self.remove = [BLUE_ENTRY.id, BLUE_DECOY.id];
    install(state, 'qa-entry-wave3-B09047-reasoning');

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'source' })).toEqual({ ok: true });
    surfacePendingSideChannels();

    expect(current().players.self.scene.find(item => item.uid === 'source')?.state).toBe('sleep');
    expect(current().players.self.evidence, 'choice precedes evidence and mislead windows').toHaveLength(0);
    resolveChoice(B09047, 0);
    resolveSingle(B09047, 'sceneEnter', BLUE_ENTRY);

    expectEntryTriggered(B09047, BLUE_ENTRY, 'active');
    expect(current().players.self.evidence).toHaveLength(1);
    expect(B09047.traits).toEqual(['怪人']);
    expectSettled(B09047);
  });

  it('B09047 reasoning ends without evidence when its entered character switches out the reasoner itself', () => {
    const state = base(B09047);
    state.players.self.scene = [
      makeChar({ cardId: B09047.id, uid: 'source', state: 'active' }),
      ...Array.from({ length: 4 }, (_, index) => makeChar({
        cardId: FILLER, uid: `reasoning-switch-filler-${index}`, state: 'active',
      })),
    ];
    state.players.self.remove = [BLUE_ENTRY.id];
    state.players.self.deck = [DRAW, FILLER, ACTION_TARGET];
    install(state, 'qa-entry-wave3-B09047-reasoning-self-switch');

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'source' })).toEqual({ ok: true });
    resolveChoice(B09047, 0);
    const entry = pendingPick(B09047, 'sceneEnter');
    const selected = entry.candidates.find(item => item.cardId === BLUE_ENTRY.id);
    expect(selected).toBeTruthy();
    expect(dispatchEngineAction(bindPendingDecision(entry, {
      type: 'effectPickResolve', pickedUid: selected!.uid, switchRemoveUid: 'source',
    }))).toEqual({ ok: true });

    expectEntryTriggered(B09047, BLUE_ENTRY, 'active');
    expect(current().players.self.scene.some(item => item.uid === 'source')).toBe(false);
    expect(current().players.self.remove).toContain(B09047.id);
    expect(current().players.self.evidence, 'switching out the reasoner ends reasoning').toHaveLength(0);
    expect(current().pendingReasoningContinuation).toBeUndefined();
    expectSettled(B09047);
  });

  it(`card:B09047:${QA}: its action choice enters a valid character and that character fires`, () => {
    const state = base(B09047);
    state.players.self.scene = [makeChar({ cardId: B09047.id, uid: 'source', state: 'active' })];
    state.players.self.remove = [BLUE_ENTRY.id, BLUE_DECOY.id];
    state.players.opp.scene = [makeChar({ cardId: ACTION_TARGET, uid: 'action-target', state: 'sleep' })];
    install(state, 'qa-entry-wave3-B09047');

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'action-target' })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toBeTruthy();
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null })).toEqual({ ok: false, reason: 'not-allowed' });
    resolveChoice(B09047, 0);
    const entry = pendingPick(B09047, 'sceneEnter');
    expect(entry.candidates.map(item => item.cardId)).not.toContain(BLUE_DECOY.id);
    resolveSingle(B09047, 'sceneEnter', BLUE_ENTRY);
    finishAction(actionId!);

    expectEntryTriggered(B09047, BLUE_ENTRY, 'active');
    expect(current().players.self.remove).toContain(BLUE_DECOY.id);
    expectSettled(B09047);
  });

  it('B09047 action aborts before contact when its entered character switches out the actor itself', () => {
    const actionEnds: unknown[] = [];
    const contacts: unknown[] = [];
    event.on('action:end', (_state, payload) => { actionEnds.push(payload); });
    event.on('contact:start', (_state, payload) => { contacts.push(payload); });
    const state = base(B09047);
    state.players.self.scene = [
      makeChar({ cardId: B09047.id, uid: 'source', state: 'active' }),
      ...Array.from({ length: 4 }, (_, index) => makeChar({
        cardId: FILLER, uid: `action-switch-filler-${index}`, state: 'active',
      })),
    ];
    state.players.self.remove = [BLUE_ENTRY.id];
    state.players.opp.scene = [makeChar({ cardId: ACTION_TARGET, uid: 'action-target', state: 'sleep' })];
    install(state, 'qa-entry-wave3-B09047-action-self-switch');

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'action-target' })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toBeTruthy();
    resolveChoice(B09047, 0);
    const entry = pendingPick(B09047, 'sceneEnter');
    const selected = entry.candidates.find(item => item.cardId === BLUE_ENTRY.id);
    expect(selected).toBeTruthy();
    expect(dispatchEngineAction(bindPendingDecision(entry, {
      type: 'effectPickResolve', pickedUid: selected!.uid, switchRemoveUid: 'source',
    }))).toEqual({ ok: true });

    expect(useGameStateStore.getState().activeActionId).toBe(actionId);
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null })).toEqual({ ok: true });
    expectEntryTriggered(B09047, BLUE_ENTRY, 'active');
    expect(current().players.self.scene.some(item => item.uid === 'source')).toBe(false);
    expect(current().players.self.remove).toContain(B09047.id);
    expect(current().actionContexts).toEqual({});
    expect(useGameStateStore.getState().activeActionId).toBeNull();
    expect(actionEnds).toContainEqual(expect.objectContaining({ byUid: 'source', result: 'aborted' }));
    expect(contacts).toEqual([]);
    expectSettled(B09047);
  });
});
