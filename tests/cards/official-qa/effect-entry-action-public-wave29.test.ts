// qa: card:B03073:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B04030:b2bb0991c56c38c14055ec3a8e4b107d7c47811f912761d8d1fe387311bfe17e
// qa: card:B04068:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B05048:0527d3a5875b73026cd5b7444b01f9623fe27836b1fdaccf6f52940e88673d38
// qa: card:B05108:5085f22fae79de3e6cef7678e8a62dd31b9b2b3c92979669e3667be7a63db84c
// qa: card:B06077:b2bb0991c56c38c14055ec3a8e4b107d7c47811f912761d8d1fe387311bfe17e
// qa: card:PR086:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:PR092:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// Rules: 03-field-areas.md, 07-action-flow.md, 15-abilities-effects.md,
// 17-icons.md, 20-color-and-switch.md, 22-qa-action-contact.md, 25-qa-effects-resolution.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B03073 } from '@/cards/ct-p03/B03073';
import { B04030 } from '@/cards/ct-p04/B04030';
import { B04068 } from '@/cards/ct-p04/B04068';
import { B05048 } from '@/cards/ct-p05/B05048';
import { B05108 } from '@/cards/ct-p05/B05108';
import { B06077 } from '@/cards/ct-p06/B06077';
import { PR086 } from '@/cards/pr-01/PR086';
import { PR092 } from '@/cards/pr-01/PR092';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA = {
  B03073: 'd8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa',
  B04030: 'b2bb0991c56c38c14055ec3a8e4b107d7c47811f912761d8d1fe387311bfe17e',
  B04068: 'd8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa',
  B05048: '0527d3a5875b73026cd5b7444b01f9623fe27836b1fdaccf6f52940e88673d38',
  B05108: '5085f22fae79de3e6cef7678e8a62dd31b9b2b3c92979669e3667be7a63db84c',
  B06077: 'b2bb0991c56c38c14055ec3a8e4b107d7c47811f912761d8d1fe387311bfe17e',
  PR086: 'd8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa',
  PR092: 'd8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa',
} as const;

const DRAW = 'QA_W29_ACTION_DRAW';
const FILLER = 'QA_W29_ACTION_FILLER';
const ACTION_TARGET = 'QA_W29_ACTION_TARGET';

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

const LOW_ENTRY = character('QA_W29_LOW_ENTRY', { level: 4, abilities: [enterDraw] });
const LOW_HIGH = character('QA_W29_LOW_HIGH', { level: 5 });
const LOW_EVENT = eventCard('QA_W29_LOW_EVENT', { level: 4 });
const LOW_HIGH_TWO = character('QA_W29_LOW_HIGH_TWO', { level: 6 });
const KID_ENTRY = character('QA_W29_KID_ENTRY', { names: ['怪盗キッド'], level: 8, abilities: [enterDraw] });
const KID_HIGH = character('QA_W29_KID_HIGH', { names: ['怪盗キッド'], level: 9 });
const KID_KUROBA = character('QA_W29_KID_KUROBA', { names: ['黒羽快斗'], level: 8 });
const KID_EVENT = eventCard('QA_W29_KID_EVENT', { names: ['怪盗キッド'], level: 8 });
const POIROT_ENTRY = character('QA_W29_POIROT_ENTRY', { traits: ['喫茶ポアロ'], level: 7, abilities: [enterDraw] });
const POIROT_HIGH = character('QA_W29_POIROT_HIGH', { traits: ['喫茶ポアロ'], level: 8 });
const POIROT_WRONG = character('QA_W29_POIROT_WRONG', { level: 7 });
const POIROT_EVENT = eventCard('QA_W29_POIROT_EVENT', { traits: ['喫茶ポアロ'], level: 7 });
const WHITE_ENTRY = character('QA_W29_WHITE_ENTRY', { colors: ['白'], level: 5, abilities: [enterDraw] });
const WHITE_HIGH = character('QA_W29_WHITE_HIGH', { colors: ['白'], level: 6 });
const WHITE_WRONG = character('QA_W29_WHITE_WRONG', { colors: ['黒'], level: 5 });
const WHITE_EVENT = eventCard('QA_W29_WHITE_EVENT', { colors: ['白'], level: 5 });
const BLACK_ENTRY = character('QA_W29_BLACK_ENTRY', { colors: ['黒'], level: 7, abilities: [enterDraw] });
const BLACK_HIGH = character('QA_W29_BLACK_HIGH', { colors: ['黒'], level: 8 });
const BLACK_WRONG = character('QA_W29_BLACK_WRONG', { colors: ['赤'], level: 7 });
const BLACK_EVENT = eventCard('QA_W29_BLACK_EVENT', { colors: ['黒'], level: 7 });
const FBI_ENTRY = character('QA_W29_FBI_ENTRY', { traits: ['FBI'], level: 6, abilities: [enterDraw] });
const FBI_HIGH = character('QA_W29_FBI_HIGH', { traits: ['FBI'], level: 7 });
const FBI_WRONG = character('QA_W29_FBI_WRONG', { level: 6 });
const FBI_EVENT = eventCard('QA_W29_FBI_EVENT', { traits: ['FBI'], level: 6 });
const POLICE_ENTRY = character('QA_W29_POLICE_ENTRY', { traits: ['警察'], level: 6, abilities: [enterDraw] });
const POLICE_HIGH = character('QA_W29_POLICE_HIGH', { traits: ['警察'], level: 7 });
const POLICE_WRONG = character('QA_W29_POLICE_WRONG', { level: 6 });
const POLICE_EVENT = eventCard('QA_W29_POLICE_EVENT', { traits: ['警察'], level: 6 });

const fixtures = [
  character(DRAW), character(FILLER), character(ACTION_TARGET, { ap: 9000 }),
  LOW_ENTRY, LOW_HIGH, LOW_EVENT, LOW_HIGH_TWO,
  KID_ENTRY, KID_HIGH, KID_KUROBA, KID_EVENT,
  POIROT_ENTRY, POIROT_HIGH, POIROT_WRONG, POIROT_EVENT,
  WHITE_ENTRY, WHITE_HIGH, WHITE_WRONG, WHITE_EVENT,
  BLACK_ENTRY, BLACK_HIGH, BLACK_WRONG, BLACK_EVENT,
  FBI_ENTRY, FBI_HIGH, FBI_WRONG, FBI_EVENT,
  POLICE_ENTRY, POLICE_HIGH, POLICE_WRONG, POLICE_EVENT,
] as const;

type EntryCase = {
  source: CardDef;
  abilityId: string;
  trigger: 'declare' | 'end';
  from: 'hand' | 'remove' | 'deck';
  target: CardDef;
  decoys: readonly CardDef[];
  targetState: 'active' | 'sleep';
  optional?: boolean;
  reveal?: boolean;
  enterChoice?: boolean;
  sourceAfter: 'scene' | 'remove' | 'deck';
  fileAfter: number;
};

const CASES = {
  B03073: { source: B03073, abilityId: 'a1', trigger: 'end', from: 'deck', target: LOW_ENTRY, decoys: [LOW_HIGH, LOW_EVENT, LOW_HIGH_TWO], targetState: 'active', reveal: true, sourceAfter: 'remove', fileAfter: 6 },
  B04030: { source: B04030, abilityId: 'a1', trigger: 'end', from: 'deck', target: KID_ENTRY, decoys: [KID_HIGH, KID_KUROBA, KID_EVENT], targetState: 'active', reveal: true, enterChoice: true, sourceAfter: 'remove', fileAfter: 6 },
  B04068: { source: B04068, abilityId: 'a1', trigger: 'declare', from: 'hand', target: POIROT_ENTRY, decoys: [POIROT_HIGH, POIROT_WRONG, POIROT_EVENT], targetState: 'active', optional: true, sourceAfter: 'scene', fileAfter: 5 },
  B05048: { source: B05048, abilityId: 'a2', trigger: 'declare', from: 'remove', target: WHITE_ENTRY, decoys: [WHITE_HIGH, WHITE_WRONG, WHITE_EVENT], targetState: 'active', sourceAfter: 'scene', fileAfter: 6 },
  B05108: { source: B05108, abilityId: 'a2', trigger: 'end', from: 'hand', target: BLACK_ENTRY, decoys: [BLACK_HIGH, BLACK_WRONG, BLACK_EVENT], targetState: 'active', optional: true, sourceAfter: 'remove', fileAfter: 6 },
  B06077: { source: B06077, abilityId: 'a2', trigger: 'end', from: 'hand', target: FBI_ENTRY, decoys: [FBI_HIGH, FBI_WRONG, FBI_EVENT], targetState: 'active', optional: true, sourceAfter: 'remove', fileAfter: 6 },
  PR086: { source: PR086, abilityId: 'a1', trigger: 'end', from: 'hand', target: POLICE_ENTRY, decoys: [POLICE_HIGH, POLICE_WRONG, POLICE_EVENT], targetState: 'sleep', optional: true, sourceAfter: 'deck', fileAfter: 6 },
  PR092: { source: PR092, abilityId: 'a1', trigger: 'end', from: 'hand', target: POLICE_ENTRY, decoys: [POLICE_HIGH, POLICE_WRONG, POLICE_EVENT], targetState: 'sleep', optional: true, sourceAfter: 'deck', fileAfter: 6 },
} as const satisfies Record<string, EntryCase>;

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function base(entryCase: EntryCase): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 8, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.turnState.self.enterCountThisTurn = 0;
  state.players.self.case.colors = [...entryCase.source.colors];
  state.players.self.case.status = '解決編';
  state.players.self.scene = [makeChar({ cardId: entryCase.source.id, uid: 'source', state: 'active' })];
  state.players.opp.scene = [makeChar({ cardId: ACTION_TARGET, uid: 'action-target', state: 'sleep' })];
  state.players.self.deck = [DRAW, FILLER, FILLER];
  state.players.opp.deck = [FILLER, FILLER];
  state.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
  if (entryCase.from === 'deck') {
    state.players.self.deck = [entryCase.target.id, ...entryCase.decoys.map(card => card.id), DRAW, FILLER];
  } else {
    state.players.self[entryCase.from] = [entryCase.target.id, ...entryCase.decoys.map(card => card.id)];
  }
  return state;
}

function install(entryCase: EntryCase, state = base(entryCase)): void {
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(`qa-w29-${entryCase.source.id}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function declareAction(): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'action-target' })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toEqual(expect.any(String));
  return actionId!;
}

function driveThroughJudge(actionId: string): void {
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
}

function closeAction(actionId: string): void {
  for (let index = 0; index < 3 && useGameStateStore.getState().activeActionId === actionId; index += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
}

function acceptOptional(entryCase: EntryCase): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending, `${entryCase.source.id}: optional authority`).toMatchObject({
    player: 'self', source: { cardId: entryCase.source.id, uid: 'source', abilityId: entryCase.abilityId },
  });
  expect(dispatchEngineAction(bindPendingDecision(pending!, { type: 'optionalResolve', run: true }))).toEqual({ ok: true });
}

function resolveEntryPick(entryCase: EntryCase): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${entryCase.source.id}: sceneEnter authority`).toMatchObject({
    player: 'self', atomVerb: 'sceneEnter', nMin: 0, nMax: 1,
    source: { cardId: entryCase.source.id, abilityId: entryCase.abilityId },
  });
  expect(pending!.candidates.map(candidate => candidate.cardId), `${entryCase.source.id}: typed candidates`)
    .toEqual([entryCase.target.id]);
  const target = pending!.candidates[0]!;
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: target.uid,
  }))).toEqual({ ok: true });
}

function resolveRevealEntry(entryCase: EntryCase): void {
  surfacePendingSideChannels();
  const reveal = useGameStateStore.getState().pendingEffectPick;
  expect(reveal, `${entryCase.source.id}: deck reveal authority`).toMatchObject({
    player: 'self', atomVerb: 'deckRevealUntil', nMin: 0, nMax: 1,
    source: { cardId: entryCase.source.id, abilityId: entryCase.abilityId },
  });
  expect(reveal!.candidates.map(candidate => candidate.cardId), `${entryCase.source.id}: reveal filter`)
    .toEqual([entryCase.target.id]);
  expect(dispatchEngineAction(bindPendingDecision(reveal!, {
    type: 'effectPickResolve', pickedUid: reveal!.candidates[0]!.uid,
  }))).toEqual({ ok: true });

  if (entryCase.enterChoice) {
    surfacePendingSideChannels();
    const choice = useGameStateStore.getState().pendingEffectChoice;
    expect(choice, `${entryCase.source.id}: enter-or-hand choice`).toMatchObject({
      player: 'self', source: { cardId: entryCase.source.id, abilityId: entryCase.abilityId },
    });
    expect(dispatchEngineAction(bindPendingDecision(choice!, {
      type: 'choiceResolve', choiceIndex: 1,
    }))).toEqual({ ok: true });
  }

  if (useGameStateStore.getState().pendingDeckReveal) {
    useGameStateStore.getState().setPendingDeckReveal(null);
    surfacePendingSideChannels();
  }
  const reorder = useGameStateStore.getState().pendingDeckReorder;
  expect(reorder, `${entryCase.source.id}: bottom-order authority`).toBeTruthy();
  expect(reorder!.cardIds, `${entryCase.source.id}: only unchosen cards reorder`)
    .toEqual(entryCase.decoys.map(card => card.id));
  expect(dispatchEngineAction(bindPendingDecision(reorder!, {
    type: 'deckReorderResolve', order: [...reorder!.cardIds],
  }))).toEqual({ ok: true });
}

function sourceArea(entryCase: EntryCase): 'scene' | 'remove' | 'deck' | 'missing' {
  const state = current();
  if (state.players.self.scene.some(card => card.cardId === entryCase.source.id)) return 'scene';
  if (state.players.self.remove.includes(entryCase.source.id)) return 'remove';
  if (state.players.self.deck.includes(entryCase.source.id)) return 'deck';
  return 'missing';
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
  install(entryCase);
  const actionId = declareAction();
  if (entryCase.trigger === 'end') {
    driveThroughJudge(actionId);
    expect({
      sourceInScene: current().players.self.scene.some(card => card.uid === 'source'),
      sourceInRemove: current().players.self.remove.includes(entryCase.source.id),
    }, `${entryCase.source.id}: action:end source precondition`).toEqual({
      sourceInScene: true,
      sourceInRemove: false,
    });
    closeAction(actionId);
  }
  if (entryCase.optional) acceptOptional(entryCase);
  if (entryCase.reveal) resolveRevealEntry(entryCase);
  else resolveEntryPick(entryCase);
  if (entryCase.trigger === 'declare') driveThroughJudge(actionId);
  closeAction(actionId);

  const state = current();
  const actions = state.log.map(item => item.action);
  const origin = entryCase.from === 'deck' ? state.players.self.deck : state.players.self[entryCase.from];
  const entered = state.players.self.scene.find(card => card.cardId === entryCase.target.id);
  return {
    sourceArea: sourceArea(entryCase),
    targetState: entered?.state,
    targetNamed: entered?.isNamed,
    targetEnterEffects: state.pendingEffects
      .filter(item => item.source.cardId === entryCase.target.id && item.source.abilityId === enterDraw.id)
      .map(item => item.state),
    targetLeftOrigin: !origin.includes(entryCase.target.id),
    decoysRemain: entryCase.decoys.every(card => origin.includes(card.id)),
    drawAfterEntry: actions.lastIndexOf('effect:draw') > actions.lastIndexOf('effect:sceneEnter'),
    fileCount: state.players.self.file.length,
    settled: expectSettled(entryCase.source.id),
  };
}

function expected(entryCase: EntryCase) {
  return {
    sourceArea: entryCase.sourceAfter,
    targetState: entryCase.targetState,
    targetNamed: true,
    targetEnterEffects: ['resolved'],
    targetLeftOrigin: true,
    decoysRemain: true,
    drawAfterEntry: true,
    fileCount: entryCase.fileAfter,
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

describe('effect entry official Q&A — Wave 29 action-triggered public paths', () => {
  it(`card:B03073:${QA.B03073}`, () => expect(prove(CASES.B03073)).toEqual(expected(CASES.B03073)));
  it(`card:B04030:${QA.B04030}`, () => expect(prove(CASES.B04030)).toEqual(expected(CASES.B04030)));
  it(`card:B04068:${QA.B04068}`, () => expect(prove(CASES.B04068)).toEqual(expected(CASES.B04068)));
  it(`card:B05048:${QA.B05048}`, () => expect(prove(CASES.B05048)).toEqual(expected(CASES.B05048)));
  it(`card:B05108:${QA.B05108}`, () => expect(prove(CASES.B05108)).toEqual(expected(CASES.B05108)));
  it(`card:B06077:${QA.B06077}`, () => expect(prove(CASES.B06077)).toEqual(expected(CASES.B06077)));
  it(`card:PR086:${QA.PR086}`, () => expect(prove(CASES.PR086)).toEqual(expected(CASES.PR086)));
  it(`card:PR092:${QA.PR092}`, () => expect(prove(CASES.PR092)).toEqual(expected(CASES.PR092)));

  it.each([
    ['B04068', CASES.B04068],
    ['B05108', CASES.B05108],
    ['B06077', CASES.B06077],
    ['PR086', CASES.PR086],
    ['PR092', CASES.PR092],
  ] as const)('%s optional decline keeps the source and target in place without applying its chain', (_id, entryCase) => {
    install(entryCase);
    const handBefore = [...current().players.self.hand];
    const deckBefore = [...current().players.self.deck];
    const fileBefore = current().players.self.file.length;
    const actionId = declareAction();
    if (entryCase.trigger === 'end') {
      driveThroughJudge(actionId);
      closeAction(actionId);
    }
    surfacePendingSideChannels();
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(optional?.source).toMatchObject({ cardId: entryCase.source.id, abilityId: entryCase.abilityId });
    expect(dispatchEngineAction(bindPendingDecision(optional!, { type: 'optionalResolve', run: false }))).toEqual({ ok: true });
    if (entryCase.trigger === 'declare') driveThroughJudge(actionId);
    closeAction(actionId);
    expect(sourceArea(entryCase)).toBe('scene');
    expect(current().players.self.hand).toEqual(handBefore);
    expect(current().players.self.deck).toEqual(deckBefore);
    expect(current().players.self.file).toHaveLength(fileBefore);
    expect(current().players.self.scene).not.toContainEqual(expect.objectContaining({ cardId: entryCase.target.id }));
    if (entryCase.source.id === 'B04068') {
      expect(current().players.self.scene.find(card => card.uid === 'source')?.turnEffects.apMod_turn).toBeUndefined();
    }
    expect(expectSettled(`${entryCase.source.id}-optional-decline`)).toBe(true);
  });

  it('mandatory B03073 source removal remains paid when the deck choice is zero', () => {
    const entryCase = CASES.B03073;
    install(entryCase);
    const actionId = declareAction();
    driveThroughJudge(actionId);
    closeAction(actionId);
    const reveal = useGameStateStore.getState().pendingEffectPick;
    expect(reveal).toMatchObject({ atomVerb: 'deckRevealUntil', nMin: 0, nMax: 1 });
    expect(dispatchEngineAction(bindPendingDecision(reveal!, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    if (useGameStateStore.getState().pendingDeckReveal) useGameStateStore.getState().setPendingDeckReveal(null);
    surfacePendingSideChannels();
    const reorder = useGameStateStore.getState().pendingDeckReorder;
    expect(reorder?.cardIds).toEqual([entryCase.target.id, ...entryCase.decoys.map(card => card.id)]);
    expect(dispatchEngineAction(bindPendingDecision(reorder!, {
      type: 'deckReorderResolve', order: [...reorder!.cardIds],
    }))).toEqual({ ok: true });
    closeAction(actionId);
    expect(sourceArea(entryCase)).toBe('remove');
    expect(current().players.self.scene).not.toContainEqual(expect.objectContaining({ cardId: entryCase.target.id }));
    expect(expectSettled('deck-zero')).toBe(true);
  });

  it('B04030 hand branch keeps the original source and does not fire the unentered target', () => {
    const entryCase = CASES.B04030;
    install(entryCase);
    const actionId = declareAction();
    driveThroughJudge(actionId);
    closeAction(actionId);
    const reveal = useGameStateStore.getState().pendingEffectPick;
    expect(dispatchEngineAction(bindPendingDecision(reveal!, {
      type: 'effectPickResolve', pickedUid: reveal!.candidates[0]!.uid,
    }))).toEqual({ ok: true });
    const choice = useGameStateStore.getState().pendingEffectChoice;
    expect(dispatchEngineAction(bindPendingDecision(choice!, {
      type: 'choiceResolve', choiceIndex: 0,
    }))).toEqual({ ok: true });
    if (useGameStateStore.getState().pendingDeckReveal) useGameStateStore.getState().setPendingDeckReveal(null);
    surfacePendingSideChannels();
    const reorder = useGameStateStore.getState().pendingDeckReorder;
    expect(dispatchEngineAction(bindPendingDecision(reorder!, {
      type: 'deckReorderResolve', order: [...reorder!.cardIds],
    }))).toEqual({ ok: true });
    closeAction(actionId);
    expect(sourceArea(entryCase)).toBe('scene');
    expect(current().players.self.hand).toContain(entryCase.target.id);
    expect(current().pendingEffects.some(item => item.source.cardId === entryCase.target.id)).toBe(false);
    expect(expectSettled('hand-branch')).toBe(true);
  });

  it('switching the acting B05048 out at declaration enters and fires once, then aborts before contact', () => {
    const entryCase = CASES.B05048;
    const state = base(entryCase);
    for (let index = 1; index <= 4; index += 1) {
      state.players.self.scene.push(makeChar({ cardId: FILLER, uid: `full-${index}`, state: 'active' }));
    }
    install(entryCase, state);
    const actionId = declareAction();
    const pending = useGameStateStore.getState().pendingEffectPick;
    const target = pending?.candidates.find(candidate => candidate.cardId === entryCase.target.id);
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: target!.uid, switchRemoveUid: 'source',
    }))).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(sourceArea(entryCase)).toBe('remove');
    expect(current().players.self.scene.find(card => card.cardId === entryCase.target.id)?.state).toBe('active');
    expect(current().pendingEffects.filter(item => item.source.cardId === entryCase.target.id)).toHaveLength(1);
    expect(current().log.some(item => item.action === 'contact:start')).toBe(false);
    expect(expectSettled('source-switch-abort')).toBe(true);
  });

  it('B04068 keeps its paid FILE/AP effects when its full-scene entry switches out the actor', () => {
    const entryCase = CASES.B04068;
    const state = base(entryCase);
    for (let index = 1; index <= 4; index += 1) {
      state.players.self.scene.push(makeChar({ cardId: FILLER, uid: `full-${index}`, state: 'active' }));
    }
    install(entryCase, state);
    const actionId = declareAction();
    acceptOptional(entryCase);
    const pending = useGameStateStore.getState().pendingEffectPick;
    const target = pending?.candidates.find(candidate => candidate.cardId === entryCase.target.id);
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: target!.uid, switchRemoveUid: 'source',
    }))).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(sourceArea(entryCase)).toBe('remove');
    expect(current().players.self.file).toHaveLength(5);
    expect(current().players.self.hand).toContain(FILLER);
    expect(current().log).toContainEqual(expect.objectContaining({
      player: 'self', action: 'effect:charModifyAP', target: 'source', result: '+2000/turn',
    }));
    expect(current().players.self.scene.find(card => card.cardId === entryCase.target.id)?.state).toBe('active');
    expect(current().pendingEffects.filter(item => item.source.cardId === entryCase.target.id)).toHaveLength(1);
    expect(current().log.some(item => item.action === 'contact:start')).toBe(false);
    expect(expectSettled('B04068-source-switch-abort')).toBe(true);
  });

  it('B05048 consumes turn1 after choosing zero and does not trigger on a second same-turn action', () => {
    const entryCase = CASES.B05048;
    install(entryCase);
    const firstActionId = declareAction();
    const firstPick = useGameStateStore.getState().pendingEffectPick;
    expect(firstPick).toMatchObject({ atomVerb: 'sceneEnter', nMin: 0, nMax: 1 });
    expect(dispatchEngineAction(bindPendingDecision(firstPick!, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    driveThroughJudge(firstActionId);
    closeAction(firstActionId);
    expect(expectSettled('B05048-first-zero-entry')).toBe(true);

    const firstTriggerCount = current().pendingEffects.filter(item =>
      item.source.cardId === entryCase.source.id && item.source.abilityId === entryCase.abilityId).length;
    expect(useGameStateStore.getState().dispatch(state => produce(state, draft => {
      const source = draft.players.self.scene.find(card => card.uid === 'source');
      if (!source) throw new Error('missing B05048 source');
      source.state = 'active';
    }))).toBe(true);

    const secondActionId = declareAction();
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().pendingEffects.filter(item =>
      item.source.cardId === entryCase.source.id && item.source.abilityId === entryCase.abilityId)).toHaveLength(firstTriggerCount);
    driveThroughJudge(secondActionId);
    closeAction(secondActionId);
    expect(expectSettled('B05048-second-action')).toBe(true);
  });

  it.each([
    ['B04068', CASES.B04068, 4],
    ['B05108', CASES.B05108, 5],
    ['B06077', CASES.B06077, 5],
  ] as const)('%s stays unavailable below its FILE threshold', (_id, entryCase, fileCount) => {
    const state = base(entryCase);
    state.players.self.file = Array.from({ length: fileCount }, () => ({ type: 'card-back' as const, cardId: FILLER }));
    install(entryCase, state);
    const actionId = declareAction();
    driveThroughJudge(actionId);
    closeAction(actionId);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(sourceArea(entryCase)).toBe('scene');
    expect(current().players.self[entryCase.from]).toContain(entryCase.target.id);
    expect(expectSettled(`${entryCase.source.id}-file-short`)).toBe(true);
  });

  it.each([
    ['B04068', CASES.B04068],
    ['B05108', CASES.B05108],
    ['B06077', CASES.B06077],
    ['PR086', CASES.PR086],
    ['PR092', CASES.PR092],
  ] as const)('%s keeps its preceding effects when the accepted entry count is zero', (_id, entryCase) => {
    install(entryCase);
    const actionId = declareAction();
    if (entryCase.trigger === 'end') {
      driveThroughJudge(actionId);
      closeAction(actionId);
    }
    acceptOptional(entryCase);
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending).toMatchObject({ atomVerb: 'sceneEnter', nMin: 0, nMax: 1 });
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    if (entryCase.trigger === 'declare') driveThroughJudge(actionId);
    closeAction(actionId);
    expect(sourceArea(entryCase)).toBe(entryCase.sourceAfter);
    expect(current().players.self.scene).not.toContainEqual(expect.objectContaining({ cardId: entryCase.target.id }));
    expect(current().players.self.hand).toContain(entryCase.target.id);
    if (entryCase.source.id === 'B04068') {
      expect(current().players.self.file).toHaveLength(5);
      expect(current().players.self.scene.find(card => card.uid === 'source')?.turnEffects.apMod_turn).toBe(2000);
    }
    expect(expectSettled(`${entryCase.source.id}-zero-entry`)).toBe(true);
  });

  it.each([
    ['B03073', CASES.B03073],
    ['B04030', CASES.B04030],
    ['B05108', CASES.B05108],
    ['B06077', CASES.B06077],
    ['PR086', CASES.PR086],
    ['PR092', CASES.PR092],
  ] as const)('%s does not fire at action end after its source leaves the scene', (_id, entryCase) => {
    install(entryCase);
    const actionId = declareAction();
    driveThroughJudge(actionId);
    expect(useGameStateStore.getState().dispatch(state => produce(state, draft => {
      mutate.scene.removeToRemove(draft, 'source', 'effect');
    }))).toBe(true);
    closeAction(actionId);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().pendingEffects.some(item =>
      item.source.cardId === entryCase.source.id && item.source.abilityId === entryCase.abilityId)).toBe(false);
    expect(current().players.self[entryCase.from]).toContain(entryCase.target.id);
    expect(expectSettled(`${entryCase.source.id}-source-left`)).toBe(true);
  });

  it.each([
    ['PR086', CASES.PR086],
    ['PR092', CASES.PR092],
  ] as const)('%s may enter the Police character drawn earlier in the same effect', (_id, entryCase) => {
    const state = base(entryCase);
    state.players.self.hand = entryCase.decoys.map(card => card.id);
    state.players.self.deck = [entryCase.target.id, FILLER];
    install(entryCase, state);
    const actionId = declareAction();
    driveThroughJudge(actionId);
    closeAction(actionId);
    acceptOptional(entryCase);
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending?.candidates.map(candidate => candidate.cardId)).toEqual([entryCase.target.id]);
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: pending!.candidates[0]!.uid,
    }))).toEqual({ ok: true });
    closeAction(actionId);
    const entered = current().players.self.scene.find(card => card.cardId === entryCase.target.id);
    expect(entered).toMatchObject({ state: 'sleep', isNamed: true });
    expect(sourceArea(entryCase)).toBe('deck');
    expect(current().pendingEffects.filter(item => item.source.cardId === entryCase.target.id).map(item => item.state))
      .toEqual(['resolved']);
    expect(expectSettled(`${entryCase.source.id}-drawn-entry`)).toBe(true);
  });
});
