// qa: card:B03062:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B04090:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B05015:a28608862f5450b8c9d283fdb576f4ba39b2558705a2d36a2a0e5d6e35885de7
// qa: card:B05077:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B06012:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B06046:bcef8e553fcab29eb3498024e5adb7d97f89ae4b09b72aa37cf83746d2d53c4b
// qa: card:B08076:a96985ed96d005b04cd0c44c2dadf206fac63c8bd49e8c42cef6ea4c73808dae
// qa: card:B09106:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// Rules: 05, 08, 10, 15, 16, 17, 20, 21, 25.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B03062 } from '@/cards/ct-p03/B03062';
import { B04090 } from '@/cards/ct-p04/B04090';
import { B05015 } from '@/cards/ct-p05/B05015';
import { B05077 } from '@/cards/ct-p05/B05077';
import { B06012 } from '@/cards/ct-p06/B06012';
import { B06046 } from '@/cards/ct-p06/B06046';
import { B08076 } from '@/cards/ct-p08/B08076';
import { B09106 } from '@/cards/ct-p09/B09106';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { sceneChar } from '../../helpers/fixtures';

const DRAW = 'W54_DRAW';
const FILLER = 'W54_FILLER';
const WHITE_PARTNER = 'W54_WHITE_PARTNER';
const BLACK_PARTNER = 'W54_BLACK_PARTNER';
const RED_PARTNER = 'W54_RED_PARTNER';
const MOVE_COST = 'W54_MOVE_COST';
const LEVEL8_ENTRY = 'W54_LEVEL8_ENTRY';
const LEVEL7_DECOY = 'W54_LEVEL7_DECOY';
const CUTIN_EVENT = 'W54_INACTIVE_CUTIN';
const BLACK3_ENTRY = 'W54_BLACK3_ENTRY';
const BLACK4_DECOY = 'W54_BLACK4_DECOY';
const WRONG_COLOR = 'W54_WRONG_COLOR';
const GENTA_ENTRY = 'W54_GENTA_ENTRY';
const GENTA_HIGH = 'W54_GENTA_HIGH';
const GENTA_WRONG = 'W54_GENTA_WRONG';
const JODIE_ENTRY = 'W54_JODIE_ENTRY';
const JODIE_HIGH = 'W54_JODIE_HIGH';
const JODIE_WRONG = 'W54_JODIE_WRONG';
const AGASA_ENTRY = 'W54_AGASA_ENTRY';
const AGASA_HIGH = 'W54_AGASA_HIGH';
const AGASA_WRONG = 'W54_AGASA_WRONG';
const YAIBA_ENTRY = 'W54_YAIBA_ENTRY';
const YAIBA_HIGH = 'W54_YAIBA_HIGH';
const YAIBA_WRONG = 'W54_YAIBA_WRONG';
const YAIBA_SET_A = 'W54_YAIBA_SET_A';
const YAIBA_SET_B = 'W54_YAIBA_SET_B';
const DISCARD = 'W54_DISCARD';
const SATO_COST = 'W54_SATO_COST';
const TAKAGI_KEEP = 'W54_TAKAGI_KEEP';
const SATO_ENTRY = 'W54_SATO_ENTRY';
const SATO_HIGH = 'W54_SATO_HIGH';
const SATO_WRONG = 'W54_SATO_WRONG';
const TRACE_ENTRY = 'W54_TRACE_ENTRY';
const TRACE_HIGH = 'W54_TRACE_HIGH';
const TRACE_WRONG = 'W54_TRACE_WRONG';
const ACTION_TARGET = 'W54_ACTION_TARGET';
const CASE_CARD = 'W54_CASE';

const enterDraw: AbilityDef = {
  id: 'enter-draw', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '登場時に1枚引く。', ruleRefs: [],
};

const inactiveCutin: AbilityDef = {
  id: 'cut', type: 'triggered', scope: 'on-hand',
  condition: { kind: 'turn', player: 'opp' },
  trigger: { hook: 'effect:declared', optional: true },
  effect: { kind: 'atom', verb: 'noop', args: {} },
  description: '自分ターン中は無効なカットイン。', ruleRefs: [],
};

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  const kind = options.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  } as CardDef;
}

const FIXTURES: CardDef[] = [
  fixture(DRAW), fixture(FILLER), fixture(MOVE_COST),
  fixture(WHITE_PARTNER, { kind: 'partner', colors: ['白'] }),
  fixture(BLACK_PARTNER, { kind: 'partner', colors: ['黒'] }),
  fixture(RED_PARTNER, { kind: 'partner', colors: ['赤'] }),
  fixture(LEVEL8_ENTRY, { level: 8, abilities: [enterDraw] }),
  fixture(LEVEL7_DECOY, { level: 7, abilities: [enterDraw] }),
  fixture(CUTIN_EVENT, { kind: 'event', abilities: [inactiveCutin] }),
  fixture(BLACK3_ENTRY, { colors: ['黒'], level: 3, abilities: [enterDraw] }),
  fixture(BLACK4_DECOY, { colors: ['黒'], level: 4, abilities: [enterDraw] }),
  fixture(WRONG_COLOR, { colors: ['青'], level: 3, abilities: [enterDraw] }),
  fixture(GENTA_ENTRY, { names: ['小嶋元太'], level: 6, abilities: [enterDraw] }),
  fixture(GENTA_HIGH, { names: ['小嶋元太'], level: 7, abilities: [enterDraw] }),
  fixture(GENTA_WRONG, { names: ['円谷光彦'], level: 6, abilities: [enterDraw] }),
  fixture(JODIE_ENTRY, { names: ['ジョディ・スターリング'], level: 4, abilities: [enterDraw] }),
  fixture(JODIE_HIGH, { names: ['ジョディ・スターリング'], level: 5, abilities: [enterDraw] }),
  fixture(JODIE_WRONG, { names: ['ジョディ・サンテミリオン'], level: 4, abilities: [enterDraw] }),
  fixture(AGASA_ENTRY, { names: ['阿笠博士'], level: 8, abilities: [enterDraw] }),
  fixture(AGASA_HIGH, { names: ['阿笠博士'], level: 9, abilities: [enterDraw] }),
  fixture(AGASA_WRONG, { names: ['工藤新一'], level: 8, abilities: [enterDraw] }),
  fixture(YAIBA_ENTRY, { traits: ['YAIBA'], level: 5, abilities: [enterDraw] }),
  fixture(YAIBA_HIGH, { traits: ['YAIBA'], level: 6, abilities: [enterDraw] }),
  fixture(YAIBA_WRONG, { level: 5, abilities: [enterDraw] }),
  fixture(YAIBA_SET_A, { kind: 'event', traits: ['YAIBA'] }),
  fixture(YAIBA_SET_B, { kind: 'event', traits: ['YAIBA'] }),
  fixture(DISCARD),
  fixture(SATO_COST, { names: ['佐藤美和子'], colors: ['青', '黄'], level: 3 }),
  fixture(TAKAGI_KEEP, { names: ['高木渉'], level: 3 }),
  fixture(SATO_ENTRY, { names: ['佐藤美和子'], level: 4, abilities: [enterDraw] }),
  fixture(SATO_HIGH, { names: ['佐藤美和子'], level: 5, abilities: [enterDraw] }),
  fixture(SATO_WRONG, { names: ['白鳥任三郎'], level: 4, abilities: [enterDraw] }),
  fixture(TRACE_ENTRY, { colors: ['赤'], level: 4, abilities: [enterDraw] }),
  fixture(TRACE_HIGH, { colors: ['黒'], level: 5, abilities: [enterDraw] }),
  fixture(TRACE_WRONG, { colors: ['青'], level: 4, abilities: [enterDraw] }),
  fixture(ACTION_TARGET, { ap: 9000 }),
  fixture(CASE_CARD, { kind: 'case', colors: ['青'] }),
];

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave54 state');
  return state;
}

function install(state: GameState, label: string): void {
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(`qa-w54-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(cardId: string, abilityId: string, atomVerb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${cardId}: ${atomVerb} authority`).toMatchObject({
    player: 'self', atomVerb, source: { cardId, abilityId },
  });
  return pending!;
}

function resolveCandidate(
  cardId: string,
  abilityId: string,
  atomVerb: string,
  target: string,
  excluded: string[] = [],
  switchRemoveUid?: string,
): void {
  const pending = pendingPick(cardId, abilityId, atomVerb);
  expect(pending.candidates.map(candidate => candidate.cardId), `${cardId}: target candidate`).toContain(target);
  for (const decoy of excluded) {
    expect(pending.candidates.map(candidate => candidate.cardId), `${cardId}: excludes ${decoy}`).not.toContain(decoy);
  }
  const picked = pending.candidates.find(candidate => candidate.cardId === target)!;
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: picked.uid, ...(switchRemoveUid ? { switchRemoveUid } : {}),
  }))).toEqual({ ok: true });
}

function resolveOptional(cardId: string, abilityId: string, run: boolean): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending, `${cardId}: optional authority`).toMatchObject({
    player: 'self', source: { cardId, abilityId },
  });
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'optionalResolve', run,
  }))).toEqual({ ok: true });
}

function expectNormalEnter(cardId: string, state: 'active' | 'sleep'): void {
  expect(current().players.self.scene.find(character => character.cardId === cardId)?.state).toBe(state);
  expect(current().pendingEffects.filter(entry => (
    entry.source.cardId === cardId && entry.source.abilityId === enterDraw.id
  )).map(entry => entry.state), `${cardId}: normal enter resolved`).toEqual(['resolved']);
  const actions = current().log.map(entry => entry.action);
  expect(actions.lastIndexOf('effect:draw'), `${cardId}: enter ability after scene entry`)
    .toBeGreaterThan(actions.lastIndexOf('effect:sceneEnter'));
}

function clearReveal(): void {
  if (useGameStateStore.getState().pendingDeckReveal) {
    useGameStateStore.getState().setPendingDeckReveal(null);
    surfacePendingSideChannels();
  }
}

function finishAction(actionId: string): void {
  for (let step = 0; step < 4 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _resetActionContexts();
  _resetPendingHirameki();
  resetPendingRuntimeState();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null });
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  _resetActionContexts();
  _resetPendingHirameki();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('official QA Wave54: direct effect-entry routes fire normal enter abilities', () => {
  it('B03062 public event moves its chosen scene card before the forced deck entrant fires', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partner.cardId = WHITE_PARTNER;
    state.players.self.case.colors = ['白'];
    state.players.self.hand = [B03062.id];
    state.players.self.file = Array.from({ length: 8 }, () => ({
      type: 'card-back' as const, cardId: FILLER,
    }));
    state.players.self.scene = [sceneChar(MOVE_COST, 'move-cost')];
    state.players.self.deck = [LEVEL7_DECOY, LEVEL8_ENTRY, DRAW];
    install(state, B03062.id);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B03062.id }))
      .toEqual({ ok: true });
    resolveCandidate(B03062.id, 'a1', 'sceneToDeck', MOVE_COST);
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      source: { cardId: B03062.id, abilityId: 'a1' },
      revealed: [LEVEL7_DECOY, LEVEL8_ENTRY], matched: LEVEL8_ENTRY,
    });
    expectNormalEnter(LEVEL8_ENTRY, 'active');
    expect(current().pendingEffects.some(entry => entry.source.cardId === LEVEL8_ENTRY
      && entry.source.abilityId === enterDraw.id && entry.state === 'resolved')).toBe(true);
    expect(current().players.self.scene.some(character => character.uid === 'move-cost')).toBe(false);
    expect(current().players.self.remove).toContain(B03062.id);
    clearReveal();
  });

  it('B04090 real contact accepts an inactive cut-in, switches itself, and fires the entrant', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partner.cardId = BLACK_PARTNER;
    state.players.self.hand = [CUTIN_EVENT];
    state.players.self.deck = [DRAW, FILLER];
    state.players.self.remove = [BLACK3_ENTRY, BLACK4_DECOY, WRONG_COLOR];
    state.players.self.scene = [sceneChar(B04090.id, 'source'), ...Array.from(
      { length: 4 }, (_, index) => sceneChar(FILLER, `full-${index}`),
    )];
    state.players.opp.scene = [sceneChar(ACTION_TARGET, 'target', { state: 'sleep' })];
    install(state, B04090.id);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'target' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: 'self', choice: { kind: 'cutin', cardId: CUTIN_EVENT },
    })).toEqual({ ok: true });
    resolveCandidate(B04090.id, 'a2', 'sceneEnter', BLACK3_ENTRY, [BLACK4_DECOY, WRONG_COLOR], 'source');
    expectNormalEnter(BLACK3_ENTRY, 'active');
    expect(current().pendingEffects.some(entry => entry.source.cardId === BLACK3_ENTRY
      && entry.source.abilityId === enterDraw.id && entry.state === 'resolved')).toBe(true);
    expect(current().players.self.scene).toHaveLength(5);
    expect(current().players.self.remove).toContain(B04090.id);
    expect(current().players.self.remove).toContain(CUTIN_EVENT);
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId }))
      .toEqual({ ok: true });
  });

  it('B05015 public Hirameki enters only level-six-or-less Genta and fires his enter ability', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.scene = [sceneChar(ACTION_TARGET, 'attacker')];
    state.players.opp.deck = [FILLER, FILLER];
    state.players.self.case.cardId = CASE_CARD;
    state.players.self.evidence = [{ cardId: B05015.id, faceUp: false, origin: { turn: 1, via: 'opening' } }];
    state.players.self.remove = [GENTA_ENTRY, GENTA_HIGH, GENTA_WRONG];
    state.players.self.deck = [DRAW, FILLER];
    install(state, B05015.id);

    expect(dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'attacker', targetPlayer: 'self' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingHirameki).toMatchObject({
      player: 'self', cardId: B05015.id, abilityId: 'a2',
    });
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });
    resolveCandidate(B05015.id, 'a2', 'sceneEnter', GENTA_ENTRY, [GENTA_HIGH, GENTA_WRONG]);
    expectNormalEnter(GENTA_ENTRY, 'active');
    expect(current().pendingEffects.some(entry => entry.source.cardId === GENTA_ENTRY
      && entry.source.abilityId === enterDraw.id && entry.state === 'resolved')).toBe(true);
    finishAction(actionId);
  });

  it('B05077 opponent-turn contact removal forces Jodie entry before her normal enter fires', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(B05077.id, 'source', { state: 'sleep' })];
    state.players.self.deck = [JODIE_ENTRY, DRAW, FILLER];
    state.players.opp.scene = [sceneChar(ACTION_TARGET, 'attacker')];
    install(state, B05077.id);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'source' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' } }))
      .toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' } }))
      .toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      source: { cardId: B05077.id, uid: 'source', abilityId: 'a1' },
      revealed: [JODIE_ENTRY], matched: JODIE_ENTRY,
    });
    expectNormalEnter(JODIE_ENTRY, 'active');
    expect(current().pendingEffects.some(entry => entry.source.cardId === JODIE_ENTRY
      && entry.source.abilityId === enterDraw.id && entry.state === 'resolved')).toBe(true);
    expect(current().players.self.remove).toContain(B05077.id);
    clearReveal();
    finishAction(actionId);
  });

  it('B05077 no-match deck excludes high-level and wrong-name cards without a false enter', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(B05077.id, 'source', { state: 'sleep' })];
    state.players.self.deck = [JODIE_HIGH, JODIE_WRONG];
    state.players.opp.scene = [sceneChar(ACTION_TARGET, 'attacker')];
    install(state, `${B05077.id}-no-match`);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'source' })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      source: { cardId: B05077.id, abilityId: 'a1' }, matched: null,
    });
    expect(current().players.self.scene.some(character => [JODIE_HIGH, JODIE_WRONG].includes(character.cardId)))
      .toBe(false);
    clearReveal();
    finishAction(actionId);
  });

  it('B06012 public set occurrence removes itself at end turn, enters Agasa asleep, and fires enter', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case.colors = ['青'];
    state.players.self.hand = [B06012.id];
    state.players.self.file = Array.from({ length: 7 }, () => ({
      type: 'card-back' as const, cardId: FILLER,
    }));
    state.players.self.scene = [sceneChar(SATO_COST, 'host')];
    state.players.self.remove = [AGASA_ENTRY, AGASA_HIGH, AGASA_WRONG];
    state.players.self.deck = [DRAW, FILLER];
    install(state, B06012.id);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B06012.id }))
      .toEqual({ ok: true });
    resolveCandidate(B06012.id, 'a1', 'charSetCard', SATO_COST);
    const occurrence = current().players.self.scene[0]!.setCards[0]!;
    expect(occurrence).toMatchObject({ cardId: B06012.id, faceUp: true, instanceId: expect.any(String) });
    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    resolveOptional(B06012.id, 'a3', true);
    resolveCandidate(B06012.id, 'a3', 'sceneEnter', AGASA_ENTRY, [AGASA_HIGH, AGASA_WRONG]);
    expectNormalEnter(AGASA_ENTRY, 'sleep');
    expect(current().pendingEffects.some(entry => entry.source.cardId === AGASA_ENTRY
      && entry.source.abilityId === enterDraw.id && entry.state === 'resolved')).toBe(true);
    expect(current().players.self.remove).toContain(B06012.id);
    expect(current().players.self.scene[0]?.setCards).toEqual([]);
  });

  it('B06046 two YAIBA sets gate the end-turn discard, sleeping entry, and normal enter', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(B06046.id, 'source', { setCards: [
      { cardId: YAIBA_SET_A, faceUp: true, instanceId: 'set:a' },
      { cardId: YAIBA_SET_B, faceUp: true, instanceId: 'set:b' },
    ] })];
    state.players.self.hand = [DISCARD];
    state.players.self.remove = [YAIBA_ENTRY, YAIBA_HIGH, YAIBA_WRONG];
    state.players.self.deck = [DRAW, FILLER];
    install(state, B06046.id);

    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    resolveOptional(B06046.id, 'a2', true);
    resolveCandidate(B06046.id, 'a2', 'discard', DISCARD);
    resolveCandidate(B06046.id, 'a2', 'sceneEnter', YAIBA_ENTRY, [YAIBA_HIGH, YAIBA_WRONG]);
    expectNormalEnter(YAIBA_ENTRY, 'sleep');
    expect(current().pendingEffects.some(entry => entry.source.cardId === YAIBA_ENTRY
      && entry.source.abilityId === enterDraw.id && entry.state === 'resolved')).toBe(true);
    expect(current().players.self.remove).toContain(DISCARD);
  });

  it('B08076 pays exact evidence and scene costs before its sleeping entrant fires normally', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case = {
      cardId: B08076.id, status: '解決編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {},
    };
    state.players.self.evidence = [0, 1].map(index => ({
      cardId: `${B08076.id}-evidence-${index}`, faceUp: false,
      origin: { turn: 1, via: 'reasoning' as const },
    }));
    state.players.self.scene = [sceneChar(SATO_COST, 'cost'), sceneChar(TAKAGI_KEEP, 'keep')];
    state.players.self.remove = [SATO_ENTRY, SATO_HIGH, SATO_WRONG];
    state.players.self.deck = [DRAW, FILLER];
    install(state, B08076.id);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'case:self', abilId: 'a2',
      costParams: {
        flipFaceUpEvidence: { indices: [0, 1] },
        sceneToDeckBottom: { uids: ['cost'] },
      },
    })).toEqual({ ok: true });
    resolveCandidate(B08076.id, 'a2', 'sceneEnter', SATO_ENTRY, [SATO_HIGH, SATO_WRONG]);
    expectNormalEnter(SATO_ENTRY, 'sleep');
    expect(current().pendingEffects.some(entry => entry.source.cardId === SATO_ENTRY
      && entry.source.abilityId === enterDraw.id && entry.state === 'resolved')).toBe(true);
    expect(current().players.self.evidence.map(entry => entry.faceUp)).toEqual([true, true]);
    expect(current().players.self.scene.some(character => character.uid === 'cost')).toBe(false);
  });

  it('B09106 found-trace event continues after zero removal, enters a typed target, and fires enter', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case.colors = ['赤', '黒'];
    state.scratchTrace.self = '発見済';
    state.players.self.hand = [B09106.id];
    state.players.self.file = Array.from({ length: 6 }, () => ({
      type: 'card-back' as const, cardId: FILLER,
    }));
    state.players.self.remove = [TRACE_ENTRY, TRACE_HIGH, TRACE_WRONG];
    state.players.self.deck = [DRAW, FILLER];
    install(state, B09106.id);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B09106.id }))
      .toEqual({ ok: true });
    expect(current().players.self.scene).toEqual([]);
    resolveCandidate(B09106.id, 'a1', 'sceneEnter', TRACE_ENTRY, [TRACE_HIGH, TRACE_WRONG]);
    expectNormalEnter(TRACE_ENTRY, 'active');
    expect(current().pendingEffects.some(entry => entry.source.cardId === TRACE_ENTRY
      && entry.source.abilityId === enterDraw.id && entry.state === 'resolved')).toBe(true);
    expect(current().players.self.remove).toContain(B09106.id);
  });
});
