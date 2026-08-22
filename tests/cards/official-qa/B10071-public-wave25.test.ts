// qa: card:B10071:816d7965a6d1b8124bc6be2098194d8f3f19a88be3cdc253bf643cfdff0e1e69
// qa: card:B10071:b03496844f483103c37e4b79af9113357afe81ac9a539d0cfc74e0e5b4252f97
// qa: card:B10071:d20637cb4e569f06557bf551ad6e4330c5b7f5cfbe960c6ea68201f42a693710
// qa: card:B10071:d61b14358b588346603e172dcd780d63026d64367b2dceb873d9702a619a355b
// Rules: 07-action-flow.md, 10-action-event.md, 11-reasoning.md, 15-abilities-effects.md, 17-icons.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B06093 } from '@/cards/ct-p06/B06093';
import { B10071 } from '@/cards/ct-p10/B10071';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import {
  _resetMisreadRegistered,
  _resetPendingMisread,
  registerMisreadListener,
} from '@/engine/listeners/misread';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { makeChar } from '../../helpers/fixtures';

const REASONER = 'QA_B10071_REASONER';
const CASE_ACTOR = 'QA_B10071_CASE_ACTOR';
const MOROFUSHI = 'QA_B10071_MOROFUSHI';
const MR_TARGET = 'QA_B10071_MR_TARGET';
const HIGH_TARGET = 'QA_B10071_HIGH_TARGET';

function character(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黄'], level: 7,
    ap: 1000, lp: 5, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

const fixtures = [
  character(REASONER),
  character(CASE_ACTOR),
  character(MOROFUSHI, { names: ['諸伏景光'] }),
  character(MR_TARGET, { level: 9, rarity: 'MR' }),
  character(HIGH_TARGET, { level: 10 }),
];

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing B10071 Wave 25 game state');
  return state;
}

function install(state: GameState): void {
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  surfacePendingSideChannels();
}

function opponentTurnState(sourceState: 'active' | 'sleep' = 'sleep'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [makeChar({ cardId: B10071.id, uid: 'yamamura', state: sourceState })];
  state.players.opp.scene = [
    makeChar({ cardId: CASE_ACTOR, uid: 'case-actor-a' }),
    makeChar({ cardId: CASE_ACTOR, uid: 'case-actor-b' }),
  ];
  state.players.opp.deck = Array.from({ length: 3 }, (_, index) => `QA_B10071_DECK_${index}`);
  state.players.self.evidence = Array.from({ length: 3 }, (_, index) => ({
    cardId: `QA_B10071_EVIDENCE_${index}`,
    faceUp: false,
    origin: { turn: 1, via: 'opening' as const },
  }));
  state.players.self.case.requiredEvidence = 99;
  return state;
}

function declareCase(uid: string): string {
  expect(dispatchEngineAction({ type: 'actionDeclareCase', byUid: uid, targetPlayer: 'self' })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  return actionId!;
}

function finishCaseAction(actionId: string): void {
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  for (let index = 0; index < 5 && useGameStateStore.getState().activeActionId === actionId; index += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function resolveWake(run: boolean): void {
  surfacePendingSideChannels();
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional?.source).toMatchObject({ cardId: B10071.id, uid: 'yamamura', abilityId: 'a2' });
  expect(dispatchEngineAction(bindPendingDecision(optional!, {
    type: 'optionalResolve', run,
  }))).toEqual({ ok: true });
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetActionContexts();
  _resetTriggeredRegistered();
  _resetPendingMisread();
  _resetMisreadRegistered();
  [B06093, B10071, ...fixtures].forEach(register);
  registerTriggeredListener();
  registerMisreadListener();
  endMatchSession();
  beginMatchSession('self');
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null });
});

afterEach(() => {
  endMatchSession();
  _resetActionContexts();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('B10071 official QA through public actions', () => {
  it('combines its Misread 3 with another simultaneous Misread in one public reasoning decision', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.scene = [makeChar({ cardId: REASONER, uid: 'reasoner' })];
    state.players.self.scene = [
      makeChar({ cardId: B10071.id, uid: 'yamamura' }),
      makeChar({ cardId: B06093.id, uid: 'other-misread' }),
    ];
    state.players.opp.deck = Array.from({ length: 8 }, (_, index) => `EVIDENCE-${index}`);
    install(state);

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingMisread;
    expect(pending?.candidates).toEqual([
      { uid: 'yamamura', x: 3 },
      { uid: 'other-misread', x: 2 },
    ]);
    expect(dispatchCurrentDecision({ type: 'misreadResolve', picks: pending!.candidates })).toEqual({ ok: true });

    expect(current().players.self.scene.map(character => character.state)).toEqual(['sleep', 'sleep']);
    expect(current().players.opp.evidence).toHaveLength(0);
    expect(useGameStateStore.getState().pendingMisread).toBeNull();
  });

  it('offers the wake effect after declaration and target sleep, before the guard decision', () => {
    install(opponentTurnState('sleep'));
    const actionId = declareCase('case-actor-a');

    expect(current().players.opp.scene.find(character => character.uid === 'case-actor-a')?.state).toBe('sleep');
    expect(useGameStateStore.getState().pendingEffectOptional?.source).toMatchObject({
      cardId: B10071.id, abilityId: 'a2', uid: 'yamamura',
    });
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }).ok).toBe(false);

    resolveWake(true);
    expect(current().players.self.scene.find(character => character.uid === 'yamamura')?.state).toBe('active');
    finishCaseAction(actionId);
  });

  it('consumes Turn 1 when the source is already active and when its optional effect is declined', () => {
    install(opponentTurnState('active'));
    let actionId = declareCase('case-actor-a');
    resolveWake(true);
    expect(readChar.declaredUseCount(current(), 'yamamura', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 1,
    })).toBe(1);
    finishCaseAction(actionId);
    actionId = declareCase('case-actor-b');
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(readChar.declaredUseCount(current(), 'yamamura', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 1,
    })).toBe(1);
    finishCaseAction(actionId);

    install(opponentTurnState('sleep'));
    actionId = declareCase('case-actor-a');
    resolveWake(false);
    expect(readChar.declaredUseCount(current(), 'yamamura', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 1,
    })).toBe(1);
    finishCaseAction(actionId);
    actionId = declareCase('case-actor-b');
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(readChar.declaredUseCount(current(), 'yamamura', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 1,
    })).toBe(1);
    finishCaseAction(actionId);
  });

  it('redirects an opponent MR moved toward hand to that opponent partner area', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      makeChar({ cardId: B10071.id, uid: 'yamamura' }),
      makeChar({ cardId: MOROFUSHI, uid: 'morofushi' }),
    ];
    state.players.opp.scene = [
      makeChar({ cardId: MR_TARGET, uid: 'mr-target', state: 'sleep' }),
      makeChar({ cardId: HIGH_TARGET, uid: 'high-target', state: 'sleep' }),
    ];
    install(state);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'yamamura', abilId: 'a3' })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending?.candidates.map(candidate => candidate.uid)).toEqual(['mr-target']);
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: 'mr-target',
    }))).toEqual({ ok: true });

    expect(current().players.opp.scene.map(character => character.uid)).toEqual(['high-target']);
    expect(current().players.opp.hand).toEqual([]);
    expect(current().players.opp.partnerAreaMR).toMatchObject({ cardId: MR_TARGET });
  });
});
