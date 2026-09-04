// qa: card:D11007:31477ac476064f376e887ccbb69a33524e3c445608c9009f36c53aa4a9c3b2ba
// qa: card:D11008:31477ac476064f376e887ccbb69a33524e3c445608c9009f36c53aa4a9c3b2ba
// qa: card:PR304:31477ac476064f376e887ccbb69a33524e3c445608c9009f36c53aa4a9c3b2ba

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { D11007 } from '@/cards/ct-d11/D11007';
import { D11008 } from '@/cards/ct-d11/D11008';
import { PR304 } from '@/cards/pr-01/PR304';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const SOURCES = [D11007, D11008, PR304] as const;
const TARGET = fixture('W109_TARGET', { ap: 7000 });
const DISCARD = fixture('W109_DISCARD');

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave109 state');
  return state;
}

function install(source: CardDef, owner: Player, hand: readonly string[]): void {
  const opponent = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 4, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(source.id, 'source')];
  state.players[owner].hand = [...hand];
  state.players[opponent].scene = [sceneChar(TARGET.id, 'target', { state: 'sleep' })];
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function startContact(owner: Player): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'target' }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(current().turn.player).toBe(owner);
  return actionId;
}

function finishContact(actionId: string, first: Player, second: Player): void {
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: first, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: second, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
}

function expectOrder(actionId: string, firstUid: string, secondUid: string): void {
  expect(current().actionContexts?.[actionId]).toMatchObject({
    phase: 'action-1', firstUid, secondUid,
  });
}

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  registerAll();
  register(TARGET);
  register(DISCARD);
  registerTriggeredListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave109: contacted AP resolves before action order', () => {
  // Card-bound physical rows: D11007 D11008 PR304.
  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner waits for discard and orders from post-effect AP',
    ({ source, owner }) => {
      install(source, owner, [DISCARD.id]);
      const actionId = startContact(owner);
      const pending = useGameStateStore.getState().pendingEffectPick;
      expect(pending).toMatchObject({
        atomVerb: 'discard', player: owner,
        source: { cardId: source.id, abilityId: 'a3' },
      });
      expect(current().actionContexts?.[actionId]).toMatchObject({ phase: 'contact-order-pending' });
      expect(current().actionContexts?.[actionId]?.firstUid).toBeUndefined();
      expect(current().actionContexts?.[actionId]?.secondUid).toBeUndefined();
      expect(readChar.ap(current(), 'source')).toBe(5000);

      expect(dispatchEngineAction(bindPendingDecision(pending!, {
        type: 'effectPickResolve', pickedUid: pending!.candidates[0]!.uid,
      }))).toEqual({ ok: true });
      expect(current().players[owner].hand).toEqual([]);
      expect(readChar.ap(current(), 'source')).toBe(8000);
      expect(current().actionContexts?.[actionId]).toMatchObject({ firstUid: 'target', secondUid: 'source' });

      finishContact(actionId, other(owner), owner);
      expect(readChar.ap(current(), 'source')).toBe(5000);
    },
  );

  it.each(SOURCES)('$id decline preserves original AP order', source => {
    install(source, 'self', [DISCARD.id]);
    const actionId = startContact('self');
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    expect(current().players.self.hand).toEqual([DISCARD.id]);
    expect(readChar.ap(current(), 'source')).toBe(5000);
    expect(current().actionContexts?.[actionId]).toMatchObject({ firstUid: 'source', secondUid: 'target' });
  });

  it.each(SOURCES)('$id with zero hand skips the optional payment and orders from original AP', source => {
    install(source, 'self', []);
    const actionId = startContact('self');
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(readChar.ap(current(), 'source')).toBe(5000);
    expectOrder(actionId, 'source', 'target');
  });
});
