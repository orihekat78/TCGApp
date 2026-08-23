// qa: card:B02057:12d56922ac94e77d7ce7b7d2d7ff6c185065a32f7f91af0ec3483941263df031
// qa: card:B02083:12d56922ac94e77d7ce7b7d2d7ff6c185065a32f7f91af0ec3483941263df031
// qa: card:D02004:12d56922ac94e77d7ce7b7d2d7ff6c185065a32f7f91af0ec3483941263df031
// qa: card:D02013:12d56922ac94e77d7ce7b7d2d7ff6c185065a32f7f91af0ec3483941263df031
// qa: card:PR060:12d56922ac94e77d7ce7b7d2d7ff6c185065a32f7f91af0ec3483941263df031
// qa: card:PR064:12d56922ac94e77d7ce7b7d2d7ff6c185065a32f7f91af0ec3483941263df031
// qa: card:PR154:12d56922ac94e77d7ce7b7d2d7ff6c185065a32f7f91af0ec3483941263df031
// Rules: 03-field-areas, 07-action-flow, 15-abilities-effects, 24-qa-naming-stun.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player, SceneCharacter } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const CASE_ALL = 'W60-CASE-ALL';
const PARTNER_ALL = 'W60-PARTNER-ALL';
const LOW_TARGET = 'W60-LOW-TARGET';
const HIGH_TARGET = 'W60-HIGH-TARGET';
const STATE_TARGET = 'W60-STATE-TARGET';
const ACTION_TARGET = 'W60-ACTION-TARGET';
const GREEN_TARGET = 'W60-GREEN-TARGET';
const HAND_COST = 'W60-HAND-COST';
const STATE_DRIVER = 'W60-STATE-DRIVER';
const DRAW_A = 'W60-DRAW-A';
const DRAW_B = 'W60-DRAW-B';

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  const kind = options.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['緑'], traits: [], level: 1,
    ap: kind === 'character' ? 1000 : undefined, lp: kind === 'character' ? 1 : undefined,
    keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

function setStateAbility(id: string, state: SceneCharacter['state']): AbilityDef {
  return {
    id, type: 'declared', scope: 'on-scene',
    effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: 'state-target', state } },
    description: `${state} request`, ruleRefs: ['rules/03-field-areas.md'],
  };
}

const fixtures: CardDef[] = [
  fixture(CASE_ALL, { kind: 'case', colors: ['青', '緑', '白', '黄', '赤', '黒'], caseLevel: 7, caseTraits: [] }),
  fixture(PARTNER_ALL, { kind: 'partner', colors: ['青', '緑', '白', '黄', '赤', '黒'], lp: 5 }),
  fixture(LOW_TARGET, { level: 6, ap: 7000 }), fixture(HIGH_TARGET, { level: 8, ap: 9000 }),
  fixture(STATE_TARGET, { ap: 3000 }), fixture(ACTION_TARGET, { ap: 3000 }),
  fixture(GREEN_TARGET, { colors: ['緑'], level: 4 }), fixture(HAND_COST, { kind: 'event' }),
  fixture(DRAW_A), fixture(DRAW_B),
  fixture(STATE_DRIVER, { abilities: [
    setStateAbility('sleep-request', 'sleep'),
    setStateAbility('stun-request', 'stun'),
    setStateAbility('active-request', 'active'),
  ] }),
];

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave60 state');
  return state;
}

function baseState(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner = { cardId: PARTNER_ALL, state: 'active', location: 'partner-area' };
  state.players.self.case = {
    ...state.players.self.case, cardId: CASE_ALL, status: '解決編',
    colors: ['青', '緑', '白', '黄', '赤', '黒'],
  };
  state.players.self.file = Array.from({ length: 10 }, (_value, index) => ({
    type: 'card-back' as const, cardId: `W60-FILE-${index}`,
  }));
  state.players.self.deck = [DRAW_A, DRAW_B];
  state.players.opp.deck = [DRAW_A, DRAW_B, DRAW_A, DRAW_B];
  return state;
}

function install(state: GameState, label: string, human: Player = 'self'): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(cardId: string, abilityId: string, abilityIndex: number, verb: string) {
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.atomVerb, `${cardId}: pending verb`).toBe(verb);
  expect(pick?.source, `${cardId}: physical source`).toMatchObject({
    cardId, abilityId, abilityOrigin: 'printed', abilityIndex,
  });
  return pick!;
}

function resolvePick(pick: ReturnType<typeof pendingPick>, targetUid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pick, {
    type: 'effectPickResolve', pickedUid: targetUid,
  }))).toEqual({ ok: true });
}

function expectSettled(): void {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  expect([store.pendingEffectPick, store.pendingEffectOptional, store.pendingEffectChoice]).toEqual([null, null, null]);
  expect(current().pendingRuntimeState).toBeUndefined();
  expect(current().pendingEffects.every(entry => entry.state === 'resolved')).toBe(true);
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave60: stunned is a distinct upside-down character state', () => {
  // Card-bound physical rows: B02057/P B02083 D02004 D02013 PR060 PR064 PR154.
  it.each(['B02057', 'B02057P'])('$cardId treats its stunned source like sleep at self turn end', cardId => {
    const state = baseState();
    state.players.self.scene = [sceneChar(cardId, 'source', { state: 'stun' })];
    state.players.opp.scene = [sceneChar(LOW_TARGET, 'low-target')];
    install(state, `${cardId}:wave60-stun-end`);

    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    const pick = pendingPick(cardId, 'a1', 0, 'sceneRemove');
    expect(pick.candidates.map(entry => entry.uid)).toContain('low-target');
    resolvePick(pick, 'low-target');
    expect(current().players.opp.remove).toContain(LOW_TARGET);
    expect(current().players.self.scene.find(entry => entry.uid === 'source')?.state).toBe('stun');
  });

  it('B02057 accepts sleep but not active for the same end-phase condition', () => {
    for (const sourceState of ['sleep', 'active'] as const) {
      const state = baseState();
      state.players.self.scene = [sceneChar('B02057', 'source', { state: sourceState })];
      state.players.opp.scene = [sceneChar(LOW_TARGET, 'low-target')];
      install(state, `B02057:wave60-${sourceState}-end`);
      expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
      surfacePendingSideChannels();
      const pick = useGameStateStore.getState().pendingEffectPick;
      expect(pick?.source.cardId ?? null).toBe(sourceState === 'sleep' ? 'B02057' : null);
      if (pick) resolvePick(pick, null);
    }
  });

  it.each(['active', 'sleep', 'stun'] as const)(
    'B02083 turns a %s character into or keeps it in stun through public event use',
    initialState => {
      const state = baseState();
      state.players.self.hand = ['B02083'];
      state.players.self.scene = [sceneChar(STATE_TARGET, 'state-target', { state: initialState })];
      state.players.opp.scene = [sceneChar(ACTION_TARGET, 'action-target', { state: 'sleep' })];
      install(state, `B02083:wave60-${initialState}-to-stun`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: 'B02083' })).toEqual({ ok: true });
      const pick = pendingPick('B02083', 'a1', 0, 'sceneSetState');
      expect(pick.candidates.map(entry => entry.uid)).toContain('state-target');
      resolvePick(pick, 'state-target');
      expect(current().players.self.scene[0]?.state).toBe('stun');
      expect(dispatchEngineAction({
        type: 'actionDeclareChar', byUid: 'state-target', targetUid: 'action-target',
      })).toEqual({ ok: false, reason: 'not-allowed' });
      expect(dispatchEngineAction({ type: 'reasoning', uid: 'state-target' }))
        .toEqual({ ok: false, reason: 'not-allowed' });
      expectSettled();
    },
  );

  it('public state requests preserve stun for sleep/stun and replace active with sleep', () => {
    const state = baseState();
    state.players.self.scene = [
      sceneChar(STATE_DRIVER, 'state-driver'),
      sceneChar(STATE_TARGET, 'state-target', { state: 'stun' }),
    ];
    install(state, 'wave60-public-state-transition');

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'state-driver', abilId: 'sleep-request',
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: true });
    expect(current().players.self.scene[1]?.state).toBe('stun');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'state-driver', abilId: 'stun-request',
      abilityOrigin: 'printed', abilityIndex: 1,
    })).toEqual({ ok: true });
    expect(current().players.self.scene[1]?.state).toBe('stun');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'state-driver', abilId: 'active-request',
      abilityOrigin: 'printed', abilityIndex: 2,
    })).toEqual({ ok: true });
    expect(current().players.self.scene[1]?.state).toBe('sleep');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'state-driver', abilId: 'active-request',
      abilityOrigin: 'printed', abilityIndex: 2,
    })).toEqual({ ok: true });
    expect(current().players.self.scene[1]?.state).toBe('active');
  });

  it('D02004 counts one sleep and one stun before guard but excludes active', () => {
    for (const extraState of ['stun', 'active'] as const) {
      const state = baseState();
      state.players.self.scene = [sceneChar('D02004', 'source')];
      state.players.opp.scene = [
        sceneChar(LOW_TARGET, 'action-target', { state: 'sleep' }),
        sceneChar(HIGH_TARGET, 'extra-target', { state: extraState }),
      ];
      install(state, `D02004:wave60-count-${extraState}`);
      expect(current().players.self.scene[0]?.cardId).toBe('D02004');
      expect(dispatchEngineAction({
        type: 'actionDeclareChar', byUid: 'source', targetUid: 'action-target',
      })).toEqual({ ok: true });
      expect(readChar.ap(current(), 'source')).toBe(extraState === 'stun' ? 6000 : 5000);
      expect(current().players.self.scene[0]?.state).toBe('sleep');
    }
  });

  it('D02013 accepts sleep plus stun as its two-card gate and rejects an active substitute', () => {
    for (const extraState of ['stun', 'active'] as const) {
      const state = baseState();
      state.players.self.scene = [sceneChar('D02013', 'source'), sceneChar(GREEN_TARGET, 'green-target')];
      state.players.self.hand = [HAND_COST];
      state.players.opp.scene = [
        sceneChar(LOW_TARGET, 'sleep-target', { state: 'sleep' }),
        sceneChar(HIGH_TARGET, 'extra-target', { state: extraState }),
      ];
      install(state, `D02013:wave60-gate-${extraState}`);
      expect(current().players.self.scene[0]?.cardId).toBe('D02013');
      const result = dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a1',
        abilityOrigin: 'printed', abilityIndex: 0,
        costParams: { removeFromHand: { indices: [0] }, choiceIndex: 0 },
      });
      expect(result).toEqual(extraState === 'stun' ? { ok: true } : { ok: false, reason: 'not-allowed' });
      if (extraState === 'stun') {
        const pick = pendingPick('D02013', 'a1', 0, 'charGrantKeyword');
        resolvePick(pick, 'green-target');
        expect(readChar.hasKeyword(current(), 'green-target', '突撃')).toBe(true);
        expect(current().players.self.remove).toContain(HAND_COST);
      } else {
        expect(current().players.self.hand).toEqual([HAND_COST]);
        expect(current().players.self.remove).toEqual([]);
      }
    }
  });

  it.each(['PR060', 'PR064', 'PR154'])(
    '$cardId counts opponent stun toward its enter gate but removes only a sleep target',
    cardId => {
      const state = baseState();
      state.players.self.hand = [cardId];
      state.players.opp.scene = [
        sceneChar(LOW_TARGET, 'sleep-target', { state: 'sleep' }),
        sceneChar(HIGH_TARGET, 'stun-target', { state: 'stun' }),
      ];
      install(state, `${cardId}:wave60-enter-stun-gate`);
      expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId })).toEqual({ ok: true });
      const pick = pendingPick(cardId, 'a1', 0, 'sceneRemove');
      expect(pick.candidates.map(entry => entry.uid)).toContain('sleep-target');
      expect(pick.candidates.map(entry => entry.uid)).not.toContain('stun-target');
      resolvePick(pick, 'sleep-target');
      expect(current().players.opp.remove).toContain(LOW_TARGET);
      expect(current().players.opp.scene.find(entry => entry.uid === 'stun-target')?.state).toBe('stun');
      if (cardId === 'PR064') expect(current().players.self.scene.some(entry => entry.cardId === 'PR064')).toBe(true);
      if (cardId === 'PR154') expect(current().players.self.scene.some(entry => entry.cardId === 'PR154')).toBe(true);
    },
  );

  it('PR060 does not open removal with only one sleep and one active opponent', () => {
    const state = baseState();
    state.players.self.hand = ['PR060'];
    state.players.opp.scene = [
      sceneChar(LOW_TARGET, 'sleep-target', { state: 'sleep' }),
      sceneChar(HIGH_TARGET, 'active-target', { state: 'active' }),
    ];
    install(state, 'PR060:wave60-active-not-stun');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: 'PR060' })).toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.opp.scene.map(entry => entry.uid)).toEqual(['sleep-target', 'active-target']);
  });
});
