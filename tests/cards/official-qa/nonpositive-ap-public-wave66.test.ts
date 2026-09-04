// qa: card:B02021:fde26b8ea125c4e1554955fecf095ce90a82720da365795236b28d2330727deb
// qa: card:B02060:fde26b8ea125c4e1554955fecf095ce90a82720da365795236b28d2330727deb
// qa: card:B03127:fde26b8ea125c4e1554955fecf095ce90a82720da365795236b28d2330727deb
// qa: card:D11021:64f20835aa771e027c4e116a9e09df91241c0cd1a561ef1a36d170d461790875
// Rules: 19-special-rules. AP has no lower bound and never removes a character.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B02021 } from '@/cards/ct-p02/B02021';
import { B02060 } from '@/cards/ct-p02/B02060';
import { B03127 } from '@/cards/ct-p03/B03127';
import { D11021 } from '@/cards/ct-d11/D11021';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { isCausalLogEntry, startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { projectReplayStateForViewer } from '@/ui/services/replayViewerProjection';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const LOW_AP = 'W66-LOW-AP';
const LOW_UID = 'wave66-low-ap';
const ENTRY_SOURCE = 'W66-ENTRY-SOURCE';
const ENTRY_SOURCE_UID = 'wave66-entry-source';
const KANAGAWA = 'W66-KANAGAWA';
const CASE = 'W66-CASE';

function character(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: 'test/' + id, kind: 'character', names: [id], colors: ['青'],
    level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

const enterB02060: AbilityDef = {
  id: 'enter-b02060',
  type: 'declared',
  scope: 'on-scene',
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      cardId: B02060.id,
      viaEffect: true,
      target: { query: { area: 'remove', side: 'self' } },
    },
  },
  description: '',
  ruleRefs: [],
};

const fixtures: CardDef[] = [
  character(LOW_AP, { ap: 500 }),
  character(ENTRY_SOURCE, { abilities: [enterB02060] }),
  character(KANAGAWA, { traits: ['神奈川県警'] }),
  character(CASE, { kind: 'case', caseLevel: 7, caseTraits: [] }),
];

function baseState(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case = {
    ...state.players.self.case,
    cardId: CASE,
    status: '事件編',
    colors: ['青'],
    declaredUseCount: {},
  };
  state.players.opp.scene = [sceneChar(LOW_AP, LOW_UID)];
  return state;
}

function install(state: GameState, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave66 state');
  return state;
}

function resolveLowTarget(cardId: string, abilityId: string): void {
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.atomVerb, cardId + ': AP modifier reaches public pick').toBe('charModifyAP');
  expect(pick?.source, cardId + ': printed source authority').toMatchObject({
    cardId,
    abilityId,
  });
  const candidate = pick?.candidates.find(entry => entry.uid === LOW_UID);
  expect(candidate, cardId + ': low-AP target is selectable').toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve',
    pickedUid: candidate!.uid,
    ...(pick!.nMax > 1 ? { pickedUids: [candidate!.uid] } : {}),
  }))).toEqual({ ok: true });
}

function expectNonpositiveAP(cardId: string, expectedAP: number): void {
  const state = current();
  expect(readChar.ap(state, LOW_UID), cardId + ': signed AP remains authoritative').toBe(expectedAP);
  expect(state.players.opp.scene.some(entry => entry.uid === LOW_UID),
    cardId + ': AP at or below zero does not remove the target').toBe(true);
  expect(state.players.opp.remove, cardId + ': target never enters remove').not.toContain(LOW_AP);
  expect(state.log.filter(isCausalLogEntry).some(entry => (
    entry.kind === 'zone-move'
    && entry.outcome.type === 'move'
    && entry.outcome.to === 'remove'
    && entry.targets.some(target => target.cardNumber === LOW_AP)
  )), cardId + ': no causal removal event exists').toBe(false);
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
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('official QA Wave66: AP at or below zero never removes a character', () => {
  it('B02021 public declaration may reduce an opponent to zero without removal', () => {
    const state = baseState();
    state.players.self.scene = [sceneChar(B02021.id, 'wave66-b02021')];
    state.players.opp.scene[0]!.apOverride = 1000;
    install(state, 'B02021:wave66-nonpositive-ap');

    expect(dispatchEngineAction({
      type: 'declaredAbility',
      uid: 'wave66-b02021',
      abilId: 'a1',
      abilityOrigin: 'printed',
      abilityIndex: 0,
    })).toEqual({ ok: true });
    resolveLowTarget(B02021.id, 'a1');
    expectNonpositiveAP(B02021.id, 0);
  });

  it('B02060 effect entry uses its printed enter rider without removing a negative-AP target', () => {
    const state = baseState();
    state.players.self.scene = [sceneChar(ENTRY_SOURCE, ENTRY_SOURCE_UID)];
    state.players.self.remove = [B02060.id];
    install(state, 'B02060:wave66-nonpositive-ap');

    expect(dispatchEngineAction({
      type: 'declaredAbility',
      uid: ENTRY_SOURCE_UID,
      abilId: enterB02060.id,
      abilityOrigin: 'printed',
      abilityIndex: 0,
    })).toEqual({ ok: true });
    expect(current().players.self.scene.some(entry => entry.cardId === B02060.id)).toBe(true);
    resolveLowTarget(B02060.id, 'a2');
    expectNonpositiveAP(B02060.id, -500);
  });

  it('B03127 public declaration retains a target at negative AP', () => {
    const state = baseState();
    state.players.self.scene = [sceneChar(B03127.id, 'wave66-b03127')];
    install(state, 'B03127:wave66-nonpositive-ap');

    expect(dispatchEngineAction({
      type: 'declaredAbility',
      uid: 'wave66-b03127',
      abilId: 'a1',
      abilityOrigin: 'printed',
      abilityIndex: 0,
    })).toEqual({ ok: true });
    resolveLowTarget(B03127.id, 'a1');
    expectNonpositiveAP(B03127.id, -1500);

    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    const replay = projectReplayStateForViewer(current(), 'spectator');
    expect(readChar.ap(replay, LOW_UID)).toBe(-1500);
    expect(replay.players.opp.scene.some(entry => entry.uid === LOW_UID)).toBe(true);

    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    expect(readChar.ap(current(), LOW_UID)).toBe(500);
    expect(current().players.opp.scene.some(entry => entry.uid === LOW_UID)).toBe(true);
  });

  it('D11021 scales its real evidence cost and keeps the reduced target in scene', () => {
    const state = baseState();
    state.players.self.case = {
      ...state.players.self.case,
      cardId: D11021.id,
      status: '解決編',
      colors: [...D11021.colors],
      declaredUseCount: {},
    };
    state.players.self.scene = [sceneChar(KANAGAWA, 'wave66-kanagawa')];
    state.players.self.evidence = [
      { cardId: 'W66_EV_A', faceUp: false, origin: { turn: 1, via: 'opening' } },
      { cardId: 'W66_EV_B', faceUp: true, origin: { turn: 2, via: 'effect' } },
      { cardId: 'W66_EV_C', faceUp: false, origin: { turn: 3, via: 'reasoning' } },
      { cardId: 'W66_EV_D', faceUp: false, origin: { turn: 4, via: 'effect' } },
    ];
    install(state, 'D11021:wave66-nonpositive-ap');

    expect(dispatchEngineAction({
      type: 'declaredAbility',
      uid: 'case:self',
      abilId: 'a2',
      abilityOrigin: 'printed',
      abilityIndex: 1,
      costParams: { flipFaceUpEvidence: { indices: [3, 0] } },
    })).toEqual({ ok: true });
    resolveLowTarget(D11021.id, 'a2');
    expectNonpositiveAP(D11021.id, -1500);
  });
});
