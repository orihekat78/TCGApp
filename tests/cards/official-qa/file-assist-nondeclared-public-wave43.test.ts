// qa: card:B06087:fe489ff3199dbdf91d8a4404721956da51ba17ccb819450ceed5b301f31fe7be
// qa: card:PR280:fe489ff3199dbdf91d8a4404721956da51ba17ccb819450ceed5b301f31fe7be
// qa: card:PR100:10c375683e0a24e0734188475895fd0fff2f1c3fe44724cb9d8261ea5d872b68
// qa: card:PR106:10c375683e0a24e0734188475895fd0fff2f1c3fe44724cb9d8261ea5d872b68
// Rules: 08-contact.md, 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const YELLOW_PARTNER = 'W43_YELLOW_PARTNER';
const ACTOR = 'W43_ACTOR';
const LOW_TARGET = 'W43_LOW_TARGET';
const HIGH_TARGET = 'W43_HIGH_TARGET';
const POLICE_ENTRY = 'W43_POLICE_ENTRY';
const SHIHO = 'W43_SHIHO';
const DECOY = 'W43_DECOY';

function character(id: string, ap: number, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黄'], level: 4,
    ap, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  } as CardDef;
}

function cardBacks(prefix: string, count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    type: 'card-back' as const,
    cardId: `${prefix}-${index}`,
  }));
}

function install(state: GameState, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave43 state');
  return state;
}

function closeAction(actionId: string): void {
  for (let step = 0; step < 3 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function openDecisionKinds(): string[] {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  return [
    ['optional', store.pendingEffectOptional],
    ['pick', store.pendingEffectPick],
  ].filter(entry => Boolean(entry[1])).map(entry => entry[0] as string);
}

function leaveState(cardId: 'B06087' | 'PR280', beforeCount: number): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner = { cardId: YELLOW_PARTNER, state: 'active', location: 'partner-area' };
  state.players.self.file = cardBacks(`${cardId}-SELF-FILE`, beforeCount);
  state.players.self.hand = [POLICE_ENTRY];
  state.players.self.scene = [sceneChar(cardId, 'source')];
  state.players.opp.scene = [sceneChar(LOW_TARGET, 'target', { state: 'sleep' })];
  state.players.opp.partner = { cardId: YELLOW_PARTNER, state: 'sleep', location: 'file-area' };
  state.players.opp.file = [
    ...cardBacks(`${cardId}-OPP-FILE`, 5),
    { type: 'assisted-partner', cardId: YELLOW_PARTNER },
  ];
  return state;
}

function runLeave(cardId: 'B06087' | 'PR280', beforeCount: number) {
  install(leaveState(cardId, beforeCount), `qa-w43-leave-${cardId}-${beforeCount}`);
  const assist = dispatchEngineAction({ type: 'assist', player: 'self' }).ok;
  const declared = dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'target' }).ok;
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  surfacePendingSideChannels();
  const optionalBeforeJudge = useGameStateStore.getState().pendingEffectOptional?.source.cardId ?? null;
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });

  surfacePendingSideChannels();
  const optional = useGameStateStore.getState().pendingEffectOptional;
  const optionalSource = optional?.source.cardId ?? null;
  if (optional) {
    expect(optional.source).toMatchObject({ cardId, uid: 'source', abilityId: 'a2' });
    expect(dispatchEngineAction(bindPendingDecision(optional, {
      type: 'optionalResolve', run: true,
    }))).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pick = useGameStateStore.getState().pendingEffectPick;
    if (pick) {
      const candidate = pick.candidates.find(entry => entry.cardId === POLICE_ENTRY);
      expect(candidate, `${cardId}: police continuation`).toBeTruthy();
      expect(dispatchEngineAction(bindPendingDecision(pick, {
        type: 'effectPickResolve', pickedUid: candidate!.uid,
      }))).toEqual({ ok: true });
    }
  }
  closeAction(actionId);
  const state = current();
  return {
    assist,
    declared,
    fileCount: state.players.self.file.length,
    opponentFileCount: state.players.opp.file.length,
    selfAssistedEntries: state.players.self.file.filter(entry => entry.type === 'assisted-partner').length,
    optionalBeforeJudge,
    optionalSource,
    sourceState: state.players.self.scene.find(character => character.uid === 'source')?.state,
    sourceRemoved: state.players.self.remove.includes(cardId),
    policeEntered: state.players.self.scene.some(character => character.cardId === POLICE_ENTRY),
    hand: [...state.players.self.hand],
    targetRemoved: !state.players.opp.scene.some(character => character.uid === 'target')
      && state.players.opp.remove.includes(LOW_TARGET),
    settled: openDecisionKinds().length === 0,
  };
}

function cutinState(cardId: 'PR100' | 'PR106', beforeCount: number): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner = { cardId: YELLOW_PARTNER, state: 'active', location: 'partner-area' };
  state.players.self.case.status = '解決編';
  state.players.self.file = cardBacks(`${cardId}-SELF-FILE`, beforeCount);
  state.players.self.hand = [cardId];
  state.players.self.remove = [SHIHO, DECOY];
  state.players.self.scene = [sceneChar(ACTOR, 'actor')];
  state.players.opp.scene = [sceneChar(HIGH_TARGET, 'target', { state: 'sleep' })];
  state.players.opp.partner = { cardId: YELLOW_PARTNER, state: 'sleep', location: 'file-area' };
  state.players.opp.file = [
    ...cardBacks(`${cardId}-OPP-FILE`, 3),
    { type: 'assisted-partner', cardId: YELLOW_PARTNER },
  ];
  return state;
}

function runCutin(cardId: 'PR100' | 'PR106', beforeCount: number) {
  install(cutinState(cardId, beforeCount), `qa-w43-cutin-${cardId}-${beforeCount}`);
  const assist = dispatchEngineAction({ type: 'assist', player: 'self' }).ok;
  const declared = dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor', targetUid: 'target' }).ok;
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  const cutin = dispatchEngineAction({
    type: 'actionContact', actionId, player: 'self', choice: { kind: 'cutin', cardId },
  }).ok;

  surfacePendingSideChannels();
  const optional = useGameStateStore.getState().pendingEffectOptional;
  const optionalSource = optional?.source.cardId ?? null;
  if (optional) {
    expect(optional.source).toMatchObject({ cardId, abilityId: 'a1' });
    expect(dispatchEngineAction(bindPendingDecision(optional, {
      type: 'optionalResolve', run: true,
    }))).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pick = useGameStateStore.getState().pendingEffectPick;
    if (pick) {
      const candidate = pick.candidates.find(entry => entry.cardId === SHIHO);
      expect(candidate, `${cardId}: Miyano continuation`).toBeTruthy();
      expect(dispatchEngineAction(bindPendingDecision(pick, {
        type: 'effectPickResolve', pickedUid: candidate!.uid,
      }))).toEqual({ ok: true });
    }
  }

  const cutInUsed = current().actionContexts?.[actionId]?.cutInUsed?.self === true;
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  closeAction(actionId);

  const state = current();
  return {
    assist,
    declared,
    cutin,
    fileCount: state.players.self.file.length,
    opponentFileCount: state.players.opp.file.length,
    selfAssistedEntries: state.players.self.file.filter(entry => entry.type === 'assisted-partner').length,
    optionalSource,
    cutInUsed,
    hand: [...state.players.self.hand],
    cutinRemoved: state.players.self.remove.includes(cardId),
    shihoEntered: state.players.self.scene.some(character => character.cardId === SHIHO),
    shihoInRemove: state.players.self.remove.includes(SHIHO),
    settled: openDecisionKinds().length === 0,
  };
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _resetActionContexts();
  resetPendingRuntimeState();
  registerAll();
  [
    character(YELLOW_PARTNER, 0, { kind: 'partner' }),
    character(ACTOR, 1000),
    character(LOW_TARGET, 1000),
    character(HIGH_TARGET, 9000),
    character(POLICE_ENTRY, 3000, { names: ['佐藤美和子'], traits: ['警察'], level: 7 }),
    character(SHIHO, 3000, { names: ['宮野志保'], level: 5 }),
    character(DECOY, 3000, { names: ['対象外'], level: 5 }),
  ].forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
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

describe('official QA Wave43: non-declared FILE conditions count the assisting partner', () => {
  it.each(['B06087', 'PR280'] as const)('%s enables its contact-removal optional only at FILE6', (cardId) => {
    expect({ cardId, below: runLeave(cardId, 4), exact: runLeave(cardId, 5) }).toEqual({
      cardId,
      below: { assist: true, declared: true, fileCount: 5, opponentFileCount: 6, selfAssistedEntries: 1, optionalBeforeJudge: null, optionalSource: null, sourceState: 'sleep', sourceRemoved: false, policeEntered: false, hand: [POLICE_ENTRY], targetRemoved: true, settled: true },
      exact: { assist: true, declared: true, fileCount: 6, opponentFileCount: 6, selfAssistedEntries: 1, optionalBeforeJudge: null, optionalSource: cardId, sourceState: undefined, sourceRemoved: true, policeEntered: true, hand: [], targetRemoved: true, settled: true },
    });
  });

  it.each(['PR100', 'PR106'] as const)('%s can cut in below FILE4 but gains text only when assist reaches four', (cardId) => {
    expect({ cardId, below: runCutin(cardId, 2), exact: runCutin(cardId, 3) }).toEqual({
      cardId,
      below: { assist: true, declared: true, cutin: true, fileCount: 3, opponentFileCount: 4, selfAssistedEntries: 1, optionalSource: null, cutInUsed: true, hand: [], cutinRemoved: true, shihoEntered: false, shihoInRemove: true, settled: true },
      exact: { assist: true, declared: true, cutin: true, fileCount: 3, opponentFileCount: 4, selfAssistedEntries: 1, optionalSource: cardId, cutInUsed: true, hand: [`${cardId}-SELF-FILE-2`], cutinRemoved: true, shihoEntered: true, shihoInRemove: false, settled: true },
    });
  });
});
