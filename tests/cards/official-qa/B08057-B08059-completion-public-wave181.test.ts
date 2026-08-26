// qa: card:B08057:291f87522e2089d9232b03fc488c0790757f2e96f260d1b155bbdd6f24c2678e
// qa: card:B08057:fa43ed745439324401acbe56f8a54fdb451168e8ce6dc2aaacce43a43e859242
// qa: card:B08059:24724a7bdd74ed439861b6795dd7242b2f30cd9413262f35d42547dc0d2c5ebe
// qa: card:B08059:9a421079649c8d63d427807ffafc76098de894204ffd846a6d6efd234367d681

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B08057 } from '@/cards/ct-p08/B08057';
import { B08059 } from '@/cards/ct-p08/B08059';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { runCardScenario } from '../../helpers/card-probe-harness';
import type { ProbeScenario } from '../../helpers/card-probe-harness';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['赤'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const LEVEL_SEVEN_A = fixture('W181_LEVEL_SEVEN_A', { level: 7, ap: 3000 });
const LEVEL_SEVEN_B = fixture('W181_LEVEL_SEVEN_B', { level: 7, ap: 4000 });
const LEVEL_FIVE = fixture('W181_LEVEL_FIVE', { level: 5 });
const ACTION_TARGET = fixture('W181_ACTION_TARGET', { colors: ['青'], ap: 2000 });
const DECK_FILLER = fixture('W181_DECK_FILLER', { kind: 'event' });
const FIXTURES = [LEVEL_SEVEN_A, LEVEL_SEVEN_B, LEVEL_FIVE, ACTION_TARGET, DECK_FILLER];

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave181 game state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave181-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function finishAction(actionId: string): void {
  for (let step = 0; step < 20; step += 1) {
    const action = flow.action._getContext(current(), actionId);
    if (!action) return;
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const uid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player: Player = current().players.self.scene.some(character => character.uid === uid)
        ? 'self'
        : 'opp';
      expect(dispatchEngineAction({ type: 'actionContact', actionId, player, choice: { kind: 'pass' } }))
        .toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    if (action.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('Wave181 action did not settle');
}

function b08057State(deckSize: number): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 181, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.status = '解決編';
  state.players.self.scene = [
    sceneChar(B08057.id, 'elena'),
    sceneChar(LEVEL_SEVEN_A.id, 'level-seven-a'),
    sceneChar(LEVEL_SEVEN_B.id, 'level-seven-b'),
  ];
  state.players.self.deck = Array.from({ length: deckSize }, () => DECK_FILLER.id);
  state.players.opp.deck = Array.from({ length: 9 }, () => LEVEL_FIVE.id);
  return state;
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave181: B08057 exact owner-deck cost', () => {
  it('cannot substitute nine opponent cards for an eight-card owner deck', () => {
    const shortOwnerDeck = b08057State(8);
    install(shortOwnerDeck, 'self', 'B08057-short-owner-deck');
    const before = {
      selfDeck: [...current().players.self.deck],
      oppDeck: [...current().players.opp.deck],
      remove: [...current().players.self.remove],
      sourceState: current().players.self.scene.find(character => character.uid === 'elena')?.state,
    };
    expect(shortOwnerDeck.players.opp.deck).toHaveLength(9);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'elena', abilId: 'a2' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect({
      selfDeck: current().players.self.deck,
      oppDeck: current().players.opp.deck,
      remove: current().players.self.remove,
      sourceState: current().players.self.scene.find(character => character.uid === 'elena')?.state,
    }).toEqual(before);

    const exactOwnerDeck = b08057State(9);
    install(exactOwnerDeck, 'self', 'B08057-exact-owner-deck');
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'elena', abilId: 'a2' }))
      .toEqual({ ok: true });
    expect(current().players.self.scene.find(character => character.uid === 'elena')?.state).toBe('sleep');
    expect(current().refreshCount.self).toBe(1);
    expect(current().players.self.deck).toHaveLength(9);
    expect(current().players.self.remove).toEqual([]);
    expect(current().players.opp.deck).toHaveLength(9);
    expect(current().refreshCount.opp).toBe(0);
  });

  it('can select a level-five card that the just-paid top-nine cost moved into remove', () => {
    const scenario: ProbeScenario = {
      name: 'official QA Wave181 B08057 cost-origin tail candidate',
      setup: {
        caseStatus: '解決編',
        selfScene: [
          { cardId: B08057.id, uid: 'u0' },
          { cardId: LEVEL_SEVEN_A.id, uid: 'u7a' },
          { cardId: LEVEL_SEVEN_B.id, uid: 'u7b' },
        ],
        remove: [],
        deckTop: [LEVEL_FIVE.id],
        deckSize: 9,
        fileCount: 3,
      },
      drive: { kind: 'declared', uid: 'u0', abilityId: 'a2' },
      script: [{ pickCardId: LEVEL_FIVE.id }],
      expect: [
        { kind: 'state', uid: 'u0', state: 'sleep' },
        { kind: 'zone', cardId: LEVEL_FIVE.id, zone: 'deck', side: 'self', present: true },
        { kind: 'zone', cardId: LEVEL_FIVE.id, zone: 'remove', side: 'self', present: false },
      ],
    };

    const resolved = runCardScenario(B08057, FIXTURES, scenario);
    expect(resolved.players.self.deck).toContain(LEVEL_FIVE.id);
    expect(resolved.players.self.remove).not.toContain(LEVEL_FIVE.id);
  });
});

describe('official QA Wave181: B08059 continuous self-latch and started action', () => {
  it('keeps its aura with one external level seven, then loses it when the last one leaves', () => {
    const state = createEmptyGameState();
    state.turn = { number: 181, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar(B08059.id, 'moroboshi'),
      sceneChar(LEVEL_SEVEN_A.id, 'level-seven-a'),
      sceneChar(LEVEL_SEVEN_B.id, 'level-seven-b'),
    ];

    expect(read.char.level(state, 'moroboshi')).toBe(7);
    expect(read.char.ap(state, 'moroboshi')).toBe((B08059.ap ?? 0) + 1000);
    expect(read.char.hasKeyword(state, 'moroboshi', '突撃')).toBe(true);

    mutate.scene.removeToRemove(state, 'level-seven-a', 'effect', undefined, { byPlayer: 'opp' });
    runAllUntilEmpty(state);
    expect(read.char.level(state, 'moroboshi')).toBe(7);
    expect(read.char.hasKeyword(state, 'moroboshi', '突撃')).toBe(true);

    mutate.scene.removeToRemove(state, 'level-seven-b', 'effect', undefined, { byPlayer: 'opp' });
    runAllUntilEmpty(state);
    expect(read.char.level(state, 'moroboshi')).toBe(6);
    expect(read.char.ap(state, 'moroboshi')).toBe(B08059.ap);
    expect(read.char.hasKeyword(state, 'moroboshi', '突撃')).toBe(false);
  });

  it('continues an already-declared action after the aura condition is lost', () => {
    const state = createEmptyGameState();
    state.turn = { number: 181, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar(B08059.id, 'moroboshi'),
      sceneChar(LEVEL_SEVEN_A.id, 'level-seven-a'),
    ];
    state.players.opp.scene = [sceneChar(ACTION_TARGET.id, 'target', { state: 'sleep' })];
    install(state, 'self', 'B08059-action-persists');
    expect(read.char.hasKeyword(current(), 'moroboshi', '突撃')).toBe(true);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'moroboshi', targetUid: 'target' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;

    const withoutLevelSeven = structuredClone(current());
    mutate.scene.removeToRemove(withoutLevelSeven, 'level-seven-a', 'effect', undefined, { byPlayer: 'opp' });
    runAllUntilEmpty(withoutLevelSeven);
    expect(useGameStateStore.getState().setGameState(withoutLevelSeven)).toBe(true);
    expect(read.char.hasKeyword(current(), 'moroboshi', '突撃')).toBe(false);
    expect(current().actionContexts?.[actionId]).toBeDefined();

    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    finishAction(actionId);
    expect(current().actionContexts?.[actionId]).toBeUndefined();
    expect(useGameStateStore.getState().activeActionId).toBeNull();
  });
});

describe('official QA Wave181: owner=opp mirrors', () => {
  function oppB08057State(deckSize: number): GameState {
    const state = createEmptyGameState();
    state.turn = { number: 181, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.case.status = '解決編';
    state.players.opp.scene = [
      sceneChar(B08057.id, 'opp-elena'),
      sceneChar(LEVEL_SEVEN_A.id, 'opp-level-seven-a'),
      sceneChar(LEVEL_SEVEN_B.id, 'opp-level-seven-b'),
    ];
    state.players.opp.deck = Array.from({ length: deckSize }, () => DECK_FILLER.id);
    state.players.self.deck = Array.from({ length: 9 }, () => LEVEL_FIVE.id);
    return state;
  }

  it('mirrors B08057 exact-cost ownership with the source on opp', () => {
    const short = oppB08057State(8);
    install(short, 'opp', 'B08057-opp-short');
    const before = structuredClone(current());
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'opp-elena', abilId: 'a2' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(current().players.opp.deck).toEqual(before.players.opp.deck);
    expect(current().players.self.deck).toEqual(before.players.self.deck);

    const exact = oppB08057State(9);
    install(exact, 'opp', 'B08057-opp-exact');
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'opp-elena', abilId: 'a2' }))
      .toEqual({ ok: true });
    expect(current().players.opp.scene.find(character => character.uid === 'opp-elena')?.state).toBe('sleep');
    expect(current().refreshCount.opp).toBe(1);
    expect(current().refreshCount.self).toBe(0);
    expect(current().players.self.deck).toHaveLength(9);
  });

  it('mirrors B08059 self-inclusive latch with the source on opp', () => {
    const state = createEmptyGameState();
    state.turn = { number: 181, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.scene = [
      sceneChar(B08059.id, 'opp-moroboshi'),
      sceneChar(LEVEL_SEVEN_A.id, 'opp-level-seven'),
    ];
    state.players.self.scene = [sceneChar(LEVEL_SEVEN_B.id, 'self-decoy')];

    expect(read.char.level(state, 'opp-moroboshi')).toBe(7);
    expect(read.char.ap(state, 'opp-moroboshi')).toBe((B08059.ap ?? 0) + 1000);
    expect(read.char.hasKeyword(state, 'opp-moroboshi', '突撃')).toBe(true);
    mutate.scene.removeToRemove(state, 'opp-level-seven', 'effect', undefined, { byPlayer: 'self' });
    runAllUntilEmpty(state);
    expect(read.char.level(state, 'opp-moroboshi')).toBe(6);
    expect(read.char.hasKeyword(state, 'opp-moroboshi', '突撃')).toBe(false);
  });
});
