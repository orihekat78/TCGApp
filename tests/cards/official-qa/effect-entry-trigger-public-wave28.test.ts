// qa: card:B03068:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B04046:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:B06074:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:PR155:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:PR161:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:B07082:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B08091:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:B09075:27ff073e2f3b9eb933819c4bcbc76e3c6001c105e035c2ff1bcd753e249ade16
// Rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md,
// 19-special-rules.md, 20-color-and-switch.md, 25-qa-effects-resolution.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B03068 } from '@/cards/ct-p03/B03068';
import { B04046 } from '@/cards/ct-p04/B04046';
import { B06074 } from '@/cards/ct-p06/B06074';
import { B07082 } from '@/cards/ct-p07/B07082';
import { B08091 } from '@/cards/ct-p08/B08091';
import { B09075 } from '@/cards/ct-p09/B09075';
import { PR155 } from '@/cards/pr-01/PR155';
import { PR161 } from '@/cards/pr-01/PR161';
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

const QA = {
  B03068: 'd8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa',
  B04046: '56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f',
  B06074: '56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f',
  PR155: '56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f',
  PR161: '56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f',
  B07082: 'd8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa',
  B08091: '56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f',
  B09075: '27ff073e2f3b9eb933819c4bcbc76e3c6001c105e035c2ff1bcd753e249ade16',
} as const;
const DRAW = 'QA_W28_TRIGGER_DRAW';
const FILLER = 'QA_W28_TRIGGER_FILLER';

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

const sceneRemoveMarker: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
};

const RED_ENTRY = character('QA_W28_RED_ENTRY', { colors: ['赤'], level: 4, abilities: [enterDraw] });
const RED_HIGH = character('QA_W28_RED_HIGH', { colors: ['赤'], level: 5 });
const RED_EVENT = eventCard('QA_W28_RED_EVENT', { colors: ['赤'], level: 4 });
const RED_WRONG = character('QA_W28_RED_WRONG', { colors: ['緑'], level: 4 });
const FBI_ENTRY = character('QA_W28_FBI_ENTRY', { traits: ['FBI'], level: 6, abilities: [enterDraw] });
const FBI_HIGH = character('QA_W28_FBI_HIGH', { traits: ['FBI'], level: 7 });
const FBI_EVENT = eventCard('QA_W28_FBI_EVENT', { traits: ['FBI'], level: 6 });
const FBI_WRONG = character('QA_W28_FBI_WRONG', { level: 6 });
const AKAI_ENTRY = character('QA_W28_AKAI_ENTRY', { traits: ['赤井家'], level: 7, abilities: [enterDraw] });
const AKAI_HIGH = character('QA_W28_AKAI_HIGH', { traits: ['赤井家'], level: 8 });
const AKAI_EVENT = eventCard('QA_W28_AKAI_EVENT', { traits: ['赤井家'], level: 7 });
const AKAI_WRONG = character('QA_W28_AKAI_WRONG', { level: 7 });
const HAI_ENTRY = character('QA_W28_HAI_ENTRY', { names: ['灰原哀'], level: 6, abilities: [enterDraw] });
const HAI_HIGH = character('QA_W28_HAI_HIGH', { names: ['灰原哀'], level: 7 });
const HAI_EVENT = eventCard('QA_W28_HAI_EVENT', { names: ['灰原哀'], level: 6 });
const HAI_WRONG = character('QA_W28_HAI_WRONG', { level: 6 });
const SATO_ENTRY = character('QA_W28_SATO_ENTRY', { names: ['佐藤美和子'], level: 5, abilities: [enterDraw] });
const SATO_HIGH = character('QA_W28_SATO_HIGH', { names: ['佐藤美和子'], level: 6 });
const SATO_EVENT = eventCard('QA_W28_SATO_EVENT', { names: ['佐藤美和子'], level: 5 });
const SATO_WRONG = character('QA_W28_SATO_WRONG', { level: 5 });
const LEAVE_ENTRY = character('QA_W28_LEAVE_ENTRY', { level: 6, abilities: [enterDraw, sceneRemoveMarker] });
const LEAVE_HIGH = character('QA_W28_LEAVE_HIGH', { level: 7, abilities: [sceneRemoveMarker] });
const LEAVE_EVENT = eventCard('QA_W28_LEAVE_EVENT', { level: 6, abilities: [sceneRemoveMarker] });
const LEAVE_WRONG = character('QA_W28_LEAVE_WRONG', { level: 6 });
const POLICE_ENTRY = character('QA_W28_POLICE_ENTRY', { traits: ['警察'], level: 6, abilities: [enterDraw] });
const POLICE_HIGH = character('QA_W28_POLICE_HIGH', { traits: ['警察'], level: 7 });
const POLICE_EVENT = eventCard('QA_W28_POLICE_EVENT', { traits: ['警察'], level: 6 });
const POLICE_WRONG = character('QA_W28_POLICE_WRONG', { level: 6 });
const POLICE_GATE = character('QA_W28_POLICE_GATE', { traits: ['警視庁'], level: 7 });
const NONBLACK_GATE = character('QA_W28_NONBLACK_GATE', { colors: ['赤'], level: 1 });

const fixtures = [
  character(DRAW), character(FILLER), RED_ENTRY, RED_HIGH, RED_EVENT, RED_WRONG,
  FBI_ENTRY, FBI_HIGH, FBI_EVENT, FBI_WRONG, AKAI_ENTRY, AKAI_HIGH, AKAI_EVENT, AKAI_WRONG,
  HAI_ENTRY, HAI_HIGH, HAI_EVENT, HAI_WRONG, SATO_ENTRY, SATO_HIGH, SATO_EVENT, SATO_WRONG,
  LEAVE_ENTRY, LEAVE_HIGH, LEAVE_EVENT, LEAVE_WRONG,
  POLICE_ENTRY, POLICE_HIGH, POLICE_EVENT, POLICE_WRONG,
  POLICE_GATE, NONBLACK_GATE,
] as const;

type EntryCase = {
  source: CardDef;
  abilityId: string;
  target: CardDef;
  decoys: readonly CardDef[];
  from: 'hand' | 'remove';
  targetState: 'active' | 'sleep';
  targetStartsOnDeck?: boolean;
  configure?: (state: GameState) => void;
};

const CASES = {
  B03068: { source: B03068, abilityId: 'a1', target: RED_ENTRY, decoys: [RED_HIGH, RED_EVENT, RED_WRONG], from: 'hand', targetState: 'sleep' },
  B04046: { source: B04046, abilityId: 'a2', target: FBI_ENTRY, decoys: [FBI_HIGH, FBI_EVENT, FBI_WRONG], from: 'hand', targetState: 'active', targetStartsOnDeck: true },
  B06074: { source: B06074, abilityId: 'a1', target: AKAI_ENTRY, decoys: [AKAI_HIGH, AKAI_EVENT, AKAI_WRONG], from: 'hand', targetState: 'active', targetStartsOnDeck: true },
  PR155: { source: PR155, abilityId: 'a1', target: HAI_ENTRY, decoys: [HAI_HIGH, HAI_EVENT, HAI_WRONG], from: 'hand', targetState: 'sleep' },
  PR161: { source: PR161, abilityId: 'a1', target: HAI_ENTRY, decoys: [HAI_HIGH, HAI_EVENT, HAI_WRONG], from: 'hand', targetState: 'sleep' },
  B07082: {
    source: B07082, abilityId: 'a1', target: SATO_ENTRY, decoys: [SATO_HIGH, SATO_EVENT, SATO_WRONG], from: 'remove', targetState: 'sleep',
    configure: state => { state.players.self.scene = [makeChar({ cardId: POLICE_GATE.id, uid: 'police-gate' })]; },
  },
  B08091: {
    source: B08091, abilityId: 'a1', target: LEAVE_ENTRY, decoys: [LEAVE_HIGH, LEAVE_EVENT, LEAVE_WRONG], from: 'remove', targetState: 'sleep',
    configure: state => {
      state.players.self.case.colors = ['青', '黒'];
      state.players.self.scene = [makeChar({ cardId: NONBLACK_GATE.id, uid: 'nonblack-gate' })];
    },
  },
  B09075: { source: B09075, abilityId: 'a1', target: POLICE_ENTRY, decoys: [POLICE_HIGH, POLICE_EVENT, POLICE_WRONG], from: 'remove', targetState: 'active' },
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
  state.players.self.hand = [entryCase.source.id];
  state.players.self.deck = [DRAW, DRAW, DRAW, DRAW, FILLER];
  state.players.opp.deck = [FILLER, FILLER];
  state.players.self.file = Array.from({ length: 12 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
  if (entryCase.from === 'hand') {
    state.players.self.hand.push(...entryCase.decoys.map(card => card.id));
    if (entryCase.targetStartsOnDeck) state.players.self.deck.unshift(entryCase.target.id);
    else state.players.self.hand.push(entryCase.target.id);
  }
  else state.players.self.remove = [entryCase.target.id, ...entryCase.decoys.map(card => card.id)];
  entryCase.configure?.(state);
  return state;
}

function install(state: GameState, label: string): void {
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingEntry(entryCase: EntryCase) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  if (entryCase.targetStartsOnDeck) {
    expect(current().players.self.hand, `${entryCase.source.id}: source draw creates candidate`)
      .toContain(entryCase.target.id);
  }
  expect(pending, `${entryCase.source.id}: sceneEnter authority`).toMatchObject({
    player: 'self', atomVerb: 'sceneEnter',
    source: { cardId: entryCase.source.id, abilityId: entryCase.abilityId },
  });
  expect(pending!.nMin, `${entryCase.source.id}: up-to-one minimum`).toBe(0);
  expect(pending!.candidates.map(item => item.cardId), `${entryCase.source.id}: typed candidates`)
    .toEqual([entryCase.target.id]);
  return pending!;
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
  install(base(entryCase), `qa-w28-${entryCase.source.id}`);
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: entryCase.source.id }))
    .toEqual({ ok: true });
  const pending = pendingEntry(entryCase);
  const candidate = pending.candidates.find(item => item.cardId === entryCase.target.id)!;
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: candidate.uid,
  }))).toEqual({ ok: true });

  const state = current();
  const sourceArea = entryCase.from === 'hand' ? state.players.self.hand : state.players.self.remove;
  const actions = state.log.map(item => item.action);
  return {
    source: entryCase.source.id,
    target: entryCase.target.id,
    sourceInScene: state.players.self.scene.some(item => item.cardId === entryCase.source.id),
    targetState: state.players.self.scene.find(item => item.cardId === entryCase.target.id)?.state,
    targetEnterEffects: state.pendingEffects
      .filter(item => item.source.cardId === entryCase.target.id && item.source.abilityId === enterDraw.id)
      .map(item => item.state),
    targetLeftSource: !sourceArea.includes(entryCase.target.id),
    decoysRemain: entryCase.decoys.every(card => sourceArea.includes(card.id)),
    drawAfterEntry: actions.lastIndexOf('effect:draw') > actions.lastIndexOf('effect:sceneEnter'),
    effectActions: actions.filter(action => action === 'effect:draw' || action === 'effect:sceneEnter'),
    drawCards: state.players.self.hand.filter(cardId => cardId === DRAW).length,
    fallbackEvidence: state.players.opp.evidence.length,
    settled: expectSettled(entryCase.source.id),
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

describe('effect entry official Q&A — Wave 28 triggered public paths', () => {
  it(`card:B03068:${QA.B03068}: red hand entry fires after the source enters`, () => {
    expect(prove(CASES.B03068)).toMatchObject({
      source: 'B03068', target: RED_ENTRY.id, targetState: 'sleep', targetEnterEffects: ['resolved'],
      sourceInScene: true, targetLeftSource: true, decoysRemain: true, drawAfterEntry: true,
      effectActions: ['effect:sceneEnter', 'effect:draw'], drawCards: 1, fallbackEvidence: 0, settled: true,
    });
  });

  it(`card:B04046:${QA.B04046}: FBI hand entry fires after the source draw`, () => {
    expect(prove(CASES.B04046)).toMatchObject({
      source: 'B04046', target: FBI_ENTRY.id, targetState: 'active', targetEnterEffects: ['resolved'],
      sourceInScene: true, targetLeftSource: true, decoysRemain: true, drawAfterEntry: true,
      effectActions: ['effect:draw', 'effect:sceneEnter', 'effect:draw'], drawCards: 1, settled: true,
    });
  });

  it(`card:B06074:${QA.B06074}: Akai-family hand entry fires after the source draw`, () => {
    expect(prove(CASES.B06074)).toMatchObject({
      source: 'B06074', target: AKAI_ENTRY.id, targetState: 'active', targetEnterEffects: ['resolved'],
      sourceInScene: true, targetLeftSource: true, decoysRemain: true, drawAfterEntry: true,
      effectActions: ['effect:draw', 'effect:sceneEnter', 'effect:draw'], drawCards: 1, settled: true,
    });
  });

  it(`card:PR155:${QA.PR155}: sleeping Haibara hand entry fires before the source draw`, () => {
    expect(prove(CASES.PR155)).toMatchObject({
      source: 'PR155', target: HAI_ENTRY.id, targetState: 'sleep', targetEnterEffects: ['resolved'],
      sourceInScene: true, targetLeftSource: true, decoysRemain: true, drawAfterEntry: true,
      effectActions: ['effect:sceneEnter', 'effect:draw', 'effect:draw'], drawCards: 2, settled: true,
    });
  });

  it(`card:PR161:${QA.PR161}: alternate sleeping Haibara entry fires before the source draw`, () => {
    expect(prove(CASES.PR161)).toMatchObject({
      source: 'PR161', target: HAI_ENTRY.id, targetState: 'sleep', targetEnterEffects: ['resolved'],
      sourceInScene: true, targetLeftSource: true, decoysRemain: true, drawAfterEntry: true,
      effectActions: ['effect:sceneEnter', 'effect:draw', 'effect:draw'], drawCards: 2, settled: true,
    });
  });

  it(`card:B07082:${QA.B07082}: conditional Sato remove entry fires in sleep state`, () => {
    expect(prove(CASES.B07082)).toMatchObject({
      source: 'B07082', target: SATO_ENTRY.id, targetState: 'sleep', targetEnterEffects: ['resolved'],
      sourceInScene: true, targetLeftSource: true, decoysRemain: true, drawAfterEntry: true,
      effectActions: ['effect:sceneEnter', 'effect:draw'], drawCards: 1, settled: true,
    });
  });

  it(`card:B08091:${QA.B08091}: case-gated leave-keyword remove entry fires in sleep state`, () => {
    expect(prove(CASES.B08091)).toMatchObject({
      source: 'B08091', target: LEAVE_ENTRY.id, targetState: 'sleep', targetEnterEffects: ['resolved'],
      sourceInScene: true, targetLeftSource: true, decoysRemain: true, drawAfterEntry: true,
      effectActions: ['effect:sceneEnter', 'effect:draw'], drawCards: 1, settled: true,
    });
  });

  it(`card:B09075:${QA.B09075}: first-entry Shippu reanimates Police and fires its entry`, () => {
    expect(prove(CASES.B09075)).toMatchObject({
      source: 'B09075', target: POLICE_ENTRY.id, targetState: 'active', targetEnterEffects: ['resolved'],
      sourceInScene: true, targetLeftSource: true, decoysRemain: true, drawAfterEntry: true,
      effectActions: ['effect:sceneEnter', 'effect:draw'], drawCards: 1, settled: true,
    });
  });

  it('B03068 explicit decline takes its mandatory fallback and does not fire the candidate', () => {
    install(base(CASES.B03068), 'qa-w28-B03068-decline');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B03068.id })).toEqual({ ok: true });
    const pending = pendingEntry(CASES.B03068);
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    expect(current().players.self.scene.some(item => item.cardId === RED_ENTRY.id)).toBe(false);
    expect(current().players.self.hand).toEqual(expect.arrayContaining([RED_ENTRY.id, DRAW]));
    expect(current().players.opp.evidence).toHaveLength(1);
    expect(current().pendingEffects.some(item => item.source.cardId === RED_ENTRY.id)).toBe(false);
    expectSettled('B03068 decline');
  });

  it('B09075 zero candidates auto-skips without leaking public authority', () => {
    const state = base(CASES.B09075);
    state.players.self.remove = [];
    install(state, 'qa-w28-B09075-empty');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B09075.id })).toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.scene.some(item => item.cardId === POLICE_ENTRY.id)).toBe(false);
    expectSettled('B09075 empty');
  });

  it('B03068 zero candidates exposes a zero-pick decision, then runs its mandatory fallback', () => {
    const state = base(CASES.B03068);
    state.players.self.hand = [B03068.id];
    install(state, 'qa-w28-B03068-empty');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B03068.id })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending).toMatchObject({
      candidates: [], nMin: 0, nMax: 0, skipResolvesAtom: true,
      source: { cardId: B03068.id, abilityId: 'a1' },
    });
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    expect(current().players.opp.evidence).toHaveLength(1);
    expect(current().players.self.hand).toContain(DRAW);
    expectSettled('B03068 empty');
  });

  it('PR155 explicit decline still completes its required source draw', () => {
    install(base(CASES.PR155), 'qa-w28-PR155-decline');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: PR155.id })).toEqual({ ok: true });
    const pending = pendingEntry(CASES.PR155);
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    expect(current().players.self.scene.some(item => item.cardId === HAI_ENTRY.id)).toBe(false);
    expect(current().players.self.hand).toEqual(expect.arrayContaining([HAI_ENTRY.id, DRAW]));
    expect(current().pendingEffects.some(item => item.source.cardId === HAI_ENTRY.id)).toBe(false);
    expectSettled('PR155 decline');
  });
});
