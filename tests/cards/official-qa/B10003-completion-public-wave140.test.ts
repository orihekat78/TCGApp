// qa: card:B10003:0194b74149e29b2d31fa5b6d2a9bf767dfd2a718b7ea50244905b5d5fb423e0b
// qa: card:B10003:41a4d71898ca68c0a066e9abd2abb7dadd774393e70eb45b6f20ad04f878f316
// qa: card:B10003:648ebbcb352a942bf69b98d734cd00e8335b630bb1d31ac0c90de1edf1338f80
// qa: card:B10003:a170fb70e2da9658e32bc5ce7cc8f2a0d8c79fd727bdd75bb32253f45e459efc
// qa: card:B10003:a1a08a01622d9551bdceff6e19bd462e9fc6b6f49f36cd7cabf5dc57eed8aaa6

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B10003, B10003P } from '@/cards/ct-p10/B10003';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { candidates } from '@/engine/target/candidates';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { ActionContext, CardDef, EffectCtx, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['青'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const SOCCER = fixture('W140_SOCCER', { traits: ['サッカー選手'] });
const SUCCESSOR = fixture('W140_SUCCESSOR');
const VICTIM = fixture('W140_VICTIM', { ap: 1000 });
const SECRET = fixture('W140_SECRET', { kind: 'event', ap: undefined, lp: undefined });
const TAIL = fixture('W140_TAIL');
const PRINTINGS = [B10003, B10003P] as const;
const PRINTING_OWNERS = PRINTINGS.flatMap(printing =>
  (['self', 'opp'] as const).map(owner => ({ printing, owner })));

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave140 state');
  return state;
}

function actionContext(actionId: string): ActionContext {
  const action = current().actionContexts?.[actionId];
  if (!action) throw new Error(`missing Wave140 action ${actionId}`);
  return action;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave140-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function board(printing: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 35, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(printing.id, 'source', {
    isNamed: false,
    setCards: [{ cardId: SECRET.id, faceUp: false, instanceId: 'set:secret' }],
  })];
  state.players[owner].deck = [TAIL.id, TAIL.id];
  state.players[other(owner)].scene = [sceneChar(VICTIM.id, 'target', { state: 'sleep' })];
  state.players[other(owner)].deck = [TAIL.id, TAIL.id];
  return state;
}

function declareAndGuard(): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'target' }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
    .toEqual({ ok: true });
  return actionId;
}

function driveThroughJudge(owner: Player): string {
  const actionId = declareAndGuard();
  for (let step = 0; step < 20; step += 1) {
    const action = actionContext(actionId);
    if (action.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
      return actionId;
    }
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const actingUid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = current().players[owner].scene.some(character => character.uid === actingUid)
        ? owner
        : other(owner);
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('Wave140 action did not reach judge');
}

function advanceUntilDecisionOrEnd(actionId: string): void {
  for (let step = 0; step < 6 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    surfacePendingSideChannels();
    if (useGameStateStore.getState().pendingEffectChoice) return;
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  surfacePendingSideChannels();
}

function settleAction(actionId: string): void {
  for (let step = 0; step < 6 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [SOCCER, SUCCESSOR, VICTIM, SECRET, TAIL]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave140: Soccer Player exists only on the live scene occurrence', () => {
  it.each(PRINTING_OWNERS)('$printing.id owner $owner does not pass the trait through disguise', ({ printing, owner }) => {
    const state = createEmptyGameState();
    state.players[owner].scene = [sceneChar(printing.id, 'source')];

    expect(readChar.traits(state, 'source')).toContain('サッカー選手');
    mutate.char.disguiseInto(state, 'source', SUCCESSOR.id);
    expect(state.players[owner].scene[0]?.cardId).toBe(SUCCESSOR.id);
    expect(readChar.traits(state, 'source')).not.toContain('サッカー選手');
  });

  it.each(PRINTING_OWNERS)('$printing.id owner $owner is not a Soccer Player off scene', ({ printing, owner }) => {
    const state = createEmptyGameState();
    state.players[owner].hand = [printing.id, SOCCER.id];
    state.players[owner].deck = [printing.id, SOCCER.id];
    state.players[owner].remove = [printing.id, SOCCER.id];
    const ctx = {
      source: { player: owner, cardId: printing.id, uid: 'source', abilityId: 'a2', area: 'scene' },
      bindings: {},
    } as EffectCtx;

    expect(printing.traits).toEqual(['探偵', '高校生']);
    for (const area of ['hand', 'deck', 'remove'] as const) {
      expect(candidates(state, {
        kind: 'all', query: { area, side: 'self', filter: { kind: 'character', trait: 'サッカー選手' } },
      } as never, ctx).map(candidate => candidate.cardId)).toEqual([SOCCER.id]);
    }
  });
});

describe('official QA Wave140: action-end trigger requires the source on scene', () => {
  it.each(PRINTING_OWNERS)('$printing.id owner $owner stays silent after leaving during its action', ({ printing, owner }) => {
    install(board(printing, owner), owner, `${printing.id}-${owner}-source-leaves`);
    const actionId = declareAndGuard();
    expect(useGameStateStore.getState().dispatch(state => produce(state, draft => {
      mutate.scene.removeToRemove(draft, 'source', 'effect');
    }))).toBe(true);

    settleAction(actionId);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectChoice).toBeNull();
    expect(current().pendingEffects.some(entry => entry.source.cardId === printing.id)).toBe(false);
    expect(current().players[owner].scene.some(character => character.uid === 'source')).toBe(false);
  });

  it.each(PRINTING_OWNERS)('$printing.id owner $owner triggers when its contact target leaves', ({ printing, owner }) => {
    install(board(printing, owner), owner, `${printing.id}-${owner}-target-leaves`);
    const actionId = driveThroughJudge(owner);
    expect(current().players[other(owner)].scene.some(character => character.uid === 'target')).toBe(false);
    advanceUntilDecisionOrEnd(actionId);
    const choice = useGameStateStore.getState().pendingEffectChoice;
    expect(choice).toMatchObject({
      player: owner, source: { uid: 'source', cardId: printing.id, abilityId: 'a4' },
    });
    expect(dispatchEngineAction(bindPendingDecision(choice!, {
      type: 'choiceResolve', choiceIndex: 0,
    }))).toEqual({ ok: true });

    surfacePendingSideChannels();
    const setChoice = useGameStateStore.getState().pendingSetCardChoice;
    expect(setChoice).toMatchObject({
      player: owner, hostUid: 'source', face: 'down', destination: { area: 'hand' },
      entries: [{ instanceId: 'set:secret', ordinal: 1, hidden: true }],
    });
    expect(JSON.stringify(setChoice)).not.toContain(SECRET.id);
    expect(dispatchEngineAction(bindPendingDecision(setChoice!, {
      type: 'setCardChoiceResolve', instanceId: 'set:secret',
    }))).toEqual({ ok: true });
    expect(current().players[owner].hand).toEqual([SECRET.id]);
    expect(current().players[owner].scene[0]?.setCards).toEqual([]);
    settleAction(actionId);
  });
});
