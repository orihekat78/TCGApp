// qa: card:B03094:3e54bbed10ce6842d1023560a2b7dd83568ca8dd44f892439011d6b3afb17059
// qa: card:B03094:5b6baf97ab8a140a976bfd146e307cb324ac5e702a0e23347a8069d99ce8178c
// qa: card:B03094:6701e39fe90fb5d238ccc4acb43c8136b47014e1749ae3557797f7de0f6bf13e
// qa: card:B03094:9e084cf085f22eef16c2055f8f9232946d3ea27dccdc48e09f6017c75558a781

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B03094 } from '@/cards/ct-p03/B03094';
import { B03094P } from '@/cards/ct-p03/B03094P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const REACTIVATOR = 'W149_REACTIVATOR';
const CASE = 'W149_CASE';
const EVIDENCE_A = 'W149_EVIDENCE_A';
const EVIDENCE_B = 'W149_EVIDENCE_B';
const DECK = ['W149_MILL_1', 'W149_MILL_2', 'W149_GAIN_1', 'W149_MILL_3', 'W149_MILL_4', 'W149_GAIN_2', 'W149_TAIL'] as const;

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['黄'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const REACTIVATE_ABILITY: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene',
  effect: {
    kind: 'atom', verb: 'sceneSetState',
    args: { player: 'self', side: 'self', max: 1, state: 'active', filter: { cardName: '萩原千速' } },
  },
  description: 'Activate one own Chihaya Hagiwara.',
  ruleRefs: ['rules/03-field-areas.md'],
};

const REACTIVATOR_CARD = fixture(REACTIVATOR, { abilities: [REACTIVATE_ABILITY] });
const ROWS = [
  { label: 'base-self', owner: 'self' as const, card: B03094 },
  { label: 'parallel-opp', owner: 'opp' as const, card: B03094P },
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave149 state');
  return state;
}

function install(owner: Player, card: CardDef, deck: string[], label: string): void {
  const defender = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 49, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(card.id, 'chihaya'), sceneChar(REACTIVATOR, 'reactivator')];
  state.players[owner].deck = [...deck];
  state.players[defender].case = {
    ...state.players[defender].case, cardId: CASE, status: '事件編', colors: ['青'],
  };
  state.players[defender].evidence = [
    { cardId: EVIDENCE_A, faceUp: false, origin: { turn: 1, via: 'opening' } },
    { cardId: EVIDENCE_B, faceUp: false, origin: { turn: 1, via: 'opening' } },
  ];
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave149-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function startCaseAction(owner: Player): { actionId: string; optional: NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectOptional']> } {
  expect(dispatchEngineAction({
    type: 'actionDeclareCase', byUid: 'chihaya', targetPlayer: other(owner),
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  surfacePendingSideChannels();
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional).toMatchObject({ player: owner, source: { cardId: current().players[owner].scene[0]?.cardId, abilityId: 'a2' } });
  expect(current().players[owner].scene.find(character => character.uid === 'chihaya')?.state).toBe('sleep');
  return { actionId, optional: optional! };
}

function resolveMill(optional: NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectOptional']>): void {
  expect(dispatchEngineAction(bindPendingDecision(optional, {
    type: 'optionalResolve', run: true,
  }))).toEqual({ ok: true });
}

function finishCaseAction(actionId: string): void {
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  for (let step = 0; step < 4 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function reactivate(): void {
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'reactivator', abilId: 'a1' }))
    .toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toMatchObject({ atomVerb: 'sceneSetState' });
  expect(pick?.candidates.map(candidate => candidate.uid)).toEqual(['chihaya']);
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: 'chihaya',
  }))).toEqual({ ok: true });
  expect(current().players[current().turn.player].scene.find(character => character.uid === 'chihaya')?.state)
    .toBe('active');
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  registerAll();
  [
    REACTIVATOR_CARD, fixture(CASE, { kind: 'case', caseLevel: 7, caseTraits: [] }),
    fixture(EVIDENCE_A), fixture(EVIDENCE_B), ...DECK.map(id => fixture(id)),
  ].forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave149: B03094 action declaration boundary', () => {
  it.each(ROWS)('$label fires a2 without a yellow partner and before guard', ({ owner, card, label }) => {
    install(owner, card, [...DECK], `${label}-timing`);
    expect(readChar.hasKeyword(current(), 'chihaya', '突撃')).toBe(false);
    const { actionId, optional } = startCaseAction(owner);
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: false, reason: 'not-allowed' });

    resolveMill(optional);
    expect(current().players[owner].remove).toEqual([DECK[0], DECK[1]]);
    expect(readChar.ap(current(), 'chihaya')).toBe(6000);
    finishCaseAction(actionId);
    expect(readChar.ap(current(), 'chihaya')).toBe(5000);
  });
});

describe('official QA Wave149: B03094 exact mill gate', () => {
  it.each(ROWS)('$label cannot partially mill one card or gain AP', ({ owner, card, label }) => {
    install(owner, card, [DECK[0]], `${label}-deck-one`);
    const { actionId, optional } = startCaseAction(owner);
    resolveMill(optional);

    expect(current().players[owner].deck).toEqual([DECK[0]]);
    expect(current().players[owner].remove).toEqual([]);
    expect(readChar.ap(current(), 'chihaya')).toBe(5000);
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  });
});

describe('official QA Wave149: B03094 has no Turn1 and no cross-action AP carryover', () => {
  it.each(ROWS)('$label resolves on both actions and expires after each action', ({ owner, card, label }) => {
    install(owner, card, [...DECK], `${label}-repeat`);
    const first = startCaseAction(owner);
    resolveMill(first.optional);
    expect(readChar.ap(current(), 'chihaya')).toBe(6000);
    finishCaseAction(first.actionId);
    expect(readChar.ap(current(), 'chihaya')).toBe(5000);

    reactivate();
    const second = startCaseAction(owner);
    resolveMill(second.optional);
    expect(readChar.ap(current(), 'chihaya')).toBe(6000);
    finishCaseAction(second.actionId);
    expect(readChar.ap(current(), 'chihaya')).toBe(5000);
    expect(current().players[owner].remove).toEqual([DECK[0], DECK[1], DECK[3], DECK[4]]);
  });
});
