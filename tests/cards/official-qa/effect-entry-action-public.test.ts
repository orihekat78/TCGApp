// qa: card:B02004:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B03030:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B03099:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:D10023:f0e393b3a47afbeb95a14a91a8c573bd540fb08877f11528e5ae7dcd501b1a98
// qa: card:PR173:f0e393b3a47afbeb95a14a91a8c573bd540fb08877f11528e5ae7dcd501b1a98
// Rules: 03-field-areas.md, 07-action-flow.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 25-qa-effects-resolution.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B02004 } from '@/cards/ct-p02/B02004';
import { B02004P } from '@/cards/ct-p02/B02004P';
import { B03030 } from '@/cards/ct-p03/B03030';
import { B03030P } from '@/cards/ct-p03/B03030P';
import { B03099 } from '@/cards/ct-p03/B03099';
import { D10023 } from '@/cards/ct-d10/D10023';
import { PR173 } from '@/cards/pr-01/PR173';
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
const DRAW = 'QA_ACTION_ENTRY_DRAW';
const FILLER = 'QA_ACTION_ENTRY_FILLER';
const ACTION_TARGET = 'QA_ACTION_ENTRY_TARGET';

function character(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  };
}

const enterDraw: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
};

const KUDO = character('QA_ACTION_ENTRY_KUDO', { names: ['工藤新一'] });
const EIRI = character('QA_ACTION_ENTRY_EIRI', { names: ['妃英理'], level: 5, abilities: [enterDraw] });
const EIRI_DECOY = character('QA_ACTION_ENTRY_EIRI_DECOY', { names: ['妃英理'], level: 6 });
const GREEN = character('QA_ACTION_ENTRY_GREEN', { colors: ['緑'], level: 6, abilities: [enterDraw] });
const GREEN_DECOY = character('QA_ACTION_ENTRY_GREEN_DECOY', { colors: ['緑'], level: 7 });
const NAGANO = character('QA_ACTION_ENTRY_NAGANO', { traits: ['長野県警'], level: 6, abilities: [enterDraw] });
const NAGANO_DECOY = character('QA_ACTION_ENTRY_NAGANO_DECOY', { traits: ['長野県警'], level: 7 });
const fixtures = [
  character(DRAW), character(FILLER), character(ACTION_TARGET, { ap: 9000 }),
  KUDO, EIRI, EIRI_DECOY, GREEN, GREEN_DECOY, NAGANO, NAGANO_DECOY,
];

type ActionEntryCase = {
  source: CardDef;
  abilityId: string;
  target: CardDef;
  decoy: CardDef;
  from: 'hand' | 'remove';
  enteredState: 'active' | 'sleep';
  trigger: 'action';
  parallel?: CardDef;
  bond?: boolean;
};

const CASES: Record<string, ActionEntryCase> = {
  B02004: { source: B02004, abilityId: 'a1', target: EIRI, decoy: EIRI_DECOY, from: 'remove', enteredState: 'active', trigger: 'action', parallel: B02004P, bond: true },
  D10023: { source: D10023, abilityId: 'a1', target: EIRI, decoy: EIRI_DECOY, from: 'remove', enteredState: 'active', trigger: 'action', bond: true },
  PR173: { source: PR173, abilityId: 'a1', target: EIRI, decoy: EIRI_DECOY, from: 'remove', enteredState: 'active', trigger: 'action', bond: true },
  B03030: { source: B03030, abilityId: 'a2', target: GREEN, decoy: GREEN_DECOY, from: 'hand', enteredState: 'sleep', trigger: 'action', parallel: B03030P },
  B03099: { source: B03099, abilityId: 'a1', target: NAGANO, decoy: NAGANO_DECOY, from: 'remove', enteredState: 'sleep', trigger: 'action' },
};

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function install(spec: ActionEntryCase, fullScene = false): void {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [makeChar({ cardId: spec.source.id, uid: 'source', state: 'active' })];
  if (spec.bond) state.players.self.scene.push(makeChar({ cardId: KUDO.id, uid: 'bond', state: 'active' }));
  while (fullScene && state.players.self.scene.length < 5) {
    const index = state.players.self.scene.length;
    state.players.self.scene.push(makeChar({ cardId: FILLER, uid: `full-${index}`, state: 'active' }));
  }
  state.players.opp.scene = [makeChar({ cardId: ACTION_TARGET, uid: 'action-target', state: 'sleep' })];
  state.players.self.deck = [DRAW, FILLER];
  state.players.self[spec.from] = [spec.target.id, spec.decoy.id];
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(`qa-effect-entry-action-${spec.source.id}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function trigger(spec: ActionEntryCase): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'action-target' })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  return actionId;
}

function pendingEntry(spec: ActionEntryCase) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${spec.source.id}: exact entry authority`).toMatchObject({
    player: 'self', atomVerb: 'sceneEnter', nMin: 0, nMax: 1,
    source: { cardId: spec.source.id, uid: 'source', abilityId: spec.abilityId },
  });
  expect(pending!.candidates.map((candidate) => candidate.cardId), `${spec.source.id}: eligible target`).toContain(spec.target.id);
  expect(pending!.candidates.map((candidate) => candidate.cardId), `${spec.source.id}: level decoy excluded`).not.toContain(spec.decoy.id);
  return pending!;
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

function prove(spec: ActionEntryCase): unknown {
  install(spec);
  const actionId = trigger(spec);
  const pending = pendingEntry(spec);
  const target = pending.candidates.find((candidate) => candidate.cardId === spec.target.id)!;
  expect(dispatchEngineAction(bindPendingDecision(pending, { type: 'effectPickResolve', pickedUid: target.uid }))).toEqual({ ok: true });
  finishAction(actionId);
  const state = current();
  const entered = state.players.self.scene.find((card) => card.cardId === spec.target.id);
  const actions = state.log.map((entry) => entry.action);
  const store = useGameStateStore.getState();
  return {
    entered: { cardId: entered?.cardId, state: entered?.state },
    enterAbilityDrew: state.players.self.hand.includes(DRAW),
    orderedAfterEntry: actions.lastIndexOf('effect:draw') > actions.lastIndexOf('effect:sceneEnter'),
    originReleasedTarget: !state.players.self[spec.from].includes(spec.target.id),
    originRetainsDecoy: state.players.self[spec.from].includes(spec.decoy.id),
    allEffectsSettled: state.pendingEffects.every((entry) => entry.state === 'resolved'),
    pending: [store.pendingEffectPick, store.pendingEffectOptional, store.pendingEffectChoice],
    activeAction: store.activeActionId,
    runtime: state.pendingRuntimeState,
    parallel: spec.parallel ? spec.parallel.abilities : spec.source.abilities,
  };
}

function expected(spec: ActionEntryCase): unknown {
  return {
    entered: { cardId: spec.target.id, state: spec.enteredState },
    enterAbilityDrew: true,
    orderedAfterEntry: true,
    originReleasedTarget: true,
    originRetainsDecoy: true,
    allEffectsSettled: true,
    pending: [null, null, null],
    activeAction: null,
    runtime: undefined,
    parallel: spec.source.abilities,
  };
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

describe('effect entry official Q&A — action-triggered entries fire enter abilities', () => {
  it(`card:B02004:${QA}`, () => expect(prove(CASES.B02004!)).toEqual(expected(CASES.B02004!)));
  it('runs D10023 a1 through its physical public action source', () =>
    expect(prove(CASES.D10023!)).toEqual(expected(CASES.D10023!)));
  it('runs PR173 a1 through its physical public action source', () =>
    expect(prove(CASES.PR173!)).toEqual(expected(CASES.PR173!)));
  it(`card:B03030:${QA}`, () => expect(prove(CASES.B03030!)).toEqual(expected(CASES.B03030!)));
  it(`card:B03099:${QA}`, () => expect(prove(CASES.B03099!)).toEqual(expected(CASES.B03099!)));

  it('shared optional-decline guard settles the public action without an entry trigger', () => {
    const spec = CASES.B03099!;
    install(spec);
    const actionId = trigger(spec)!;
    const pending = pendingEntry(spec);
    expect(dispatchEngineAction(bindPendingDecision(pending, { type: 'effectPickResolve', pickedUid: null }))).toEqual({ ok: true });
    finishAction(actionId);
    const store = useGameStateStore.getState();
    expect(current().players.self.remove).toEqual([spec.target.id, spec.decoy.id]);
    expect(current().players.self.hand).not.toContain(DRAW);
    expect(current().pendingEffects.every((entry) => entry.state === 'resolved')).toBe(true);
    expect([store.pendingEffectPick, store.pendingEffectOptional, store.pendingEffectChoice, store.activeActionId]).toEqual([null, null, null, null]);
  });

  it('B03030 switches another character at a full scene; the entered character fires and the public action settles', () => {
    const spec = CASES.B03030!;
    install(spec, true);
    const actionId = trigger(spec);
    const pending = pendingEntry(spec);
    const target = pending.candidates.find((candidate) => candidate.cardId === spec.target.id)!;
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: target.uid, switchRemoveUid: 'full-1',
    }))).toEqual({ ok: true });
    finishAction(actionId);
    const state = current();
    const store = useGameStateStore.getState();
    expect(state.players.self.scene).toHaveLength(5);
    expect(state.players.self.scene.some((card) => card.uid === 'source')).toBe(true);
    expect(state.players.self.scene.some((card) => card.uid === 'full-1')).toBe(false);
    expect(state.players.self.remove).toContain(FILLER);
    expect(state.players.self.scene.find((card) => card.cardId === spec.target.id)?.state).toBe('sleep');
    expect(state.players.self.hand).toContain(DRAW);
    expect(state.pendingEffects.every((entry) => entry.state === 'resolved')).toBe(true);
    expect([store.pendingEffectPick, store.pendingEffectOptional, store.pendingEffectChoice, store.activeActionId]).toEqual([null, null, null, null]);
  });

  it('B03030 switching out the acting source aborts on the next public guard step without contact', () => {
    const spec = CASES.B03030!;
    const actionEnds: unknown[] = [];
    const unguarded: unknown[] = [];
    const guarded: unknown[] = [];
    const contacts: unknown[] = [];
    event.on('action:end', (_state, payload) => { actionEnds.push(payload); });
    event.on('action:unguarded', (_state, payload) => { unguarded.push(payload); });
    event.on('action:guarded', (_state, payload) => { guarded.push(payload); });
    event.on('contact:start', (_state, payload) => { contacts.push(payload); });
    install(spec, true);
    const actionId = trigger(spec);
    const pending = pendingEntry(spec);
    const target = pending.candidates.find((candidate) => candidate.cardId === spec.target.id)!;

    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: target.uid, switchRemoveUid: 'source',
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().activeActionId).toBe(actionId);
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });

    const state = current();
    expect(state.players.self.scene.some((card) => card.uid === 'source')).toBe(false);
    expect(state.players.self.remove).toContain(B03030.id);
    expect(state.players.self.scene.find((card) => card.cardId === spec.target.id)?.state).toBe('sleep');
    expect(state.players.self.hand).toContain(DRAW);
    expect(state.actionContexts).toEqual({});
    expect(useGameStateStore.getState().activeActionId).toBeNull();
    expect(actionEnds).toContainEqual(expect.objectContaining({ byUid: 'source', result: 'aborted' }));
    expect(unguarded).toEqual([]);
    expect(guarded).toEqual([]);
    expect(contacts).toEqual([]);
  });
});
