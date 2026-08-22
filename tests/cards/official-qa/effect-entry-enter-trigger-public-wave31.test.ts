// qa: card:B03085:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B06018:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:B06052:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:B06090:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:B09048:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:B09057:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:PR138:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:PR144:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// Rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md,
// 20-color-and-switch.md, 25-qa-effects-resolution.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B03085 } from '@/cards/ct-p03/B03085';
import { B06018 } from '@/cards/ct-p06/B06018';
import { B06052 } from '@/cards/ct-p06/B06052';
import { B06090 } from '@/cards/ct-p06/B06090';
import { B09048 } from '@/cards/ct-p09/B09048';
import { B09057 } from '@/cards/ct-p09/B09057';
import { PR138 } from '@/cards/pr-01/PR138';
import { PR144 } from '@/cards/pr-01/PR144';
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

const QA = {
  B03085: 'd8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa',
  B06018: '56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f',
  B06052: '56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f',
  B06090: '56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f',
  B09048: '56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f',
  B09057: '56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f',
  PR138: '56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f',
  PR144: '56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f',
} as const;

const DRAW = 'QA_W31_TRIGGER_DRAW';
const FILLER = 'QA_W31_FILLER';
const COST = 'QA_W31_DISCARD_COST';

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

const POLICE_ENTRY = card('QA_W31_POLICE_ENTRY', {
  colors: ['黄'], traits: ['警察'], level: 6, abilities: [enterDraw],
});
const POLICE_PAID_ENTRY = card('QA_W31_POLICE_PAID_ENTRY', {
  colors: ['黄'], traits: ['警察'], level: 5, abilities: [enterDraw],
});
const POLICE_HIGH = card('QA_W31_POLICE_HIGH', { colors: ['黄'], traits: ['警察'], level: 7 });
const POLICE_EVENT = card('QA_W31_POLICE_EVENT', { kind: 'event', colors: ['黄'], traits: ['警察'], level: 6 });
const POLICE_WRONG = card('QA_W31_POLICE_WRONG', { colors: ['黄'], level: 6 });
const YAIBA_ENTRY = card('QA_W31_YAIBA_ENTRY', { traits: ['YAIBA'], level: 5, abilities: [enterDraw] });
const YAIBA_HIGH = card('QA_W31_YAIBA_HIGH', { traits: ['YAIBA'], level: 7 });
const YAIBA_EVENT = card('QA_W31_YAIBA_EVENT', { kind: 'event', traits: ['YAIBA'], level: 5 });
const YAIBA_WRONG = card('QA_W31_YAIBA_WRONG', { level: 5 });
const POARO_ENTRY = card('QA_W31_POARO_ENTRY', { traits: ['喫茶ポアロ'], level: 5, abilities: [enterDraw] });
const POARO_HIGH = card('QA_W31_POARO_HIGH', { traits: ['喫茶ポアロ'], level: 6 });
const POARO_EVENT = card('QA_W31_POARO_EVENT', { kind: 'event', traits: ['喫茶ポアロ'], level: 5 });
const POARO_WRONG = card('QA_W31_POARO_WRONG', { level: 5 });
const BLACK_ENTRY = card('QA_W31_BLACK_ENTRY', { colors: ['黒'], level: 6, abilities: [enterDraw] });
const BLACK_HIGH = card('QA_W31_BLACK_HIGH', { colors: ['黒'], level: 7 });
const BLACK_EVENT = card('QA_W31_BLACK_EVENT', { kind: 'event', colors: ['黒'], level: 6 });
const BLACK_WRONG = card('QA_W31_BLACK_WRONG', { colors: ['赤'], level: 6 });
const ORG_ENTRY = card('QA_W31_ORG_ENTRY', { traits: ['黒ずくめの組織'], level: 6, abilities: [enterDraw] });
const ORG_HIGH = card('QA_W31_ORG_HIGH', { traits: ['黒ずくめの組織'], level: 7 });
const ORG_EVENT = card('QA_W31_ORG_EVENT', { kind: 'event', traits: ['黒ずくめの組織'], level: 6 });
const ORG_WRONG = card('QA_W31_ORG_WRONG', { level: 6 });
const YAIBA_CASE = card('QA_W31_YAIBA_CASE', { kind: 'case', caseTraits: ['YAIBA'] });
const NON_YAIBA_CASE = card('QA_W31_NON_YAIBA_CASE', { kind: 'case', caseTraits: [] });

const fixtures = [
  card(DRAW), card(FILLER), card(COST), YAIBA_CASE, NON_YAIBA_CASE,
  POLICE_ENTRY, POLICE_PAID_ENTRY, POLICE_HIGH, POLICE_EVENT, POLICE_WRONG,
  YAIBA_ENTRY, YAIBA_HIGH, YAIBA_EVENT, YAIBA_WRONG,
  POARO_ENTRY, POARO_HIGH, POARO_EVENT, POARO_WRONG,
  BLACK_ENTRY, BLACK_HIGH, BLACK_EVENT, BLACK_WRONG,
  ORG_ENTRY, ORG_HIGH, ORG_EVENT, ORG_WRONG,
] as const;

type EntryCase = {
  source: CardDef;
  target: CardDef;
  decoys: readonly CardDef[];
  from: 'hand' | 'remove';
  targetState: 'active' | 'sleep';
  sourceState: 'active' | 'sleep';
  optional: boolean;
  discard: boolean;
  configure?: (state: GameState) => void;
};

const POLICE_DECOYS = [POLICE_HIGH, POLICE_EVENT, POLICE_WRONG] as const;
const YAIBA_DECOYS = [YAIBA_HIGH, YAIBA_EVENT, YAIBA_WRONG] as const;
const POARO_DECOYS = [POARO_HIGH, POARO_EVENT, POARO_WRONG] as const;
const BLACK_DECOYS = [BLACK_HIGH, BLACK_EVENT, BLACK_WRONG] as const;
const ORG_DECOYS = [ORG_HIGH, ORG_EVENT, ORG_WRONG] as const;

const CASES = {
  B03085: { source: B03085, target: POLICE_ENTRY, decoys: POLICE_DECOYS, from: 'remove', targetState: 'sleep', sourceState: 'active', optional: true, discard: true },
  B06018: {
    source: B06018, target: YAIBA_ENTRY, decoys: YAIBA_DECOYS, from: 'remove', targetState: 'active', sourceState: 'active', optional: true, discard: true,
    configure: state => { state.players.self.case.cardId = YAIBA_CASE.id; },
  },
  B06052: { source: B06052, target: YAIBA_ENTRY, decoys: YAIBA_DECOYS, from: 'remove', targetState: 'sleep', sourceState: 'active', optional: true, discard: true },
  B06090: { source: B06090, target: POARO_ENTRY, decoys: POARO_DECOYS, from: 'remove', targetState: 'active', sourceState: 'sleep', optional: true, discard: false },
  B09048: { source: B09048, target: POLICE_ENTRY, decoys: POLICE_DECOYS, from: 'remove', targetState: 'sleep', sourceState: 'active', optional: false, discard: true },
  B09057: { source: B09057, target: BLACK_ENTRY, decoys: BLACK_DECOYS, from: 'hand', targetState: 'active', sourceState: 'sleep', optional: true, discard: false },
  PR138: { source: PR138, target: ORG_ENTRY, decoys: ORG_DECOYS, from: 'remove', targetState: 'active', sourceState: 'sleep', optional: true, discard: true },
  PR144: { source: PR144, target: ORG_ENTRY, decoys: ORG_DECOYS, from: 'remove', targetState: 'active', sourceState: 'sleep', optional: true, discard: true },
} as const satisfies Record<string, EntryCase>;

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function base(entryCase: EntryCase): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 7, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.turnState.self.enterCountThisTurn = 0;
  state.players.self.case.colors = [...entryCase.source.colors];
  state.players.self.case.status = '解決編';
  state.players.self.file = Array.from({ length: 12 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
  state.players.self.deck = [DRAW, DRAW, DRAW, DRAW];
  state.players.opp.deck = [FILLER, FILLER];
  state.players.self.hand = [entryCase.source.id];
  if (entryCase.discard) state.players.self.hand.push(COST);
  if (entryCase.from === 'hand') {
    state.players.self.hand.push(entryCase.target.id, ...entryCase.decoys.map(item => item.id));
    state.players.opp.hand = [entryCase.target.id];
  } else {
    state.players.self.remove = [entryCase.target.id, ...entryCase.decoys.map(item => item.id)];
    state.players.opp.remove = [entryCase.target.id];
  }
  entryCase.configure?.(state);
  return state;
}

function install(state: GameState, label: string): void {
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(entryCase: EntryCase, atomVerb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${entryCase.source.id}: ${atomVerb} authority`).toMatchObject({
    player: 'self', atomVerb,
    source: { cardId: entryCase.source.id, abilityId: 'a1' },
  });
  return pending!;
}

function acceptOptional(entryCase: EntryCase): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  if (!entryCase.optional) {
    expect(pending, `${entryCase.source.id}: no outer optional`).toBeNull();
    return;
  }
  expect(pending?.source, `${entryCase.source.id}: optional authority`).toMatchObject({
    cardId: entryCase.source.id, abilityId: 'a1',
  });
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'optionalResolve', run: true,
  }))).toEqual({ ok: true });
}

function resolveDiscard(entryCase: EntryCase): void {
  if (!entryCase.discard) return;
  const pending = pendingPick(entryCase, 'discard');
  const cost = pending.candidates.find(item => item.cardId === COST);
  expect(cost, `${entryCase.source.id}: discard candidate`).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: cost!.uid,
  }))).toEqual({ ok: true });
}

function expectSettled(label: string): true {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  expect({
    pick: store.pendingEffectPick !== null,
    choice: store.pendingEffectChoice !== null,
    optional: store.pendingEffectOptional !== null,
    reveal: store.pendingDeckReveal !== null,
    reorder: store.pendingDeckReorder !== null,
    action: store.activeActionId !== null,
    runtime: current().pendingRuntimeState !== undefined,
    activeEffects: current().pendingEffects.filter(item => item.state !== 'resolved').length,
  }, `${label}: public lifecycle`).toEqual({
    pick: false, choice: false, optional: false, reveal: false,
    reorder: false, action: false, runtime: false, activeEffects: 0,
  });
  return true;
}

function prove(entryCase: EntryCase) {
  install(base(entryCase), `qa-w31-${entryCase.source.id}`);
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: entryCase.source.id }))
    .toEqual({ ok: true });
  acceptOptional(entryCase);
  resolveDiscard(entryCase);

  const pending = pendingPick(entryCase, 'sceneEnter');
  expect(pending.nMin, `${entryCase.source.id}: up-to-one minimum`).toBe(0);
  expect(pending.candidates.map(item => item.cardId), `${entryCase.source.id}: typed candidates`)
    .toEqual([entryCase.target.id]);
  const foreignUid = `card:opp:${entryCase.from}:${entryCase.target.id}#0`;
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: foreignUid,
  })), `${entryCase.source.id}: reject foreign-zone UID`).toMatchObject({ ok: false });
  const retained = pendingPick(entryCase, 'sceneEnter');
  expect(retained.candidates.map(item => item.cardId), `${entryCase.source.id}: authority retained`)
    .toEqual([entryCase.target.id]);
  const candidate = retained.candidates.find(item => item.cardId === entryCase.target.id)!;
  expect(dispatchEngineAction(bindPendingDecision(retained, {
    type: 'effectPickResolve', pickedUid: candidate.uid,
  }))).toEqual({ ok: true });

  const state = current();
  const sourceArea = entryCase.from === 'hand' ? state.players.self.hand : state.players.self.remove;
  const actions = state.log.map(item => item.action);
  return {
    source: entryCase.source.id,
    target: entryCase.target.id,
    sourceInScene: state.players.self.scene.some(item => item.cardId === entryCase.source.id),
    sourceState: state.players.self.scene.find(item => item.cardId === entryCase.source.id)?.state,
    targetState: state.players.self.scene.find(item => item.cardId === entryCase.target.id)?.state,
    targetEnterEffects: state.pendingEffects
      .filter(item => item.source.cardId === entryCase.target.id && item.source.abilityId === enterDraw.id)
      .map(item => item.state),
    targetLeftSource: !sourceArea.includes(entryCase.target.id),
    decoysRemain: entryCase.decoys.every(item => sourceArea.includes(item.id)),
    costRemoved: state.players.self.remove.includes(COST),
    drawAfterEntry: actions.lastIndexOf('effect:draw') > actions.lastIndexOf('effect:sceneEnter'),
    effectActions: actions.filter(action => action === 'effect:sceneEnter' || action === 'effect:draw'),
    drawCards: state.players.self.hand.filter(cardId => cardId === DRAW).length,
    settled: expectSettled(entryCase.source.id),
  };
}

function proof(entryCase: EntryCase) {
  return {
    source: entryCase.source.id,
    target: entryCase.target.id,
    sourceInScene: true,
    sourceState: entryCase.sourceState,
    targetState: entryCase.targetState,
    targetEnterEffects: ['resolved'],
    targetLeftSource: true,
    decoysRemain: true,
    costRemoved: entryCase.discard,
    drawAfterEntry: true,
    effectActions: ['effect:sceneEnter', 'effect:draw'],
    drawCards: 1,
    settled: true,
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

describe('effect entry official Q&A — Wave 31 enter-triggered public paths', () => {
  it(`card:B03085:${QA.B03085}: Police reanimation fires the entered character`, () => {
    expect(prove(CASES.B03085)).toEqual(proof(CASES.B03085));
  });

  it(`card:B06018:${QA.B06018}: YAIBA reanimation fires the entered character`, () => {
    expect(prove(CASES.B06018)).toEqual(proof(CASES.B06018));
  });

  it(`card:B06052:${QA.B06052}: sleeping YAIBA reanimation fires the entered character`, () => {
    expect(prove(CASES.B06052)).toEqual(proof(CASES.B06052));
  });

  it(`card:B06090:${QA.B06090}: self-sleep Poaro reanimation fires the entered character`, () => {
    expect(prove(CASES.B06090)).toEqual(proof(CASES.B06090));
  });

  it(`card:B09048:${QA.B09048}: yellow Police reanimation fires the entered character`, () => {
    expect(prove(CASES.B09048)).toEqual(proof(CASES.B09048));
  });

  it(`card:B09057:${QA.B09057}: self-sleep black hand entry fires the entered character`, () => {
    expect(prove(CASES.B09057)).toEqual(proof(CASES.B09057));
  });

  it(`card:PR138:${QA.PR138}: Rum reanimation fires the entered character`, () => {
    expect(prove(CASES.PR138)).toEqual(proof(CASES.PR138));
  });

  it(`card:PR144:${QA.PR144}: alternate Rum printing fires the entered character`, () => {
    expect(prove(CASES.PR144)).toEqual(proof(CASES.PR144));
  });

  it('B03085 may discard an eligible Police character and immediately enter that new remove candidate', () => {
    const entryCase = CASES.B03085;
    const state = base(entryCase);
    state.players.self.hand = [entryCase.source.id, POLICE_PAID_ENTRY.id];
    state.players.self.remove = entryCase.decoys.map(item => item.id);
    state.players.opp.remove = [POLICE_PAID_ENTRY.id];
    install(state, 'qa-w31-B03085-paid-candidate');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: entryCase.source.id })).toEqual({ ok: true });
    acceptOptional(entryCase);
    const discard = pendingPick(entryCase, 'discard');
    const paid = discard.candidates.find(item => item.cardId === POLICE_PAID_ENTRY.id);
    expect(discard.candidates.map(item => item.cardId)).toEqual([POLICE_PAID_ENTRY.id]);
    expect(dispatchEngineAction(bindPendingDecision(discard, {
      type: 'effectPickResolve', pickedUid: paid!.uid,
    }))).toEqual({ ok: true });
    const entry = pendingPick(entryCase, 'sceneEnter');
    expect(entry.candidates.map(item => item.cardId)).toEqual([POLICE_PAID_ENTRY.id]);
    const candidate = entry.candidates[0]!;
    expect(dispatchEngineAction(bindPendingDecision(entry, {
      type: 'effectPickResolve', pickedUid: candidate.uid,
    }))).toEqual({ ok: true });
    expect(current().players.self.scene.find(item => item.cardId === POLICE_PAID_ENTRY.id)?.state).toBe('sleep');
    expect(current().players.self.remove).not.toContain(POLICE_PAID_ENTRY.id);
    expect(current().pendingEffects
      .filter(item => item.source.cardId === POLICE_PAID_ENTRY.id && item.source.abilityId === enterDraw.id)
      .map(item => item.state)).toEqual(['resolved']);
    expect(current().players.self.hand).toContain(DRAW);
    expect(expectSettled('B03085-paid-candidate')).toBe(true);
  });

  it('B06018 without a YAIBA case does not offer its conditional discard or entry', () => {
    const entryCase = CASES.B06018;
    const state = base(entryCase);
    state.players.self.case.cardId = NON_YAIBA_CASE.id;
    install(state, 'qa-w31-B06018-non-YAIBA-case');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: entryCase.source.id })).toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.hand).toContain(COST);
    expect(current().players.self.remove).toContain(entryCase.target.id);
    expect(current().players.self.hand).not.toContain(DRAW);
    expect(expectSettled('B06018-non-YAIBA-case')).toBe(true);
  });

  it('B03085 permits zero entry after paying the optional discard', () => {
    const entryCase = CASES.B03085;
    install(base(entryCase), 'qa-w31-B03085-zero');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: entryCase.source.id })).toEqual({ ok: true });
    acceptOptional(entryCase);
    resolveDiscard(entryCase);
    const pending = pendingPick(entryCase, 'sceneEnter');
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    expect(current().players.self.remove).toContain(entryCase.target.id);
    expect(current().players.self.scene.some(item => item.cardId === entryCase.target.id)).toBe(false);
    expect(current().players.self.hand).not.toContain(DRAW);
    expect(expectSettled('B03085-zero')).toBe(true);
  });

  it('B06090 declines the optional self-sleep and does not surface an entry choice', () => {
    const entryCase = CASES.B06090;
    install(base(entryCase), 'qa-w31-B06090-decline');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: entryCase.source.id })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectOptional;
    expect(pending?.source.cardId).toBe(entryCase.source.id);
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'optionalResolve', run: false,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.scene.find(item => item.cardId === entryCase.source.id)?.state).toBe('active');
    expect(current().players.self.remove).toContain(entryCase.target.id);
    expect(current().players.self.hand).not.toContain(DRAW);
    expect(expectSettled('B06090-decline')).toBe(true);
  });

  it('B09048 does not continue to scene entry when its optional discard picks zero cards', () => {
    const entryCase = CASES.B09048;
    install(base(entryCase), 'qa-w31-B09048-discard-decline');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: entryCase.source.id })).toEqual({ ok: true });
    acceptOptional(entryCase);
    const discard = pendingPick(entryCase, 'discard');
    expect(discard.nMin).toBe(0);
    expect(dispatchEngineAction(bindPendingDecision(discard, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.remove).toContain(entryCase.target.id);
    expect(current().players.self.scene.some(item => item.cardId === entryCase.target.id)).toBe(false);
    expect(current().players.self.hand).not.toContain(DRAW);
    expect(expectSettled('B09048-discard-decline')).toBe(true);
  });
});
