// qa: card:B01084:c6e5391785273827b8dabcd809585155ef42406b996be0913d033b9dcb43cbe6
// qa: card:B01085:c6e5391785273827b8dabcd809585155ef42406b996be0913d033b9dcb43cbe6
// qa: card:B01095:c6e5391785273827b8dabcd809585155ef42406b996be0913d033b9dcb43cbe6
// qa: card:B02072:c6e5391785273827b8dabcd809585155ef42406b996be0913d033b9dcb43cbe6
// qa: card:B03084:c6e5391785273827b8dabcd809585155ef42406b996be0913d033b9dcb43cbe6
// qa: card:B04032:d5e0a704a7651a6bbf180feb7cc6f603d2402b08bcd4abd6c4586ae258ac0515
// qa: card:B04074:c6e5391785273827b8dabcd809585155ef42406b996be0913d033b9dcb43cbe6
// qa: card:B08074:005e493fba4351e0068829bd845547d2262609dc9387785fd09e678fa32f04ae
// Rules: 13-keywords.md — cards revealed by Investigation are the found cards.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B01084 } from '@/cards/ct-p01/B01084';
import { B01085 } from '@/cards/ct-p01/B01085';
import { B01095 } from '@/cards/ct-p01/B01095';
import { B02072 } from '@/cards/ct-p02/B02072';
import { B03084 } from '@/cards/ct-p03/B03084';
import { B04032 } from '@/cards/ct-p04/B04032';
import { B04074 } from '@/cards/ct-p04/B04074';
import { B08074 } from '@/cards/ct-p08/B08074';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const HIGH = 'W47_HIGH';
const LOW = 'W47_LOW';
const LOW_TWO = 'W47_LOW_TWO';
const MATCH = 'W47_MATCH';
const POLICE_ONE = 'W47_POLICE_ONE';
const POLICE_TWO = 'W47_POLICE_TWO';
const POLICE_THREE = 'W47_POLICE_THREE';
const TARGET = 'W47_TARGET';
const DECOY = 'W47_DECOY';
const DETECTIVE = 'W47_DETECTIVE';
const KAZAMI = 'W47_KAZAMI';
const YELLOW_PARTNER = 'W47_YELLOW_PARTNER';
const TAIL = 'W47_TAIL';

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['黄'],
    level: 3,
    ap: 3000,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    ...options,
  } as CardDef;
}

const fixtures = [
  fixture(HIGH, { level: 5 }),
  fixture(LOW, { level: 4 }),
  fixture(LOW_TWO, { level: 2 }),
  fixture(MATCH, { names: ['江戸川コナン'], level: 5 }),
  fixture(POLICE_ONE, { traits: ['警察'], level: 5 }),
  fixture(POLICE_TWO, { traits: ['警察'], level: 4 }),
  fixture(POLICE_THREE, { traits: ['警察'], level: 3 }),
  fixture(TARGET, { level: 6, ap: 2000 }),
  fixture(DECOY, { level: 7, ap: 2000 }),
  fixture(DETECTIVE, { traits: ['探偵'], level: 7 }),
  fixture(KAZAMI, { names: ['風見裕也'], traits: ['警察'], level: 4 }),
  fixture(YELLOW_PARTNER, { kind: 'partner', level: 0, lp: 5 }),
  fixture(TAIL),
];

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['黄'];
  state.players.self.partner = { cardId: YELLOW_PARTNER, state: 'active', location: 'partner-area' };
  state.players.self.file = Array.from({ length: 8 }, (_value, index) => ({
    type: 'card-back' as const,
    cardId: `W47_FILE_${index}`,
  }));
  state.players.self.deck = Array.from({ length: 8 }, () => TAIL);
  state.players.opp.deck = [HIGH, LOW, LOW_TWO, TAIL];
  return state;
}

function install(state: GameState, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(label);
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave47 state');
  return state;
}

function captureFound(source: CardDef, expected: string[]): string[] {
  surfacePendingSideChannels();
  const reveal = useGameStateStore.getState().pendingDeckReveal;
  expect(reveal, `${source.id}: public found-card snapshot`).toMatchObject({
    player: 'opp',
    visibility: 'public',
    viewer: 'all',
    revealed: expected,
    presentation: 'reveal-to-bottom',
    source: { cardId: source.id },
  });
  useGameStateStore.getState().setPendingDeckReveal(null);
  surfacePendingSideChannels();
  const reorder = useGameStateStore.getState().pendingDeckReorder;
  if (reorder) {
    expect(dispatchEngineAction(bindPendingDecision(reorder, {
      type: 'deckReorderResolve', order: [...reorder.cardIds],
    }))).toEqual({ ok: true });
    surfacePendingSideChannels();
  }
  return reveal?.revealed ?? [];
}

function resolvePickByUid(uid: string | null): void {
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: uid,
  }))).toEqual({ ok: true });
}

function expectSettled(source: CardDef): void {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  expect(store.pendingDeckReveal, `${source.id}: reveal cleared`).toBeNull();
  expect(store.pendingDeckReorder, `${source.id}: reorder cleared`).toBeNull();
  expect(store.pendingEffectPick, `${source.id}: pick cleared`).toBeNull();
  expect(store.pendingEffectChoice, `${source.id}: choice cleared`).toBeNull();
  expect(current().pendingEffects.every((entry) => entry.state === 'resolved'), `${source.id}: effects settled`).toBe(true);
}

function thresholdResult(source: CardDef, route: 'end' | 'action' | 'declared', abilityId: string) {
  const run = (topCard: string) => {
    const state = base();
    state.players.opp.deck = [topCard, LOW_TWO, TAIL];
    state.players.self.scene = [
      sceneChar(source.id, 'source', { state: route === 'end' ? 'sleep' : 'active' }),
      sceneChar(route === 'declared' && source.id === B04032.id ? DETECTIVE : TARGET, 'target', { state: 'sleep' }),
    ];
    state.players.opp.scene = [sceneChar(DECOY, 'opp-target', { state: 'sleep' })];
    install(state, `w47-threshold-${source.id}-${topCard}`);
    if (route === 'end') {
      expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    } else if (route === 'action') {
      expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'opp-target' })).toEqual({ ok: true });
    } else {
      expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: abilityId })).toEqual({ ok: true });
    }
    const found = captureFound(source, [topCard]);
    const pick = useGameStateStore.getState().pendingEffectPick;
    if (pick) resolvePickByUid('target');
    const after = current();
    return {
      found,
      targetState: after.players.self.scene.find((character) => character.uid === 'target')?.state,
      sourceAp: readChar.ap(after, 'source'),
      targetAp: readChar.ap(after, 'target'),
      targetAssault: readChar.hasKeyword(after, 'target', '突撃'),
      offeredPick: Boolean(pick),
    };
  };
  return { high: run(HIGH), low: run(LOW) };
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetActionContexts();
  _resetUidCounter();
  resetPendingRuntimeState();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.getState().setGameState(null);
});

afterEach(() => {
  resetPendingRuntimeState();
  _resetActionContexts();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('official QA Wave47: found cards are the cards publicly revealed by Investigation', () => {
  it('B01084 found high-level card opens activation; found low-level card does not', () => {
    expect(thresholdResult(B01084, 'end', 'a1')).toEqual({
      high: { found: [HIGH], targetState: 'active', sourceAp: 6000, targetAp: 2000, targetAssault: false, offeredPick: true },
      low: { found: [LOW], targetState: 'sleep', sourceAp: 6000, targetAp: 2000, targetAssault: false, offeredPick: false },
    });
  });

  it('B01085 found high-level card grants AP; found low-level card does not', () => {
    expect(thresholdResult(B01085, 'action', 'a1')).toEqual({
      high: { found: [HIGH], targetState: 'sleep', sourceAp: 5000, targetAp: 2000, targetAssault: false, offeredPick: false },
      low: { found: [LOW], targetState: 'sleep', sourceAp: 3000, targetAp: 2000, targetAssault: false, offeredPick: false },
    });
  });

  it('B01095 public event use exposes exactly its Investigation card as found', () => {
    const state = base();
    state.players.self.hand = [B01095.id];
    state.players.opp.deck = [MATCH, LOW, TAIL];
    install(state, 'w47-B01095');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B01095.id })).toEqual({ ok: true });
    expect(captureFound(B01095, [MATCH])).toEqual([MATCH]);
    expect(current().players.opp.deck).toEqual([LOW, TAIL, MATCH]);
  });

  it('B02072 dynamic Investigation binds every revealed card for the level-sum removal', () => {
    const state = base();
    state.players.self.scene = [
      sceneChar(B02072.id, 'source'),
      sceneChar(POLICE_TWO, 'police'),
    ];
    state.players.opp.scene = [sceneChar(TARGET, 'target'), sceneChar(DECOY, 'decoy')];
    state.players.opp.deck = [HIGH, LOW_TWO, TAIL];
    install(state, 'w47-B02072');
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1' })).toEqual({ ok: true });
    expect(captureFound(B02072, [HIGH, LOW_TWO])).toEqual([HIGH, LOW_TWO]);
    surfacePendingSideChannels();
    const pick = useGameStateStore.getState().pendingEffectPick!;
    expect(pick.candidates.map((candidate) => candidate.uid)).toContain('target');
    expect(pick.candidates.map((candidate) => candidate.uid)).toContain('decoy');
    resolvePickByUid('target');
    expect(current().players.opp.remove).toContain(TARGET);
  });

  it('B03084 found high-level card opens AP pick; found low-level card does not', () => {
    expect(thresholdResult(B03084, 'declared', 'a2')).toEqual({
      high: { found: [HIGH], targetState: 'sleep', sourceAp: 7000, targetAp: 4000, targetAssault: false, offeredPick: true },
      low: { found: [LOW], targetState: 'sleep', sourceAp: 7000, targetAp: 2000, targetAssault: false, offeredPick: false },
    });
  });

  it('B04032 uses either of its two found cards to open the Assault target', () => {
    const state = base();
    state.players.self.scene = [sceneChar(B04032.id, 'source'), sceneChar(DETECTIVE, 'target', { state: 'sleep' })];
    state.players.opp.deck = [LOW, HIGH, TAIL];
    install(state, 'w47-B04032');
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a2' })).toEqual({ ok: true });
    expect(captureFound(B04032, [LOW, HIGH])).toEqual([LOW, HIGH]);
    resolvePickByUid('target');
    expect(readChar.hasKeyword(current(), 'target', '突撃')).toBe(true);
  });

  it('B04074 removal candidates use levels of the exact found cards', () => {
    const state = base();
    state.players.self.scene = [sceneChar(B04074.id, 'source')];
    state.players.opp.scene = [sceneChar(HIGH, 'target'), sceneChar(DECOY, 'decoy')];
    state.players.opp.deck = [LOW_TWO, HIGH, TAIL];
    install(state, 'w47-B04074');
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1' })).toEqual({ ok: true });
    expect(captureFound(B04074, [LOW_TWO, HIGH])).toEqual([LOW_TWO, HIGH]);
    surfacePendingSideChannels();
    const pick = useGameStateStore.getState().pendingEffectPick!;
    expect(pick.candidates.map((candidate) => candidate.uid)).toContain('target');
    expect(pick.candidates.map((candidate) => candidate.uid)).not.toContain('decoy');
    resolvePickByUid('target');
    expect(current().players.opp.remove).toContain(HIGH);
  });

  it('B08074 public trait choice counts all three publicly found Police cards', () => {
    const state = base();
    state.players.self.hand = [B08074.id];
    state.players.self.file = Array.from({ length: 6 }, (_value, index) => ({
      type: 'card-back' as const, cardId: `W47_B08074_FILE_${index}`,
    }));
    state.players.opp.deck = [POLICE_ONE, POLICE_TWO, POLICE_THREE, TAIL];
    install(state, 'w47-B08074');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B08074.id })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const choice = useGameStateStore.getState().pendingEffectChoice!;
    const police = choice.options.find((option) => option.label === '警察');
    expect(police).toBeTruthy();
    expect(dispatchEngineAction(bindPendingDecision(choice, {
      type: 'choiceResolve', choiceIndex: police!.index,
    }))).toEqual({ ok: true });
    expect(captureFound(B08074, [POLICE_ONE, POLICE_TWO, POLICE_THREE]))
      .toEqual([POLICE_ONE, POLICE_TWO, POLICE_THREE]);
    const entered = current().players.self.scene.find((character) => character.cardId === B08074.id)!;
    expect(readChar.keywords(current(), entered.uid)).toEqual(expect.arrayContaining(['突撃[キャラ]', '突撃', '迅速']));
    expectSettled(B08074);
  });
});
